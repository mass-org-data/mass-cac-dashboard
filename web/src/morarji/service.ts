// Morarji data service for the new interface. The cohort totals come from the same reviewed report as the other
// screens (`morarji` and `morarjiYears` in reviewed_chart_metrics). Per-student follow-up rows come from
// read_morarji for the centres the active role may read. The new interface only reads: adding a child to a cohort
// and recording outcomes use the protected add_morarji_member and record_morarji, gated by the `morarji` activation feature.
import {createLimiter} from '../../../src/live/limiter.js';
import type {Rpc} from '../session/backend';
import {chunk, isMissingFunction} from '../lib/batched';

export interface MembershipRow {membership_id: string; cohort_id: string; child_id: string; enrolment_id: string; shift_code: string; applied: boolean | null; attended: boolean | null; passed: boolean | null; school_name: string | null; centre: string; /** Present when the batched function supplied the student's id and name, so no roster read is needed. */ detailed?: boolean; student_id?: string | null; full_name?: string | null}
interface ReadMorarji extends Omit<MembershipRow, 'centre'> {outcome_id: string | null; row_version: number | null}

export interface OutcomeInput {member: string; applied: boolean | null; attended: boolean | null; passed: boolean | null; school: string | null; expected: number}
export interface Grade5Student {enrolment: string; studentId: string; name: string | null; shift: string}

export function createMorarjiService(rpc: Rpc, limit: (job: () => Promise<unknown>) => Promise<unknown> = createLimiter(6)) {
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
  interface Followup extends Omit<MembershipRow, 'centre'> {centre_id: string; student_id: string | null; full_name: string | null}
  async function followup(centres: string[]): Promise<MembershipRow[]> {
    const rows: MembershipRow[] = [];
    for (const part of chunk(centres)) {
      for (let offset = 0; offset <= 100000; offset += 500) {
        const batch = await rpc<Followup[]>('morarji_followup', {p_centres: part, p_cohort: null, p_limit: 500, p_offset: offset});
        if (!Array.isArray(batch)) throw new Error('Unexpected programme response.');
        rows.push(...batch.map(r => ({membership_id: r.membership_id, cohort_id: r.cohort_id, child_id: r.child_id, enrolment_id: r.enrolment_id, shift_code: r.shift_code, applied: r.applied ?? null, attended: r.attended ?? null, passed: r.passed ?? null, school_name: r.school_name ?? null, centre: r.centre_id, detailed: true, student_id: r.student_id ?? null, full_name: r.full_name ?? null})));
        if (batch.length < 500) break;
      }
    }
    return rows;
  }
  let batched = true;
  return {
    /** Grade 5 students enrolled in one centre today: the only children the Morarji cohort covers. */
    async grade5(centreId: string): Promise<Grade5Student[]> {
      const rows: Grade5Student[] = [];
      for (let page = 0; page < 100; page++) {
        const batch = await rpc<Array<{enrolment_id: string; student_id: string; full_name: string | null; grade_label: string; shift_code: string}>>('read_students', {p_centre: centreId, p_on: null, p_limit: 100, p_offset: page * 100});
        if (!Array.isArray(batch)) throw new Error('Unexpected programme response.');
        rows.push(...batch.filter(r => r.grade_label === '5').map(r => ({enrolment: r.enrolment_id, studentId: r.student_id, name: r.full_name, shift: r.shift_code})));
        if (batch.length < 100) return rows;
      }
      throw new Error('This centre contains too many records.');
    },
    /** The current outcome version of one membership (0 when no outcome is saved yet), needed for a correction. */
    async outcomeVersion(centreId: string, membership: string): Promise<number> {
      for (let page = 0; page < 100; page++) {
        const batch = await rpc<ReadMorarji[]>('read_morarji', {p_centre: centreId, p_cohort: null, p_limit: 100, p_offset: page * 100});
        if (!Array.isArray(batch)) throw new Error('Unexpected programme response.');
        const found = batch.find(r => r.membership_id === membership);
        if (found) return Number(found.row_version ?? 0);
        if (batch.length < 100) break;
      }
      return 0;
    },
    addMember: (enrolment: string, cohort: string) => rpc<string>('add_morarji_member', {p_enrolment: enrolment, p_cohort: cohort}),
    recordOutcome: (o: OutcomeInput) => rpc<string>('record_morarji', {p_member: o.member, p_applied: o.applied, p_attended: o.attended, p_passed: o.passed, p_school: o.school?.trim() ? o.school.trim() : null, p_expected: o.expected}),
    async memberships(centres: string[]): Promise<MembershipRow[]> {
      if (batched && centres.length) {
        try { return await followup(centres); } catch (error) { if (!isMissingFunction(error)) throw error; batched = false; }
      }
      return Promise.all(centres.map(id => limit(() => centre(id)) as Promise<MembershipRow[]>)).then(parts => parts.flat());
    },
  };
}
export type MorarjiService = ReturnType<typeof createMorarjiService>;

export const resultOf = (row: {passed: boolean | null}) => (row.passed === true ? 'Passed' : row.passed === false ? 'Not passed' : 'Pending');
export const yesNo = (value: boolean | null) => (value === null ? 'Not recorded' : value ? 'Yes' : 'No');
