// Re-uses the production CSV cell escaping (quotes everything and defuses spreadsheet formulas),
// so the new interface can never export a weaker file than the current one.
import {safeCsvCell} from '../../../src/live/population.js';

export type CsvValue = string | number | boolean | null | undefined;

export function buildCsv(header: string[], rows: CsvValue[][]): string {
  return [header, ...rows].map(row => row.map(cell => safeCsvCell(cell)).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
