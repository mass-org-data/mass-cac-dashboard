import {describe, expect, it} from 'vitest';
import {assignmentFor, emptyVisit, validateVisit} from './editor';
import type {Assignment} from './service';

const a = (over: Partial<Assignment> = {}): Assignment => ({id: 'a1', centre_id: 'c1', officer_id: 'o1', shift_scope: 'Both shifts', starts_on: '2026-04-01', ends_before: null, ...over});
const form = (over = {}) => ({...emptyVisit('c1', 'Morning', '2026-11-14'), ...over});

describe('visit rules', () => {
  it('needs feedback and a non-future date for a completed visit', () => {
    expect(validateVisit(form({status: 'Completed'}), '2026-11-14', [a()])).toBe('Completed visits need valid feedback and a non-future date.');
    expect(validateVisit(form({status: 'Completed', feedback: 'Good', date: '2026-11-15'}), '2026-11-14', [a()])).toBe('Completed visits need valid feedback and a non-future date.');
    expect(validateVisit(form({status: 'Completed', feedback: 'Good'}), '2026-11-14', [a()])).toBeNull();
  });
  it('lets a planned visit be saved for a future date without feedback', () => {
    expect(validateVisit(form({date: '2026-11-20'}), '2026-11-14', [a()])).toBeNull();
  });
  it('requires exactly one verified, dated assignment covering the centre and date', () => {
    const msg = 'One verified officer assignment must cover the centre, shift and date.';
    expect(validateVisit(form(), '2026-11-14', [])).toBe(msg);
    expect(validateVisit(form(), '2026-11-14', [a({centre_id: 'c9'})])).toBe(msg);
    expect(validateVisit(form(), '2026-11-14', [a({ends_before: '2026-11-14'})])).toBe(msg);
    expect(validateVisit(form(), '2026-11-14', [a({starts_on: '2026-11-15'})])).toBe(msg);
    expect(validateVisit(form(), '2026-11-14', [a({shift_scope: 'Morning'})])).toBe(msg);
    expect(validateVisit(form(), '2026-11-14', [a(), a({id: 'a2'})])).toBe(msg);
  });
  it('picks the matching assignment and limits long text', () => {
    expect(assignmentFor([a(), a({id: 'a2', centre_id: 'c2'})], 'c2', '2026-11-14').map(x => x.id)).toEqual(['a2']);
    expect(validateVisit(form({feedback: 'x'.repeat(2001)}), '2026-11-14', [a()])).toContain('2,000');
  });
});
