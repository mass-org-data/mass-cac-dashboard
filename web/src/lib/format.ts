// Missing values stay unknown. Never turn "no record" into zero.
export const UNKNOWN = '—';
let locale = 'en-IN';
let notRecorded = 'Not recorded';

/** Updated by the interface language provider. Latin numerals are retained in both languages. */
export function setFormatLanguage(language: 'en' | 'kn', missing: string): void {
  locale = language === 'kn' ? 'kn-IN-u-nu-latn' : 'en-IN';
  notRecorded = missing;
}
export const formatLocale = (): string => locale;

export function formatCount(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString(locale) : UNKNOWN;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${new Intl.NumberFormat(locale, {minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false}).format(value)}%` : UNKNOWN;
}

const asDate = (value: string): Date => new Date(/^\d{4}-\d{2}-\d{2} /.test(value) ? value.replace(' ', 'T') : value);

/** Human-readable audit timestamp. The database value remains the table's sort value. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return notRecorded;
  const date = asDate(value);
  if (!Number.isFinite(date.getTime())) return notRecorded;
  return new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata'}).format(date);
}

/** Compact relative time for register rows, using the largest useful unit. */
export function formatRelativeTime(value: string | null | undefined, now = new Date()): string {
  if (!value) return notRecorded;
  const date = asDate(value);
  if (!Number.isFinite(date.getTime())) return notRecorded;
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
  return new Intl.RelativeTimeFormat(locale, {numeric: 'always'}).format(Math.round(amount), unit);
}
