import {describe, expect, it, vi} from 'vitest';
import {createVisitsService, monthWindow} from './service';

const direct = (job: () => Promise<unknown>) => job();
describe('visits service', () => {
  it('uses one calendar month window, including December', () => {
    expect(monthWindow('2026-11')).toEqual({from: '2026-11-01', until: '2026-12-01'});
    expect(monthWindow('2026-12')).toEqual({from: '2026-12-01', until: '2027-01-01'});
  });
  it('reads the summary per centre with the officer filter and joins the rows', async () => {
    const rpc = vi.fn(async (_n: string, args: {p_centre: string}) => [{centre_id: args.p_centre, morning: 2, evening: 1, target_morning: 2, target_evening: 2, achieved: false, recorded_count: 3}]);
    const rows = await createVisitsService(rpc as never, direct).summary(['c1', 'c2'], '2026-11', 'o1');
    expect(rows.map(r => r.centre_id)).toEqual(['c1', 'c2']);
    expect(rpc).toHaveBeenCalledWith('visit_summary', {p_centre: 'c1', p_from: '2026-11-01', p_until: '2026-12-01', p_officer: 'o1'});
  });
  it('tags officer rows with their centre', async () => {
    const rpc = vi.fn(async () => [{officer_id: 'o1', label: 'Meera', morning: 1, evening: 1, recorded_count: 2}]);
    expect((await createVisitsService(rpc as never, direct).officers(['c1'], '2026-11'))[0]).toEqual(expect.objectContaining({centre_id: 'c1', label: 'Meera'}));
  });
  it('pages the visit log until a short page', async () => {
    const rpc = vi.fn(async (_n: string, args: {p_offset: number}) => args.p_offset === 0 ? Array.from({length: 100}, (_, i) => ({id: `v${i}`})) : [{id: 'last'}]);
    const rows = await createVisitsService(rpc as never, direct).log(['c1'], '2026-11');
    expect(rows).toHaveLength(101);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('records a new visit with expected version 0 and no correction reason', async () => {
    const rpc = vi.fn(async () => 1);
    await createVisitsService(rpc as never, direct).record({id: 'v', assignment: 'a', shift: 'Evening', date: '2026-11-14', status: 'Completed', feedback: 'ok', nextAction: 'x'});
    expect(rpc).toHaveBeenCalledWith('record_visit', {p_id: 'v', p_assignment: 'a', p_shift: 'Evening', p_date: '2026-11-14', p_status: 'Completed', p_feedback: 'ok', p_next_action: 'x', p_expected: 0, p_reason: null});
  });
});
