import {describe, expect, it} from 'vitest';
import {buildScores, mapRound, validateStart} from './editor';
import type {RosterStudent, SavedResult} from './service';
import type {References} from '../session/backend';

const year = {id: 'y', starts_on: '2026-04-01', ends_before: '2027-04-01'};
const refs: References = {
  academic_years: [year],
  assessment_periods: [1, 2, 3, 4].map(q => ({id: `p${q}`, academic_year_id: 'y', quarter: q})),
  assessment_definitions: [1, 2, 3, 4].map(q => ({id: `d${q}`, period_id: `p${q}`, max_score: 25})),
};
const roster: RosterStudent[] = [{enrolment: 'e1', child: 'c1', studentId: 'S1', name: 'Asha', grade: '4', shift: 'Evening'}, {enrolment: 'e2', child: 'c2', studentId: 'S2', name: null, grade: '4', shift: 'Evening'}, {enrolment: 'e3', child: 'c3', studentId: 'S3', name: 'Ravi', grade: '5', shift: 'Evening'}];

describe('round mapping', () => {
  it('maps observed dates to F1–F4 across the April–March year', () => {
    expect(mapRound('2026-04-01', year, refs)).toEqual({label: 'F1', quarter: 1, definitionId: 'd1'});
    expect(mapRound('2026-09-30', year, refs).label).toBe('F2');
    expect(mapRound('2026-11-14', year, refs).label).toBe('F3');
    expect(mapRound('2027-03-31', year, refs).label).toBe('F4');
  });
  it('refuses a date outside the year, and a round without an approved 25-mark definition', () => {
    expect(() => mapRound('2027-04-01', year, refs)).toThrow('Choose an assessment date within the selected academic year.');
    expect(() => mapRound('2026-11-14', year, {...refs, assessment_definitions: []})).toThrow('F3 has no approved 25-mark assessment definition.');
  });
});

describe('start rules', () => {
  it('needs a permitted centre and a date that is not in the future', () => {
    expect(validateStart('c9', '2026-11-01', '2026-11-14', ['c1'])).toBe('Choose a centre in your verified write scope.');
    expect(validateStart('c1', '', '2026-11-14', ['c1'])).toBe('Choose the observed assessment date.');
    expect(validateStart('c1', '2026-11-15', '2026-11-14', ['c1'])).toBe('The observed date cannot be in the future.');
    expect(validateStart('c1', '2026-11-14', '2026-11-14', ['c1'])).toBeNull();
  });
});

describe('score rules', () => {
  const none = new Map<string, SavedResult>();
  it('builds one row per entered mark; blank is unchanged, never zero', () => {
    const rows = buildScores(roster, {e1: '18', e2: '', e3: '0'}, none, '2026-11-14', 'd3');
    expect(rows).toEqual([{enrolment: 'e1', definition: 'd3', date: '2026-11-14', score: 18, expected: 0}, {enrolment: 'e3', definition: 'd3', date: '2026-11-14', score: 0, expected: 0}]);
  });
  it('rejects marks outside 0–25 and non-numbers, and an empty save', () => {
    expect(() => buildScores(roster, {e1: '26'}, none, '2026-11-14', 'd3')).toThrow('Marks must be 0–25.');
    expect(() => buildScores(roster, {e1: '-1'}, none, '2026-11-14', 'd3')).toThrow('Marks must be 0–25.');
    expect(() => buildScores(roster, {e1: 'abc'}, none, '2026-11-14', 'd3')).toThrow('Marks must be 0–25.');
    expect(() => buildScores(roster, {}, none, '2026-11-14', 'd3')).toThrow('No changed marks.');
  });
  it('never rewrites a result that is already saved', () => {
    const saved = new Map<string, SavedResult>([['e1', {enrolment: 'e1', score: 10, date: '2026-10-01', version: 2}]]);
    expect(() => buildScores(roster, {e1: '20'}, saved, '2026-11-14', 'd3')).toThrow('No changed marks.');
    expect(buildScores(roster, {e1: '20', e3: '7'}, saved, '2026-11-14', 'd3').map(r => r.enrolment)).toEqual(['e3']);
  });
  it('limits one atomic save to 500 scores', () => {
    const many = Array.from({length: 501}, (_, i) => ({enrolment: `x${i}`, child: `k${i}`, studentId: `S${i}`, name: 'N', grade: '4', shift: 'Evening'}));
    expect(() => buildScores(many, Object.fromEntries(many.map(s => [s.enrolment, '5'])), none, '2026-11-14', 'd3')).toThrow('at most 500');
  });
});
