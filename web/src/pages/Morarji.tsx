import {useCallback, useEffect, useMemo, useState} from 'react';
import {AsyncState, type LoadState} from '../components/AsyncState';
import {ChartCard} from '../components/ChartCard';
import {ColumnChart} from '../components/charts/ColumnChart';
import {DataTable, type Column} from '../components/DataTable';
import {Scorecard, type ScorecardState} from '../components/Scorecard';
import {type MorarjiService} from '../morarji/service';
import {type ProfilesService} from '../profiles/service';
import {type MorarjiCohort, type OverviewService, type Report} from '../data/overview';
import {academicMonths, todayIst} from '../lib/dates';
import {formatCount} from '../lib/format';
import {sharedOverview} from '../data/shared';
import type {Capabilities, LiveBackend, References} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';
import {createTableService, type TableRequest, type TableService} from '../tables/service';
import {useServerTable} from '../tables/useServerTable';
import {useI18n} from '../i18n/I18n';

type Slice<T> = {status: 'loading'} | {status: 'ready'; value: T} | {status: 'error'; message: string};
const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'This could not be loaded.');
const asState = <T,>(slice: Slice<T>): LoadState => slice.status;
const cardState = <T,>(slice: Slice<T>): ScorecardState => slice.status;
const years = (range: {starts_on: string; ends_before: string}) => `${range.starts_on.slice(0, 4)}–${range.ends_before.slice(0, 4)}`;

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

interface FollowUp {id: string; cohort: string; name: string | null; studentId: string; centre: string; applied: boolean | null; attended: boolean | null; result: string; school: string | null}
interface CentreLine {id: string; name: string; members: number; applied: number; attended: number; passed: number}

