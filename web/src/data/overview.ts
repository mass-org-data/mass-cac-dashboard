// Overview data service. Framework-free so it can be tested with a fake rpc.
// Uses the same server reports as the current Overview: one all-centre reviewed_chart_metrics report for the
// scorecards, grade, gender and centre comparison; two more for the shift chart; and one batched
// reviewed_attendance_series call for the monthly line (falling back to one report per month on older backends).
// Heavy reports run through a two-at-a-time queue so they never saturate the database.
import {createLimiter} from '../../../src/live/limiter.js';
import {reportingDay, window_ as monthWindow} from '../lib/dates';
import {CACHE_TTL_MS, memoise, type Rpc} from '../session/backend';
import {chunk, isMissingFunction} from '../lib/batched';

export interface Selection {month: string; centres: string[]; shift: string | null; grade: string | null; gender: string | null}
export interface Environment {yearId: string; today: string; fromQuarter: number; toQuarter: number; months: string[]; hasSeries: boolean}

export interface QuarterStat {quarter: number; n: number; mean: number | null; above20?: number; low?: number; developing?: number; good?: number; strong?: number; precision_review?: number}
export interface MorarjiCohort {cohort: string; cohortId: string; academicYear: string | null; members: number; passed: number | null; knownPassed: number; applied: number | null; attended: number | null}
export interface MorarjiYear {academicYear: string; members: number; passed: number | null; knownPassed: number}
export interface RoundChange {n: number; meanChange: number | null; earlierMean: number | null; laterMean: number | null; improved: number; unchanged: number; declined: number; ambiguous?: number}
export interface CentreStat {id: string; children: number; attendance: {p: number; a: number; l: number; excluded: number; percentage: number | null}; quarters: QuarterStat[]}
export interface Report {
  children: number;
  grades: Record<string, number>;
  genders: Record<string, number>;
  attendance: {p: number; a: number; l: number; excluded: number; percentage: number | null};
  quarters: QuarterStat[];
  changes?: RoundChange | null;
  morarji?: MorarjiCohort[];
  morarjiYears?: MorarjiYear[];
  centres: CentreStat[];
}
export type Series = Record<string, number | null>;
export interface ShiftCounts {Morning: number | null; Evening: number | null}

export interface CentreMonthRow {month: string; centre_id: string; children: number; p: number; a: number; l: number; excluded: number}
const rate = (p: number, a: number, l: number) => (p + a + l > 0 ? 100 * p / (p + a + l) : null);
/** Counts are summed, never percentages: the rate is recomputed from P, A and L. */
export function toMonthlyReports(rows: CentreMonthRow[]): Record<string, Report> {
  const months = new Map<string, CentreMonthRow[]>();
  for (const row of rows) months.set(row.month, [...(months.get(row.month) ?? []), row]);
  const out: Record<string, Report> = {};
  for (const [month, list] of months) {
    const sum = (field: 'p' | 'a' | 'l' | 'excluded' | 'children') => list.reduce((total, row) => total + Number(row[field]), 0);
    const [p, a, l] = [sum('p'), sum('a'), sum('l')];
    out[month] = {
      children: sum('children'), grades: {}, genders: {}, quarters: [], attendance: {p, a, l, excluded: sum('excluded'), percentage: rate(p, a, l)},
      centres: list.map(row => ({id: row.centre_id, children: Number(row.children), quarters: [], attendance: {p: Number(row.p), a: Number(row.a), l: Number(row.l), excluded: Number(row.excluded), percentage: rate(Number(row.p), Number(row.a), Number(row.l))}})),
    };
  }
  return out;
}

export const FUTURE_NOTICE = 'Future reporting periods have no verified observations.';
export const isFutureMonth = (month: string, today: string) => month > today.slice(0, 7);

export function createOverviewService(rpc: Rpc, limit: (job: () => Promise<unknown>) => Promise<unknown> = createLimiter(2), now: () => number = Date.now) {
  // Kept for five minutes, then read again; a failure is forgotten so it can be retried; saves call clear().
  const cache = new Map<string, {at: number; value: Promise<unknown>}>();
  const remember = <T>(key: string, load: () => Promise<T>): Promise<T> => memoise(cache, key, load, now, CACHE_TTL_MS);
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

  /** Annual donor page: attendance counts per centre and month in one call instead of one full report per month.
   *  Returns one report-shaped object per month (only the attendance and centre fields the annual page reads), keyed by
   *  month, or null when the database does not have the batched function (the caller then loads a report per month). */
  let byCentreMonth = true;
  async function monthlyByCentre(centres: string[], env: Pick<Environment, 'yearId' | 'today'>): Promise<Record<string, Report> | null> {
    if (!byCentreMonth) return null;
    const key = JSON.stringify(['by-centre-month', env.yearId, env.today, centres]);
    try {
      return await remember(key, async () => {
        const parts = await Promise.all(chunk(centres).map(part => queued(() => rpc<CentreMonthRow[]>('reviewed_attendance_by_centre_month', {p_centres: part, p_year: env.yearId, p_today: env.today, p_grade: null, p_shift: null, p_gender: null}))));
        return toMonthlyReports(parts.flat());
      });
    } catch (error) {
      if (!isMissingFunction(error)) throw error;
      byCentreMonth = false;
      return null;
    }
  }

  return {report, shifts, series, monthlyByCentre, clear: () => cache.clear()};
}

export type OverviewService = ReturnType<typeof createOverviewService>;
