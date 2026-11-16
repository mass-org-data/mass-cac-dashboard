// Calendar helpers. Dates are Asia/Kolkata calendar days, as in the current application.
import {liveToday, monthWindow} from '../../../src/live/model.js';
import {reportingOn} from '../../../src/live/population.js';

export const todayIst = (): string => liveToday();
export const window_ = (month: string): {from: string; until: string} => monthWindow(month);
export const reportingDay = (month: string, today: string): string => reportingOn({month, today});

export const monthLabel = (month: string): string => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-GB', {month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata'});
export const monthShort = (month: string): string => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-GB', {month: 'short', timeZone: 'Asia/Kolkata'});

/** The twelve months of an academic year (April to March), as 'YYYY-MM'. */
export function academicMonths(startsOn: string): string[] {
  return Array.from({length: 12}, (_, index) => {
    const date = new Date(`${startsOn}T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + index);
    return date.toISOString().slice(0, 7);
  });
}
