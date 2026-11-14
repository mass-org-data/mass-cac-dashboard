import {describe, expect, it, vi} from 'vitest';
import {createMorarjiService, resultOf, yesNo} from './service';

describe('morarji service', () => {
  it('reads every cohort of each centre and tags rows with their centre; unknown stays null', async () => {
    const rpc = vi.fn(async (_n: string, args: {p_centre: string}) => [{membership_id: `m-${args.p_centre}`, cohort_id: 'k1', child_id: 'c', enrolment_id: 'e', shift_code: 'Evening', outcome_id: null, applied: null, attended: undefined, passed: null, school_name: null, row_version: null}]);
    const rows = await createMorarjiService(rpc as never).memberships(['c1', 'c2']);
    expect(rows.map(r => r.centre)).toEqual(['c1', 'c2']);
    expect(rows[0]).toEqual(expect.objectContaining({applied: null, attended: null, passed: null}));
    expect(rpc).toHaveBeenCalledWith('read_morarji', {p_centre: 'c1', p_cohort: null, p_limit: 100, p_offset: 0});
  });
  it('pages a centre of more than 100 memberships', async () => {
    const row = (i: number) => ({membership_id: `m${i}`, cohort_id: 'k', child_id: 'c', enrolment_id: 'e', shift_code: 'Evening', applied: true, attended: true, passed: true, school_name: 'S'});
    const rpc = vi.fn(async (_n: string, args: {p_offset: number}) => args.p_offset === 0 ? Array.from({length: 100}, (_, i) => row(i)) : [row(100)]);
    expect(await createMorarjiService(rpc as never).memberships(['c1'])).toHaveLength(101);
  });
  it('labels results without turning unknown into a failure', () => {
    expect([resultOf({passed: true}), resultOf({passed: false}), resultOf({passed: null})]).toEqual(['Passed', 'Not passed', 'Pending']);
    expect([yesNo(true), yesNo(false), yesNo(null)]).toEqual(['Yes', 'No', 'Not recorded']);
  });
});
