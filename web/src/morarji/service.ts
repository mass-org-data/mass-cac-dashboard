// Morarji data service for the new interface. The cohort totals come from the same reviewed report as the other
// screens (`morarji` and `morarjiYears` in reviewed_chart_metrics). Per-student follow-up rows come from
// read_morarji for the centres the active role may read. The new interface only reads: adding a child to a cohort
// and recording outcomes are gated by the `morarji` activation feature, which the database keeps hard-off.
import type {Rpc} from '../session/backend';

export interface MembershipRow {membership_id: string; cohort_id: string; child_id: string; enrolment_id: string; shift_code: string; applied: boolean | null; attended: boolean | null; passed: boolean | null; school_name: string | null; centre: string}
interface ReadMorarji extends Omit<MembershipRow, 'centre'> {outcome_id: string | null; row_version: number | null}

export function createMorarjiService(rpc: Rpc) {
  async function centre(id: string): Promise<MembershipRow[]> {
    const rows: MembershipRow[] = [];
    for (let page = 0; page < 100; page++) {
      const batch = await rpc<ReadMorarji[]>('read_morarji', {p_centre: id, p_cohort: null, p_limit: 100, p_offset: page * 100});
      if (!Array.isArray(batch)) throw new Error('Unexpected programme response.');
      rows.push(...batch.map(r => ({membership_id: r.membership_id, cohort_id: r.cohort_id, child_id: r.child_id, enrolment_id: r.enrolment_id, shift_code: r.shift_code, applied: r.applied ?? null, attended: r.attended ?? null, passed: r.passed ?? null, school_name: r.school_name ?? null, centre: id})));
      if (batch.length < 100) return rows;
    }
    throw new Error('This centre contains too many records.');
  }
  return {memberships: (centres: string[]) => Promise.all(centres.map(centre)).then(parts => parts.flat())};
}
export type MorarjiService = ReturnType<typeof createMorarjiService>;

export const resultOf = (row: {passed: boolean | null}) => (row.passed === true ? 'Passed' : row.passed === false ? 'Not passed' : 'Pending');
export const yesNo = (value: boolean | null) => (value === null ? 'Not recorded' : value ? 'Yes' : 'No');
