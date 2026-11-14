import {describe, expect, it, vi} from 'vitest';
import {createOverviewService, isFutureMonth, type Environment, type Selection} from './overview';
import type {Rpc} from '../session/backend';

const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03'];
const env = (overrides: Partial<Environment> = {}): Environment => ({yearId: 'y1', today: '2026-11-14', fromQuarter: 1, toQuarter: 2, months, hasSeries: true, ...overrides});
const selection = (overrides: Partial<Selection> = {}): Selection => ({month: '2026-11', centres: ['c1', 'c2'], shift: null, grade: null, gender: null, ...overrides});
const reportFor = (children: number, pct: number | null = 86) => ({children, grades: {}, genders: {}, attendance: {p: 1, a: 0, l: 0, excluded: 0, percentage: pct}, quarters: [], centres: []});

function fakeRpc() {
  let running = 0, peak = 0;
  const calls: Array<{name: string; args: Record<string, unknown>}> = [];
  const rpc = vi.fn(async (name: string, args: Record<string, unknown> = {}) => {
    calls.push({name, args}); running++; peak = Math.max(peak, running);
    await new Promise(resolve => setTimeout(resolve, 5));
    running--;
    if (name === 'reviewed_chart_metrics') return reportFor(args.p_shift === 'Morning' ? 40 : args.p_shift === 'Evening' ? 60 : 100, args.p_from === '2026-11-01' ? 85.9 : 86);
    if (name === 'reviewed_attendance_series') return [{month: '2026-07', percentage: '86.0'}, {month: '2026-08', percentage: null}];
    throw new Error('unexpected ' + name);
  }) as unknown as Rpc;
  return {rpc, calls, peak: () => peak};
}

describe('Overview service', () => {
  it('asks for one report, two shift reports and one series call, never per-centre calls', async () => {
    const {rpc, calls} = fakeRpc();
    const service = createOverviewService(rpc);
    const [report, shifts, series] = await Promise.all([service.report(selection(), env()), service.shifts(selection(), env()), service.series(selection(), env())]);
    expect(report.children).toBe(100);
    expect(shifts).toEqual({Morning: 40, Evening: 60});
    expect(series).toEqual({'2026-07': 86, '2026-08': null});
    expect(calls.map(c => c.name).sort()).toEqual(['reviewed_attendance_series', 'reviewed_chart_metrics', 'reviewed_chart_metrics', 'reviewed_chart_metrics']);
    expect(calls.some(c => c.name === 'programme_aggregate')).toBe(false);
  });

  it('sends the selected scope, the reporting day and the month window to the server', async () => {
    const {rpc, calls} = fakeRpc();
    await createOverviewService(rpc).report(selection({shift: 'Morning', grade: '5', gender: 'Girl'}), env());
    expect(calls[0].args).toEqual({p_centres: ['c1', 'c2'], p_on: '2026-11-14', p_from: '2026-11-01', p_until: '2026-12-01', p_year: 'y1', p_grade: '5', p_shift: 'Morning', p_gender: 'Girl', p_earlier: 1, p_later: 2});
    await createOverviewService(rpc).report(selection({month: '2026-08'}), env());
    expect(calls[1].args).toMatchObject({p_on: '2026-08-31', p_from: '2026-08-01', p_until: '2026-09-01'});
  });

  it('runs at most two heavy reports at once', async () => {
    const {rpc, peak} = fakeRpc();
    const service = createOverviewService(rpc);
    await Promise.all(months.slice(0, 8).map(month => service.report(selection({month}), env())));
    expect(peak()).toBeLessThanOrEqual(2);
  });

  it('reuses a finished report and shares one in-flight request', async () => {
    const {rpc, calls} = fakeRpc();
    const service = createOverviewService(rpc);
    await Promise.all([service.report(selection(), env()), service.report(selection(), env())]);
    await service.report(selection(), env());
    expect(calls.filter(c => c.name === 'reviewed_chart_metrics')).toHaveLength(1);
  });

  it('lets a failed request be retried instead of caching the failure', async () => {
    let fail = true;
    const rpc = vi.fn(async () => { if (fail) throw new Error('timeout'); return reportFor(5); }) as unknown as Rpc;
    const service = createOverviewService(rpc);
    await expect(service.report(selection(), env())).rejects.toThrow('timeout');
    fail = false;
    await expect(service.report(selection(), env())).resolves.toMatchObject({children: 5});
  });

  it('falls back to one report per elapsed month when the backend has no series function', async () => {
    const {rpc, calls} = fakeRpc();
    const series = await createOverviewService(rpc).series(selection(), env({hasSeries: false}));
    expect(Object.keys(series)).toEqual(months.slice(0, 8));
    expect(calls.every(c => c.name === 'reviewed_chart_metrics')).toBe(true);
    expect(calls).toHaveLength(8);
  });

  it('knows future months', () => {
    expect(isFutureMonth('2026-12', '2026-11-14')).toBe(true);
    expect(isFutureMonth('2026-11', '2026-11-14')).toBe(false);
  });
});
