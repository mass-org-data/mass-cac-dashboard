// Missing values stay unknown. Never turn "no record" into zero.
export const UNKNOWN = '—';

export function formatCount(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-IN') : UNKNOWN;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}%` : UNKNOWN;
}
