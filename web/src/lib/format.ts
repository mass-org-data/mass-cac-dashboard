// Missing values stay unknown. Never turn "no record" into zero.
export const UNKNOWN = '—';

export function formatCount(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-IN') : UNKNOWN;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}%` : UNKNOWN;
}

const asDate = (value: string): Date => new Date(/^\d{4}-\d{2}-\d{2} /.test(value) ? value.replace(' ', 'T') : value);

/** Human-readable audit timestamp. The database value remains the table's sort value. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const date = asDate(value);
  if (!Number.isFinite(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-IN', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata'}).format(date);
}

/** Compact relative time for register rows, using the largest useful unit. */
export function formatRelativeTime(value: string | null | undefined, now = new Date()): string {
  if (!value) return 'Not recorded';
  const date = asDate(value);
  if (!Number.isFinite(date.getTime())) return 'Not recorded';
  const seconds = (date.getTime() - now.getTime()) / 1000;
  const absolute = Math.abs(seconds);
  const [amount, unit]: [number, Intl.RelativeTimeFormatUnit] = absolute < 60
    ? [seconds, 'second']
    : absolute < 3600
      ? [seconds / 60, 'minute']
      : absolute < 86400
        ? [seconds / 3600, 'hour']
        : absolute < 2592000
          ? [seconds / 86400, 'day']
          : absolute < 31536000
            ? [seconds / 2592000, 'month']
            : [seconds / 31536000, 'year'];
  return new Intl.RelativeTimeFormat('en', {numeric: 'always'}).format(Math.round(amount), unit);
}
