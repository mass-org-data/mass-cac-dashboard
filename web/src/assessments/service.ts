// Assessments data service for the new interface. Scorecards and charts use the same reviewed report as the
// Overview (reviewed_chart_metrics); the saved-assessment register uses assessment_register_summary; entry uses
// read_students, read_assessments and the atomic record_assessment_batch. The server enforces scope, versions,
// activation gates and audit. Nothing here weakens them.
import type {Rpc} from '../session/backend';

export interface RegisterRow {centre_id: string; shift_code: string; assessment_date: string | null; quarter: number; students: number; average_score: number | string | null; created_by?: string | null; last_edited_by?: string | null; last_edited_at?: string | null}
export interface Filters {centres: string[]; yearId: string; shift: string | null; grade: string | null; gender: string | null}
export interface RosterStudent {enrolment: string; child: string; studentId: string; name: string | null; grade: string; shift: string}
export interface SavedResult {enrolment: string; score: number; date: string | null; version: number}
export interface ScoreRow {enrolment: string; definition: string; date: string; score: number; expected: number}

interface ReadStudent {child_id: string; student_id: string; enrolment_id: string; grade_label: string; shift_code: string; full_name: string | null}
interface ReadAssessment {enrolment_id: string; definition_id: string; assessed_on: string | null; score: number | string; row_version: number}

async function all<T>(rpc: Rpc, name: string, args: Record<string, unknown>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < 100; page++) {
    const batch = await rpc<T[]>(name, {...args, p_limit: 100, p_offset: page * 100});
    if (!Array.isArray(batch)) throw new Error('Unexpected programme response.');
    rows.push(...batch);
    if (batch.length < 100) return rows;
  }
  throw new Error('This selection contains too many records.');
}

export function createAssessmentsService(rpc: Rpc) {
  return {
    async register(f: Filters): Promise<RegisterRow[]> {
      if (!f.centres.length) return [];
      const rows = await rpc<RegisterRow[]>('assessment_register_summary', {p_centres: f.centres, p_year: f.yearId, p_shift: f.shift, p_grade: f.grade, p_gender: f.gender});
      if (!Array.isArray(rows)) throw new Error('Unexpected assessment response.');
      return rows;
    },
    /** Students enrolled in one centre on the observed date (names appear only where the role may read them). */
    async roster(centre: string, date: string): Promise<RosterStudent[]> {
      const rows = await all<ReadStudent>(rpc, 'read_students', {p_centre: centre, p_on: date});
      return rows.map(s => ({enrolment: s.enrolment_id, child: s.child_id, studentId: s.student_id, name: s.full_name, grade: s.grade_label, shift: s.shift_code}));
    },
    /** Results already saved for one definition in the academic year (one result per child and round is supported). */
    async saved(centre: string, definition: string, from: string, until: string): Promise<Map<string, SavedResult>> {
      const rows = await all<ReadAssessment>(rpc, 'read_assessments', {p_centre: centre, p_from: from, p_until: until, p_child: null});
      return new Map(rows.filter(r => r.definition_id === definition).map(r => [r.enrolment_id, {enrolment: r.enrolment_id, score: Number(r.score), date: r.assessed_on, version: r.row_version}]));
    },
    save: (rows: ScoreRow[]) => rpc<number>('record_assessment_batch', {p_rows: rows}),
  };
}
export type AssessmentsService = ReturnType<typeof createAssessmentsService>;
