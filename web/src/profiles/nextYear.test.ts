import {describe, expect, it} from 'vitest';
import {nextYearStart} from './StudentDialogs';

describe('nextYearStart', () => {
  it('is the first 1 April after the academic year the enrolment began in', () => {
    expect(nextYearStart('2026-04-01')).toBe('2027-04-01');
    expect(nextYearStart('2026-11-10')).toBe('2027-04-01');
    expect(nextYearStart('2027-02-15')).toBe('2027-04-01');
  });
});
