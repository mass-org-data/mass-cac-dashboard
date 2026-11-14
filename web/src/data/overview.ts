// Overview data service. Framework-free so it can be tested with a fake rpc.
// Uses the same server reports as the current Overview: one all-centre reviewed_chart_metrics report for the
// scorecards, grade, gender and centre comparison; two more for the shift chart; and one batched
// reviewed_attendance_series call for the monthly line (falling back to one report per month on older backends).
// Heavy reports run through a two-at-a-time queue so they never saturate the database.
import {createLimiter} from '../../../src/live/limiter.js';
import {reportingDay, window_ as monthWindow} from '../lib/dates';
import type {Rpc} from '../session/backend';

export interface Selection {month: string; centres: string[]; shift: string | null; grade: string | null; gender: string | null}
export interface Environment {yearId: string; today: string; fromQuarter: number; toQuarter: number; months: string[]; hasSeries: boolean}

export interface QuarterStat {quarter: number; n: number; mean: number | null; above20?: number; low?: number; developing?: number; good?: number; strong?: number; precision_review?: number}
export interface RoundChange {n: number; meanChange: number | null; earlierMean: number | null; laterMean: number | null; improved: number; unchanged: number; declined: number; ambiguous?: number}
export interface CentreStat {id: string; children: number; attendance: {p: number; a: number; l: number; excluded: number; percentage: number | null}; quarters: QuarterStat[]}
export interface Report {
  children: number;
  grades: Record<string, number>;
  genders: Record<string, number>;
  attendance: {p: number; a: number; l: number; excluded: number; percentage: number | null};
  quarters: QuarterStat[];
  changes?: RoundChange | null;
  centres: CentreStat[];
}
export type Series = Record<string, number | null>;
export interface ShiftCounts {Morning: number | null; Evening: number | null}

export const FUTURE_NOTICE = 'Future reporting periods have no verified observations.';
export const isFutureMonth = (month: string, today: string) => month > today.slice(0, 7);

export function createOverviewService(rpc: Rpc, limit: (job: () => Promise<unknown>) => Promise<unknown> = createLimiter(2)) {
  const cache = new Map<string, Promise<unknown>>();
  const remember = <T>(key: string, load: () => Promise<T>): Promise<T> => {
    if (!cache.has(key)) {
      const promise = load();
      cache.set(key, promise);
      promise.catch(() => { if (cache.get(key) === promise) cache.delete(key); }); // a failure can be retried
    }
    return cache.get(key) as Promise<T>;
  };
  const queued = <T>(job: () => Promise<T>) => limit(job as () => Promise<unknown>) as Promise<T>;

  function report(selection: Selection, env: Environment): Promise<Report> {
    const {from, until} = monthWindow(selection.month);
    const key = JSON.stringify(['report', env.yearId, env.today, env.fromQuarter, env.toQuarter, selection]);
    return remember(key, () => queued(() => rpc<Report>('reviewed_chart_metrics', {
      p_centres: selection.centres, p_on: reportingDay(selection.month, env.today), p_from: from, p_until: until, p_year: env.yearId,
      p_grade: selection.grade, p_shift: selection.shift, p_gender: selection.gender, p_earlier: env.fromQuarter, p_later: env.toQuarter,
    })));
  }

  async function shifts(selection: Selection, env: Environment): Promise<ShiftCounts> {
    const count = async (shift: 'Morning' | 'Evening') => (await report({...selection, shift, grade: null, gender: null}, env)).children;
    const [Morning, Evening] = await Promise.all([count('Morning'), count('Evening')]);
    return {Morning, Evening};
  }

  function series(selection: Selection, env: Environment): Promise<Series> {
    const key = JSON.stringify(['series', env.yearId, env.today, selection.centres, selection.grade, selection.shift, selection.gender]);
    return remember(key, async () => {
      const elapsed = env.months.filter(month => !isFutureMonth(month, env.today));
      if (env.hasSeries) {
        const rows = await queued(() => rpc<Array<{month: string; percentage: number | string | null}>>('reviewed_attendance_series', {
          p_centres: selection.centres, p_year: env.yearId, p_today: env.today, p_grade: selection.grade, p_shift: selection.shift, p_gender: selection.gender,
        }));
        return Object.fromEntries(rows.map(row => [row.month, row.percentage === null ? null : Number(row.percentage)]));
      }
      // Older backend: one full report per month, still two at a time.
      const reports = await Promise.all(elapsed.map(month => report({...selection, month}, env)));
      return Object.fromEntries(elapsed.map((month, index) => [month, reports[index].attendance.percentage === null ? null : Number(reports[index].attendance.percentage)]));
    });
  }

  return {report, shifts, series, clear: () => cache.clear()};
}

export type OverviewService = ReturnType<typeof createOverviewService>;
