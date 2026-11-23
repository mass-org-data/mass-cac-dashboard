// Pure rules of assessment entry, ported from the current interface (src/live/original-actions.js):
// the observed date inside the April–March year decides the round F1–F4; maximum 25 marks; blank means
// unchanged and never zero; existing results are not rewritten here (corrections have their own, separately
// gated workflow); at most 500 scores in one atomic save.
import {assessmentDefinitionForDate} from '../../../src/live/assessment-round.js';
import type {References} from '../session/backend';
import type {RosterStudent, SavedResult, ScoreRow} from './service';

export const MAX_SCORE = 25;
export const MAX_ROWS = 500;
type Year = References['academic_years'][number];

export interface Mapped {label: string; quarter: number; definitionId: string}
/** The round and approved 25-mark definition for an observed date; throws the same wording as the current interface. */
export function mapRound(date: string, year: Year, refs: References): Mapped {
  const mapped = assessmentDefinitionForDate(date, year, refs.assessment_periods, refs.assessment_definitions) as {label: string; quarter: number; definition: {id: string}};
  return {label: mapped.label, quarter: mapped.quarter, definitionId: mapped.definition.id};
}

/** The approved 25-mark definition of a round, used when a saved register is opened for editing (its date may be unknown). */
export function definitionForQuarter(quarter: number, year: Year, refs: References): Mapped {
  const period = refs.assessment_periods.find(p => p.academic_year_id === year.id && Number(p.quarter) === quarter);
  const definition = period && refs.assessment_definitions.find(d => d.period_id === period.id && Number(d.max_score) === 25);
  if (!definition) throw new Error(`F${quarter} has no approved 25-mark assessment definition.`);
  return {label: `F${quarter}`, quarter, definitionId: definition.id};
}

export function validateStart(centre: string, date: string, today: string, allowed: string[]): string | null {
  if (!allowed.includes(centre)) return 'Choose a centre in your verified write scope.';
  if (!date) return 'Choose the observed assessment date.';
  if (date > today) return 'The observed date cannot be in the future.';
  return null;
}

export type Entered = Record<string, string>;

/** The marks shown for each student when a register opens: the saved score, or blank. */
export function initialEntries(roster: RosterStudent[], saved: Map<string, SavedResult>): Entered {
  const entered: Entered = {};
  for (const student of roster) { const old = saved.get(student.enrolment); if (old) entered[student.enrolment] = String(old.score); }
  return entered;
}

/**
 * Builds the changed rows, or throws the first rule broken. New marks use the register date. A changed saved mark is a
 * correction: it keeps its original observed date (which may be unknown) and sends its version token. Blank never means zero
 * and never clears a saved mark.
 */
export function buildScores(roster: RosterStudent[], entered: Entered, saved: Map<string, SavedResult>, date: string, definition: string): ScoreRow[] {
  const rows: ScoreRow[] = [];
  for (const student of roster) {
    const text = (entered[student.enrolment] ?? '').trim();
    if (text === '') continue;
    const score = Number(text);
    if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) throw new Error('Marks must be 0–25.');
    const old = saved.get(student.enrolment);
    if (old) {
      if (old.score === score) continue;
      rows.push({enrolment: student.enrolment, definition, date: old.date, score, expected: old.version});
    } else rows.push({enrolment: student.enrolment, definition, date, score, expected: 0});
  }
  if (!rows.length) throw new Error('No changed marks.');
  if (rows.length > MAX_ROWS) throw new Error('Narrow the selection to at most 500 changed scores.');
  return rows;
}
