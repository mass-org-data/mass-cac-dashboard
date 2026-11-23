import {describe, expect, it} from 'vitest';
import {formatDateTime, formatRelativeTime} from './format';

describe('audit timestamp formatting', () => {
  const now = new Date('2026-11-17T12:00:00Z');

  it('uses compact relative units', () => {
    expect(formatRelativeTime('2026-11-17T11:58:00Z', now)).toBe('2 minutes ago');
    expect(formatRelativeTime('2026-11-17T07:00:00Z', now)).toBe('5 hours ago');
    expect(formatRelativeTime('2026-11-16T12:00:00Z', now)).toBe('1 day ago');
  });

  it('uses a readable full timestamp and preserves unknown values', () => {
    expect(formatDateTime('2026-11-17T12:00:00Z')).toMatch(/17 Nov 2026/);
    expect(formatRelativeTime(null, now)).toBe('Not recorded');
    expect(formatDateTime('not-a-date')).toBe('Not recorded');
  });
});
