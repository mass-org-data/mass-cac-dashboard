import {useCallback, useEffect, useMemo, useState} from 'react';
import {AsyncState, type LoadState} from '../components/AsyncState';
import {ChartCard} from '../components/ChartCard';
import {LineChart} from '../components/charts/LineChart';
import {DataTable, type Column} from '../components/DataTable';
import {Scorecard, type ScorecardState} from '../components/Scorecard';
import {type OverviewService, type Report} from '../data/overview';
import {academicMonths, monthShort, todayIst} from '../lib/dates';
import {formatCount, formatPercent} from '../lib/format';
import {combineMonthlyAttendance} from '../../../src/live/leadership-report.js';
import {sharedOverview} from '../data/shared';
import type {LiveBackend, References} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';
import {createTableService, type TableRequest, type TableService} from '../tables/service';
import {useServerTable} from '../tables/useServerTable';
import {useI18n} from '../i18n/I18n';

type Slice<T> = {status: 'loading'} | {status: 'ready'; value: T} | {status: 'error'; message: string};
const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'This could not be loaded.');
const asState = <T,>(slice: Slice<T>): LoadState => slice.status;
const cardState = <T,>(slice: Slice<T>): ScorecardState => slice.status;
type Combined = {p: number; a: number; l: number; loaded: number; percentage: number | null};
const combine = combineMonthlyAttendance as (values: Array<{attendance?: {p: number; a: number; l: number}} | null | undefined>) => Combined;

interface Loaded {months: string[]; reports: Array<Report | null>; failed: number}
interface Line {id: string; name: string; donor: string; students: number | null; p: number | null; a: number | null; l: number | null; percentage: number | null; loaded: number}
const EMPTY_DONORS: Record<string, string | null> = {};

function Select({label, value, options, onChange, allLabel}: {label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void; allLabel?: string}) {
  return (
    <label className="flex min-w-40 flex-col gap-1 text-xs font-semibold text-muted">
      {label}
      <select value={value} onChange={event => onChange(event.target.value)} className="min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink">
        {allLabel ? <option value="">{allLabel}</option> : null}
        {options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}
      </select>
    </label>
  );
}

