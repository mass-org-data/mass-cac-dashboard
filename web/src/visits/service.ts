// Visits data service for the new interface. Same server functions as the current Visits page: visit_summary and
// visit_officer_summary per centre (cheap, run six at a time), read_visits for the centres an officer may record in,
// get_visit_assignments and record_visit. The server enforces scope, versions, activation gates and audit.
import {createLimiter} from '../../../src/live/limiter.js';
import type {Rpc} from '../session/backend';

export interface SummaryRow {centre_id: string; morning: number | string; evening: number | string; target_morning: number; target_evening: number; achieved: boolean; recorded_count: number | string}
export interface OfficerRow {centre_id: string; officer_id: string; label: string; morning: number | string; evening: number | string; recorded_count: number | string}
export interface VisitRow {id: string; centre_id: string; officer_id: string; shift_code: string; visit_date: string; status: string; feedback: string; next_action: string; row_version: number}
export interface Assignment {id: string; centre_id: string; officer_id: string; shift_scope: string; starts_on: string; ends_before: string | null}
export interface NewVisit {id: string; assignment: string; shift: string; date: string; status: string; feedback: string; nextAction: string}

export const monthWindow = (month: string) => {
  const from = `${month}-01`;
  const d = new Date(`${from}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1);
  return {from, until: d.toISOString().slice(0, 10)};
};

export function createVisitsService(rpc: Rpc, limit: (job: () => Promise<unknown>) => Promise<unknown> = createLimiter(6)) {
  const each = <T,>(centres: string[], job: (centre: string) => Promise<T[]>): Promise<T[]> =>
    Promise.all(centres.map(c => limit(() => job(c)) as Promise<T[]>)).then(parts => parts.flat());
  return {
    assignments: () => rpc<Assignment[]>('get_visit_assignments'),
    summary(centres: string[], month: string, officer: string | null) {
      const {from, until} = monthWindow(month);
      return each<SummaryRow>(centres, c => rpc<SummaryRow[]>('visit_summary', {p_centre: c, p_from: from, p_until: until, p_officer: officer}));
    },
    officers(centres: string[], month: string) {
      const {from, until} = monthWindow(month);
      return each<OfficerRow>(centres, async c => (await rpc<Array<Omit<OfficerRow, 'centre_id'>>>('visit_officer_summary', {p_centre: c, p_from: from, p_until: until})).map(r => ({...r, centre_id: c})));
    },
    /** The visit log of the centres this role may record in. */
    log(centres: string[], month: string) {
      const {from, until} = monthWindow(month);
      return each<VisitRow>(centres, async c => {
        const rows: VisitRow[] = [];
        for (let offset = 0; offset <= 100000; offset += 100) {
          const page = await rpc<VisitRow[]>('read_visits', {p_centre: c, p_from: from, p_until: until, p_limit: 100, p_offset: offset});
          rows.push(...page);
          if (page.length < 100) return rows;
        }
        throw new Error('Visit limit exceeded; narrow the scope.');
      });
    },
    record: (v: NewVisit) => rpc<number>('record_visit', {p_id: v.id, p_assignment: v.assignment, p_shift: v.shift, p_date: v.date, p_status: v.status, p_feedback: v.feedback, p_next_action: v.nextAction, p_expected: 0, p_reason: null}),
  };
}
export type VisitsService = ReturnType<typeof createVisitsService>;
