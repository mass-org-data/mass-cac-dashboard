// Pure rules of visit entry, ported from the current interface (src/live/original-actions.js): a completed visit
// needs feedback and a date that is not in the future; exactly one verified, dated officer assignment must cover
// the centre, shift and date. A new visit id is created once per dialog so a retry cannot duplicate it.
import type {Assignment} from './service';

export const newId = () => globalThis.crypto.randomUUID();
export interface VisitForm {centre: string; shift: string; date: string; status: string; feedback: string; nextAction: string}
export const emptyVisit = (centre: string, shift: string, today: string): VisitForm => ({centre, shift: shift || 'Morning', date: today, status: 'Planned', feedback: '', nextAction: ''});

export const assignmentFor = (assignments: Assignment[], centre: string, date: string) =>
  assignments.filter(a => a.centre_id === centre && a.shift_scope === 'Both shifts' && a.starts_on <= date && (!a.ends_before || date < a.ends_before));

/** The first rule broken, in the wording of the current interface; null when valid. */
export function validateVisit(form: VisitForm, today: string, assignments: Assignment[]): string | null {
  if (!form.date || (form.status === 'Completed' && (form.date > today || !form.feedback.trim()))) return 'Completed visits need valid feedback and a non-future date.';
  if (form.feedback.length > 2000 || form.nextAction.length > 2000) return 'Feedback and next action are limited to 2,000 characters.';
  if (assignmentFor(assignments, form.centre, form.date).length !== 1) return 'One verified officer assignment must cover the centre, shift and date.';
  return null;
}