export function AnnualDonor({backend, context, role, overview: injected, tables: injectedTables}: {backend: LiveBackend; context: ProgrammeContext; role: string; overview?: OverviewService; tables?: TableService}) {
  const {t} = useI18n();
  const overview = useMemo(() => injected ?? sharedOverview(backend), [backend, injected]);
  const tables = useMemo(() => injectedTables ?? createTableService(backend.rpc), [backend, injectedTables]);
  const today = useMemo(() => todayIst(), []);
  const [boot, setBoot] = useState<Slice<{refs: References; donors: Record<string, string | null>}>>({status: 'loading'});
  const [bootAttempt, setBootAttempt] = useState(0);
  const [filters, setFilters] = useState({year: '', donor: ''});
  const [data, setData] = useState<Slice<Loaded>>({status: 'loading'});
  const [refreshKey, setRefreshKey] = useState(0);
  const leadership = role === 'Leadership';

  useEffect(() => {
    if (!leadership) return;
    let live = true;
    setBoot({status: 'loading'});
    Promise.all([backend.readReferences(), backend.readCapabilities(), backend.readDirectory().catch(() => null)]).then(([refs, capabilities, directory]) => {
      if (!live) return;
      if (!capabilities.reviewedCharts) { setBoot({status: 'error', message: t('donor.backendDisabled')}); return; }
      setBoot({status: 'ready', value: {refs, donors: directory ? Object.fromEntries(directory.map(row => [row.centre_id, row.donor_label ?? null])) : {}}});
    }).catch(error => { if (live) setBoot({status: 'error', message: messageOf(error)}); });
    return () => { live = false; };
  }, [backend, bootAttempt, leadership, t]);

  const refs = boot.status === 'ready' ? boot.value.refs : null;
  const donors = boot.status === 'ready' ? boot.value.donors : EMPTY_DONORS;
  const scope = context.centres;
  const years = useMemo(() => [...(refs?.academic_years ?? [])].sort((a, b) => b.starts_on.localeCompare(a.starts_on)), [refs]);
  const year = years.find(y => y.id === filters.year) ?? years.find(y => y.starts_on <= today && today < y.ends_before) ?? years[0];
  const donorNames = useMemo(() => [...new Set(scope.map(c => donors[c.id]).filter((d): d is string => Boolean(d)))].sort(), [scope, donors]);
  const selected = useMemo(() => scope.filter(c => !filters.donor || donors[c.id] === filters.donor), [scope, filters.donor, donors]);
  const centreIds = useMemo(() => selected.map(c => c.id), [selected]);
  const key = JSON.stringify([year?.id, selected.map(c => c.id)]);

  useEffect(() => {
    if (!year || boot.status !== 'ready') return;
    let live = true;
    setData({status: 'loading'});
    const all = academicMonths(year.starts_on);
    const months = all.filter(month => month <= today.slice(0, 7));
    const ids = selected.map(c => c.id);
    if (!ids.length) { setData({status: 'error', message: t('assessment.noCentres')}); return; }
    const env = {yearId: year.id, today, fromQuarter: 1, toQuarter: 2, months: all, hasSeries: false};
    // A heavy report can hit the database statement timeout while it is cold; one automatic retry (the failed call is not cached).
    const load = (month: string) => overview.report({month, centres: ids, shift: null, grade: null, gender: null}, env);
    // One batched call for the whole year when the database has it; otherwise one report per month (older databases).
    const batched = overview.monthlyByCentre ? overview.monthlyByCentre(ids, env).catch(() => null) : Promise.resolve(null);
    batched.then(byMonth => (byMonth
      ? months.map(month => ({status: 'fulfilled', value: byMonth[month] ?? null}) as PromiseSettledResult<Report | null>)
      : Promise.allSettled(months.map(month => load(month).catch(() => load(month)))))).then(results => {
      if (!live) return;
      const reports = results.map(r => (r.status === 'fulfilled' ? r.value : null));
      const failed = reports.filter(r => r === null).length;
      if (months.length && failed === months.length) { setData({status: 'error', message: messageOf((results[0] as PromiseRejectedResult).reason)}); return; }
      setData({status: 'ready', value: {months, reports, failed}});
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, key, refreshKey, boot.status]);

  const loaded = data.status === 'ready' ? data.value : null;
  const annual = loaded ? combine(loaded.reports) : null;
  const reportingReport = loaded ? [...loaded.reports].reverse().find(r => r !== null) ?? null : null;
  const points = loaded ? loaded.months.map((month, i) => ({label: monthShort(month), value: loaded.reports[i]?.attendance.percentage == null ? null : Number(loaded.reports[i]!.attendance.percentage)})) : [];
  const columns = useMemo<Column<Line>[]>(() => [
    {id: 'name', header: t('common.centre'), value: r => r.name},
    {id: 'donor', header: t('donor.currentAssociation'), value: r => r.donor},
    {id: 'students', header: t('donor.studentsDate'), value: r => r.students, numeric: true},
    {id: 'p', header: t('donor.annualPresent'), value: r => r.p, numeric: true},
    {id: 'a', header: t('donor.annualAbsent'), value: r => r.a, numeric: true},
    {id: 'l', header: t('donor.annualLeave'), value: r => r.l, numeric: true},
    {id: 'percentage', header: t('donor.annualAttendance'), value: r => (r.percentage === null ? null : Number(r.percentage.toFixed(1))), numeric: true, cell: r => (r.percentage === null ? t('common.unknown') : formatPercent(r.percentage))},
    {id: 'loaded', header: t('donor.loadedMonths'), value: r => r.loaded, numeric: true},
  ], [t]);
  const tableContext = useMemo(() => ({year: year?.id ?? '', today}), [year?.id, today]);
  const loadCentres = useCallback((request: TableRequest) => year?.id ? tables.page<Line>('annual_centres', centreIds, tableContext, request) : Promise.resolve({rows: [], total: 0}), [tables, centreIds, tableContext, year?.id]);
  const centreTable = useServerTable({key: JSON.stringify([year?.id, centreIds]), load: loadCentres, initialSort: 'name', refreshKey});

  if (!leadership) return <p role="note" className="rounded-md bg-brand-soft p-4 text-sm">{t('donor.leadershipOnly')}</p>;
  if (boot.status !== 'ready') return <AsyncState state={boot.status === 'error' ? 'error' : 'loading'} errorMessage={boot.status === 'error' ? boot.message : undefined} onRetry={() => setBootAttempt(n => n + 1)} loadingLabel={t('donor.preparing')} rows={5} />;
  const msg = data.status === 'error' ? data.message : undefined;
  const donorLabel = filters.donor || t('donor.allCurrent');

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">{t('donor.intro')}</p>
      <div role="group" aria-label={t('donor.filters')} className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-3">
        <Select label={t('donor.academicYear')} value={year?.id ?? ''} options={years.map(y => [y.id, `${y.starts_on.slice(0, 4)}–${y.ends_before.slice(0, 4)}`])} onChange={value => setFilters(f => ({...f, year: value}))} />
        <Select label={t('overview.donor')} value={filters.donor} options={donorNames.map(d => [d, d])} allLabel={t('donor.allDonors')} onChange={value => setFilters(f => ({...f, donor: value}))} />
      </div>

      <section aria-label={t('donor.reportCover')} className="rounded-lg border border-line bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">MASS · {t('app.centres')}</p>
        <h2 className="text-xl font-bold">{donorLabel}</h2>
        <p className="text-sm text-muted">{t('donor.coverMeta', {year: year ? t('donor.yearRange', {from: year.starts_on, until: year.ends_before}) : t('donor.selectedYear'), count: selected.length})}</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Scorecard reference="7.1" label={t('donor.selectionCentres')} value={formatCount(selected.length)} />
        <Scorecard reference="7.2" label={t('donor.studentsEnrolled')} value={reportingReport ? formatCount(reportingReport.children) : null} state={data.status === 'ready' && !reportingReport ? 'unavailable' : cardState(data)} message={msg} />
        <Scorecard reference="7.3" label={t('donor.recordedAttendance')} value={annual ? formatPercent(annual.percentage) : null} state={data.status === 'ready' && annual?.percentage === null ? 'unavailable' : cardState(data)} message={msg ?? t('donor.noAttendance')} />
        <Scorecard reference="7.4" label={t('donor.recordedMonths')} value={annual ? formatCount(annual.loaded) : null} state={cardState(data)} message={msg} />
      </div>
      {loaded && loaded.failed > 0 ? <p role="alert" className="rounded-md bg-warn-soft p-3 text-sm text-warn">{t('donor.partial', {failed: loaded.failed, total: loaded.months.length})} <button type="button" className="font-semibold underline" onClick={() => setRefreshKey(k => k + 1)}>{t('common.retry')}</button></p> : null}

      <ChartCard reference="7.5" title={t('donor.attendanceTime')} subtitle={t('donor.attendanceHelp')} state={asState(data)} errorMessage={msg} onRetry={() => setRefreshKey(k => k + 1)}>
        <LineChart points={points} description={t('donor.attendanceDescription')} />
      </ChartCard>

      <DataTable<Line> reference="7.6" caption={t('donor.centreComparison')} columns={columns} data={centreTable.rows} getRowId={r => r.id} exportName={`MASS-annual-donor-summary-${year?.starts_on.slice(0, 4) ?? 'year'}`}
        state={centreTable.result.status} errorMessage={centreTable.error} emptyMessage={t('assessment.noCentres')} onRetry={centreTable.retry} server={centreTable.server} />
      <p className="rounded-md bg-brand-soft p-3 text-sm"><strong>{t('donor.exportLead')}</strong> {t('donor.exportBody')}</p>
      <p className="text-xs text-muted">{t('donor.footnote')}</p>
    </div>
  );
}
