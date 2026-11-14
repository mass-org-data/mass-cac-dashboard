import {describe, expect, it, vi} from 'vitest';
import {CACHE_TTL_MS, memoise} from '../session/backend';
import {createOverviewService, toMonthlyReports, type Environment, type Selection} from './overview';
import {createMorarjiService} from '../morarji/service';
import {createProfilesService} from '../profiles/service';
import {sharedOverview} from './shared';
import {legacy} from '../test/legacy';

const selection: Selection = {month: '2026-11', centres: ['c1'], shift: null, grade: null, gender: null};
const env: Environment = {yearId: 'y', today: '2026-11-14', fromQuarter: 1, toQuarter: 2, months: [], hasSeries: false};
const report = {children: 3, grades: {}, genders: {}, attendance: {p: 1, a: 0, l: 0, excluded: 0, percentage: 100}, quarters: [], centres: []};

describe('memoise', () => {
  it('shares one request between concurrent callers and expires after five minutes', async () => {
    const store = new Map(); let t = 0; const load = vi.fn(async () => 'v');
    await Promise.all([memoise(store, 'k', load, () => t), memoise(store, 'k', load, () => t)]);
    expect(load).toHaveBeenCalledTimes(1);
    t = CACHE_TTL_MS - 1; await memoise(store, 'k', load, () => t);
    expect(load).toHaveBeenCalledTimes(1);
    t = CACHE_TTL_MS; await memoise(store, 'k', load, () => t);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('forgets a failure so it can be retried', async () => {
    const store = new Map(); const load = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue('ok');
    await expect(memoise(store, 'k', load)).rejects.toThrow('x');
    await Promise.resolve();
    await expect(memoise(store, 'k', load)).resolves.toBe('ok');
  });
});

describe('overview service cache', () => {
  it('reuses a report within five minutes, reloads after, and clear() drops it', async () => {
    const rpc = vi.fn(async () => report); let t = 0;
    const service = createOverviewService(rpc as never, job => job(), () => t);
    await service.report(selection, env); await service.report(selection, env);
    expect(rpc).toHaveBeenCalledTimes(1);
    t = CACHE_TTL_MS + 1; await service.report(selection, env);
    expect(rpc).toHaveBeenCalledTimes(2);
    service.clear(); await service.report(selection, env);
    expect(rpc).toHaveBeenCalledTimes(3);
  });
});

describe('shared services', () => {
  it('gives every screen the same instance for one session and a new one after reset', () => {
    const store = new Map<string, unknown>();
    const backend = {rpc: vi.fn() as never, shared: <T,>(key: string, create: () => T) => { if (!store.has(key)) store.set(key, create()); return store.get(key) as T; }};
    expect(sharedOverview(backend)).toBe(sharedOverview(backend));
    store.clear();
    expect(sharedOverview(backend)).toBeDefined();
  });
  it('runs per-centre reads at most six at a time', async () => {
    let running = 0; let peak = 0;
    const rpc = legacy(async () => { running++; peak = Math.max(peak, running); await new Promise(r => setTimeout(r, 5)); running--; return []; });
    await createMorarjiService(rpc as never).memberships(Array.from({length: 20}, (_, i) => `c${i}`));
    expect(peak).toBeLessThanOrEqual(6); expect(rpc.mock.calls.filter(c => c[0] === 'read_morarji')).toHaveLength(20);
    peak = 0;
    await createProfilesService(rpc as never).students(Array.from({length: 20}, (_, i) => `p${i}`), []);
    expect(peak).toBeLessThanOrEqual(6);
  });
});

describe('annual donor batched counts', () => {
  const rows = [
    {month: '2026-04', centre_id: 'c1', children: 10, p: 80, a: 10, l: 10, excluded: 0},
    {month: '2026-04', centre_id: 'c2', children: 5, p: 0, a: 0, l: 0, excluded: 4},
    {month: '2026-05', centre_id: 'c1', children: 11, p: 50, a: 50, l: 0, excluded: 2},
  ];
  it('builds one report per month, summing counts and recomputing the rate (never averaging percentages)', () => {
    const reports = toMonthlyReports(rows);
    expect(Object.keys(reports)).toEqual(['2026-04', '2026-05']);
    expect(reports['2026-04']!.attendance).toEqual({p: 80, a: 10, l: 10, excluded: 4, percentage: 80});
    expect(reports['2026-04']!.children).toBe(15);
    expect(reports['2026-04']!.centres.find(c => c.id === 'c2')!.attendance.percentage).toBeNull();   // unknown, not zero
    expect(reports['2026-05']!.attendance.percentage).toBe(50);
  });
  it('asks once for all centres and months, and reports null when the function is not installed', async () => {
    const rpc = vi.fn(async () => rows);
    const service = createOverviewService(rpc as never, job => job());
    const result = await service.monthlyByCentre(['c1', 'c2'], {yearId: 'y', today: '2026-11-14'});
    expect(Object.keys(result!)).toEqual(['2026-04', '2026-05']);
    expect(rpc).toHaveBeenCalledTimes(1);
    const older = createOverviewService(legacy(async () => rows) as never, job => job());
    expect(await older.monthlyByCentre(['c1'], {yearId: 'y', today: '2026-11-14'})).toBeNull();
  });
});