export function Morarji({backend, context, role, service: _injected, profiles: _injectedProfiles, overview: injectedOverview, tables: injectedTables}: {backend: LiveBackend; context: ProgrammeContext; role: string; service?: MorarjiService; profiles?: ProfilesService; overview?: OverviewService; tables?: TableService}) {
  const {t} = useI18n();
  const overview = useMemo(() => injectedOverview ?? sharedOverview(backend), [backend, injectedOverview]);
  const tables = useMemo(() => injectedTables ?? createTableService(backend.rpc), [backend, injectedTables]);
  const today = useMemo(() => todayIst(), []);
  const [boot, setBoot] = useState<Slice<{refs: References; capabilities: Capabilities}>>({status: 'loading'});
  const [bootAttempt, setBootAttempt] = useState(0);
  const [filters, setFilters] = useState({cohort: '', centre: ''});
  const [report, setReport] = useState<Slice<Report>>({status: 'loading'});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let live = true;
    setBoot({status: 'loading'});
    Promise.all([backend.readReferences(), backend.readCapabilities()]).then(([refs, capabilities]) => {
      if (!live) return;
      if (!capabilities.reviewedCharts) { setBoot({status: 'error', message: t('morarji.backendDisabled')}); return; }
      setBoot({status: 'ready', value: {refs, capabilities}});
    }).catch(error => { if (live) setBoot({status: 'error', message: messageOf(error)}); });
    return () => { live = false; };
  }, [backend, bootAttempt, t]);

  const scope = useMemo(() => context.centres.filter(c => c.roles.includes(role)), [context, role]);
  const nameOf = useMemo(() => new Map(context.centres.map(c => [c.id, c.label])), [context]);
  const selected = useMemo(() => scope.filter(c => !filters.centre || c.id === filters.centre), [scope, filters.centre]);
  const refs = boot.status === 'ready' ? boot.value.refs : null;
  const year = refs ? (refs.academic_years.find(y => y.starts_on <= today && today < y.ends_before) ?? [...refs.academic_years].sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0]) : undefined;
  const months = useMemo(() => (year ? academicMonths(year.starts_on) : []), [year]);
  const cohorts = useMemo(() => [...(refs?.programme_cohorts ?? [])].sort((a, b) => b.label.localeCompare(a.label)), [refs]);
  const cohortLabel = filters.cohort || cohorts[0]?.label || '';
  const yearLabelOf = useMemo(() => new Map((refs?.academic_years ?? []).map(y => [y.id, years(y)])), [refs]);
  const centreIds = useMemo(() => selected.map(c => c.id), [selected]);
  const key = JSON.stringify(centreIds);
  const operational = role !== 'Leadership';

  useEffect(() => {
    if (!year || boot.status !== 'ready') return;
    let live = true;
    setReport({status: 'loading'});
    if (!centreIds.length) { setReport({status: 'error', message: t('assessment.noCentres')}); return; }
    overview.report({month: today.slice(0, 7), centres: centreIds, shift: null, grade: null, gender: null}, {yearId: year.id, today, fromQuarter: 1, toQuarter: 2, months, hasSeries: false})
      .then(value => { if (live) setReport({status: 'ready', value}); }).catch(error => { if (live) setReport({status: 'error', message: messageOf(error)}); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, key, refreshKey, boot.status]);

  const stats = report.status === 'ready' ? report.value : null;
  const cohortStat: MorarjiCohort | undefined = stats?.morarji?.find(c => c.cohort === cohortLabel);
  const pending = cohortStat ? (cohortStat.knownPassed ? cohortStat.members - cohortStat.knownPassed : null) : null;
  const trend = (stats?.morarjiYears ?? []).map(y => ({label: yearLabelOf.get(y.academicYear) ?? y.academicYear, value: y.passed})).sort((a, b) => a.label.localeCompare(b.label));

  const cohortColumns = useMemo<Column<MorarjiCohort>[]>(() => [
    {id: 'cohort', header: t('morarji.cohort'), value: r => r.cohort},
    {id: 'members', header: t('morarji.inCohort'), value: r => r.members, numeric: true},
    {id: 'applied', header: t('morarji.applied'), value: r => r.applied, numeric: true},
    {id: 'attended', header: t('morarji.tookExam'), value: r => r.attended, numeric: true},
    {id: 'passed', header: t('morarji.passed'), value: r => r.passed, numeric: true},
  ], [t]);
  const centreColumns = useMemo<Column<CentreLine>[]>(() => [
    {id: 'name', header: t('common.centre'), value: r => r.name},
    {id: 'members', header: t('morarji.inCohort'), value: r => r.members, numeric: true},
    {id: 'attended', header: t('morarji.tookExam'), value: r => r.attended, numeric: true},
    {id: 'passed', header: t('morarji.passed'), value: r => r.passed, numeric: true},
  ], [t]);
  const followColumns = useMemo<Column<FollowUp>[]>(() => [
    {id: 'student', header: t('common.student'), value: r => r.name ?? t('common.nameMissing'), cell: r => <>{r.name ?? t('common.nameMissing')}<span className="block text-xs text-muted">{r.studentId}</span></>},
    {id: 'centre', header: t('common.centre'), value: r => nameOf.get(r.centre) ?? r.centre},
    {id: 'applied', header: t('morarji.application'), value: r => (r.applied === null ? t('common.notRecorded') : r.applied ? t('morarji.applied') : t('morarji.notApplied'))},
    {id: 'attended', header: t('morarji.tookExam'), value: r => r.attended === null ? t('common.notRecorded') : t(r.attended ? 'common.yes' : 'common.no')},
    {id: 'result', header: t('morarji.examResult'), value: r => r.result},
    {id: 'school', header: t('morarji.school'), value: r => r.school ?? t('common.notRecorded')},
  ], [nameOf, t]);
  const cohort = cohorts.find(c => c.label === cohortLabel);
  const emptyContext = useMemo(() => ({}), []);
  const cohortContext = useMemo(() => ({cohort: cohort?.id ?? ''}), [cohort?.id]);
  const loadCohorts = useCallback((request: TableRequest) => tables.page<MorarjiCohort>('morarji_cohorts', centreIds, emptyContext, request), [tables, centreIds, emptyContext]);
  const loadCentres = useCallback((request: TableRequest) => cohort?.id ? tables.page<CentreLine>('morarji_centres', centreIds, cohortContext, request) : Promise.resolve({rows: [], total: 0}), [tables, centreIds, cohortContext, cohort?.id]);
  const loadFollowUp = useCallback((request: TableRequest) => cohort?.id ? tables.page<FollowUp>('morarji_followup', centreIds, cohortContext, request) : Promise.resolve({rows: [], total: 0}), [tables, centreIds, cohortContext, cohort?.id]);
  const cohortTable = useServerTable({key: `${key}:cohorts`, load: loadCohorts, initialSort: 'cohort', refreshKey});
  const centreTable = useServerTable({key: `${key}:${cohort?.id}:centres`, load: loadCentres, initialSort: 'name', refreshKey});
  const followTable = useServerTable({key: `${key}:${cohort?.id}:follow`, load: loadFollowUp, initialSort: 'student', refreshKey});

  if (boot.status !== 'ready') return <AsyncState state={boot.status === 'error' ? 'error' : 'loading'} errorMessage={boot.status === 'error' ? boot.message : undefined} onRetry={() => setBootAttempt(n => n + 1)} loadingLabel={t('morarji.preparing')} rows={5} />;
  const msg = report.status === 'error' ? report.message : undefined;
  const none = report.status === 'ready' && (stats?.morarji?.length ?? 0) === 0 && cohorts.length === 0;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">{t('morarji.intro', {followup: operational ? t('morarji.followupSuffix') : ''})}</p>
      <div role="group" aria-label={t('morarji.filters')} className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-3">
        {cohorts.length ? <Select label={t('morarji.cohortYear')} value={cohortLabel} options={cohorts.map(c => [c.label, c.label])} onChange={value => setFilters(f => ({...f, cohort: value}))} /> : null}
        {scope.length > 1 ? <Select label={t('common.centre')} value={filters.centre} options={scope.map(c => [c.id, c.label])} allLabel={t('common.allCentres')} onChange={value => setFilters(f => ({...f, centre: value}))} /> : null}
      </div>
      {none ? <p role="note" className="rounded-md bg-brand-soft p-4 text-sm">{t('morarji.noneImported')}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Scorecard reference="6.1" label={t('morarji.childrenCohort')} value={cohortStat ? formatCount(cohortStat.members) : null} state={none || (stats && !cohortStat) ? 'unavailable' : cardState(report)} message={msg ?? t('morarji.noCohort')} />
        <Scorecard reference="6.2" label={t('morarji.tookExam')} value={cohortStat?.attended != null ? formatCount(cohortStat.attended) : null} state={stats && cohortStat?.attended == null ? 'unavailable' : cardState(report)} message={msg ?? t('common.notRecorded')} />
        <Scorecard reference="6.3" label={t('morarji.childrenPassed')} value={cohortStat?.passed != null ? formatCount(cohortStat.passed) : null} state={stats && cohortStat?.passed == null ? 'unavailable' : cardState(report)} message={msg ?? t('common.notRecorded')} />
        <Scorecard reference="6.4" label={t('morarji.resultsPending')} value={pending === null ? null : formatCount(pending)} state={stats && pending === null ? 'unavailable' : cardState(report)} message={msg ?? t('common.notRecorded')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <ChartCard reference="6.5" title={t('morarji.yearOnYear')} subtitle={t('morarji.yearOnYearHelp')} state={asState(report)} errorMessage={msg} onRetry={() => setRefreshKey(k => k + 1)} emptyMessage={t('morarji.noOutcomes')}>
          {trend.length ? <><ColumnChart axis={t('morarji.passedAxis')} description={t('morarji.passedDescription')} items={trend} /><p className="mt-2 text-xs text-muted">{t('morarji.cohortCaution')}</p></> : <p className="text-sm text-muted">{t('morarji.noOutcomes')}</p>}
        </ChartCard>
        <DataTable<MorarjiCohort> reference="6.6" caption={t('morarji.cohortSizes')} columns={cohortColumns} data={cohortTable.rows} getRowId={r => r.cohortId} exportName="MASS-morarji-cohorts" state={cohortTable.result.status} errorMessage={cohortTable.error} emptyMessage={t('morarji.noOutcomes')} onRetry={cohortTable.retry} server={cohortTable.server} />
      </div>

      {operational ? (
        <>
          <DataTable<CentreLine> reference="6.7" caption={t('morarji.byCentre')} columns={centreColumns} data={centreTable.rows} getRowId={r => r.id} exportName={`MASS-morarji-by-centre-${cohortLabel}`} state={centreTable.result.status} errorMessage={centreTable.error} emptyMessage={t('morarji.noRecords')} onRetry={centreTable.retry} server={centreTable.server} />
          <DataTable<FollowUp> reference="6.8" caption={t('morarji.followup')} columns={followColumns} data={followTable.rows} getRowId={r => r.id} exportName={`MASS-morarji-follow-up-${cohortLabel}`} state={followTable.result.status} errorMessage={followTable.error} emptyMessage={t('morarji.noRecords')} onRetry={followTable.retry} server={followTable.server} />
        </>
      ) : <p className="text-xs text-muted">{t('morarji.leadership')}</p>}
      <p className="text-xs text-muted">{t('morarji.footnote')}</p>
    </div>
  );
}
