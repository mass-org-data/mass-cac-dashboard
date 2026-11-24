import {useCallback, useEffect, useMemo, useState} from 'react';
import {AsyncState, type LoadState} from '../components/AsyncState';
import {ChartCard} from '../components/ChartCard';
import {GroupedColumnChart} from '../components/charts/GroupedColumnChart';
import {ColumnChart} from '../components/charts/ColumnChart';
import {DataTable, type Column} from '../components/DataTable';
import {Scorecard, type ScorecardState} from '../components/Scorecard';
import {type MorarjiService, createMorarjiService} from '../morarji/service';
import {AddMorarjiDialog, OutcomeDialog} from '../morarji/MorarjiDialogs';
import {Button} from '../components/ui/button';
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
import {CentreFilter, FilterPanel, FilterSelect as Select, english} from '../components/FilterPanel';

type Slice<T> = {status: 'loading'} | {status: 'ready'; value: T} | {status: 'error'; message: string};
const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'This could not be loaded.');
const asState = <T,>(slice: Slice<T>): LoadState => slice.status;
const cardState = <T,>(slice: Slice<T>): ScorecardState => slice.status;
const years = (range: {starts_on: string; ends_before: string}) => `${range.starts_on.slice(0, 4)}–${range.ends_before.slice(0, 4)}`;


interface FollowUp {id: string; cohort: string; name: string | null; studentId: string; centre: string; applied: boolean | null; attended: boolean | null; result: string; school: string | null}
interface CentreLine {id: string; name: string; members: number; applied: number; attended: number; passed: number}

const INITIAL_FILTERS = {cohort: '', centre: ''};

export function Morarji({backend, context, role, service: injectedService, profiles: _injectedProfiles, overview: injectedOverview, tables: injectedTables}: {backend: LiveBackend; context: ProgrammeContext; role: string; service?: MorarjiService; profiles?: ProfilesService; overview?: OverviewService; tables?: TableService}) {
  const {t} = useI18n();
  const service = useMemo(() => injectedService ?? createMorarjiService(backend.rpc), [backend, injectedService]);
  const overview = useMemo(() => injectedOverview ?? sharedOverview(backend), [backend, injectedOverview]);
  const tables = useMemo(() => injectedTables ?? createTableService(backend.rpc), [backend, injectedTables]);
  const today = useMemo(() => todayIst(), []);
  const [boot, setBoot] = useState<Slice<{refs: References; capabilities: Capabilities}>>({status: 'loading'});
  const [bootAttempt, setBootAttempt] = useState(0);
  const [filters, setFilters] = useState<typeof INITIAL_FILTERS>(INITIAL_FILTERS);
  const [report, setReport] = useState<Slice<Report>>({status: 'loading'});
  const [refreshKey, setRefreshKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [notice, setNotice] = useState('');

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

  const scope = context.centres;
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
  const operational = context.capabilities?.read_operational !== false;

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

  // Chart 6.6: one group per cohort (x-axis), four bars each: in training, applied, took the exam, passed. Unknown stays unknown.
  const cohortGroups = useMemo(() => [...(stats?.morarji ?? [])].sort((a, b) => a.cohort.localeCompare(b.cohort)).map(c => ({label: c.cohort, values: [c.members, c.applied, c.attended, c.passed] as Array<number | null>})), [stats]);
  const centreColumns = useMemo<Column<CentreLine>[]>(() => [
    {id: 'name', header: t('common.centre'), value: r => r.name},
    {id: 'members', header: t('morarji.inCohort'), value: r => r.members, numeric: true},
    {id: 'attended', header: t('morarji.tookExam'), value: r => r.attended, numeric: true},
    {id: 'passed', header: t('morarji.passed'), value: r => r.passed, numeric: true},
  ], [t]);
  const writable = useMemo(() => context.centres.filter(c => c.can_write), [context]);
  const writableIds = useMemo(() => new Set(role === 'Teacher' ? [] : writable.map(c => c.id)), [writable, role]);
  const followColumns = useMemo<Column<FollowUp>[]>(() => [
    {id: 'student', header: t('common.student'), value: r => r.name ?? t('common.nameMissing'), cell: r => <>{r.name ?? t('common.nameMissing')}<span className="block text-xs text-muted">{r.studentId}</span></>},
    {id: 'centre', header: t('common.centre'), value: r => nameOf.get(r.centre) ?? r.centre},
    {id: 'applied', header: t('morarji.application'), value: r => (r.applied === null ? t('common.notRecorded') : r.applied ? t('morarji.applied') : t('morarji.notApplied'))},
    {id: 'attended', header: t('morarji.tookExam'), value: r => r.attended === null ? t('common.notRecorded') : t(r.attended ? 'common.yes' : 'common.no')},
    {id: 'result', header: t('morarji.examResult'), value: r => r.result},
    {id: 'school', header: t('morarji.school'), value: r => r.school ?? t('common.notRecorded')},
    {id: 'action', header: t('common.action'), sortable: false, value: () => t('attendance.edit'), cell: r => writableIds.has(r.centre) ? <Button variant="ghost" size="sm" onClick={() => { setNotice(''); setEditing(r); }}>{t('attendance.edit')}</Button> : null},
  ], [nameOf, writableIds, t]);
  const cohort = cohorts.find(c => c.label === cohortLabel);
  const cohortContext = useMemo(() => ({cohort: cohort?.id ?? ''}), [cohort?.id]);
  const loadCentres = useCallback((request: TableRequest) => cohort?.id ? tables.page<CentreLine>('morarji_centres', centreIds, cohortContext, request) : Promise.resolve({rows: [], total: 0}), [tables, centreIds, cohortContext, cohort?.id]);
  const loadFollowUp = useCallback((request: TableRequest) => cohort?.id ? tables.page<FollowUp>('morarji_followup', centreIds, cohortContext, request) : Promise.resolve({rows: [], total: 0}), [tables, centreIds, cohortContext, cohort?.id]);
  const centreTable = useServerTable({key: `${key}:${cohort?.id}:centres`, load: loadCentres, initialSort: 'name', refreshKey});
  const followTable = useServerTable({key: `${key}:${cohort?.id}:follow`, load: loadFollowUp, initialSort: 'student', refreshKey});

  if (boot.status !== 'ready') return <AsyncState state={boot.status === 'error' ? 'error' : 'loading'} errorMessage={boot.status === 'error' ? boot.message : undefined} onRetry={() => setBootAttempt(n => n + 1)} loadingLabel={t('morarji.preparing')} rows={5} />;
  const morarjiEnabled = boot.value.capabilities.writes?.morarji === true;
  const canWrite = writableIds.size > 0 && Boolean(cohort);
  const afterSave = async (message: string) => { overview.clear(); setRefreshKey(k => k + 1); setNotice(message); };
  const msg = report.status === 'error' ? report.message : undefined;
  const none = report.status === 'ready' && (stats?.morarji?.length ?? 0) === 0 && cohorts.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t('morarji.intro', {followup: operational ? t('morarji.followupSuffix') : ''})}</p>
        {canWrite && operational ? <Button onClick={() => { setNotice(''); setAdding(true); }}>{t('morarji.addRecord')}</Button> : null}
      </div>
      <p role="status" aria-live="polite" className={notice ? 'rounded-md bg-ok-soft p-3 text-sm text-ok' : 'sr-only'}>{notice}</p>
      <FilterPanel label={t('morarji.filters')} active={JSON.stringify(filters) !== JSON.stringify(INITIAL_FILTERS)} onClear={() => setFilters(INITIAL_FILTERS)}>
        {cohorts.length ? <Select active={filters.cohort !== ''} label={t('morarji.cohortYear')} value={cohortLabel} options={cohorts.map(c => [c.label, c.label])} onChange={value => setFilters(f => ({...f, cohort: value}))} /> : null}
        {scope.length > 1 ? <CentreFilter label={t('common.centre')} value={filters.centre} options={scope} allLabel={english('common.allCentres')} onChange={value => setFilters(f => ({...f, centre: value}))} /> : null}
      </FilterPanel>
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
        <ChartCard reference="6.6" title={t('morarji.cohortSizes')} subtitle={t('morarji.cohortSizesHelp')} state={asState(report)} errorMessage={msg} onRetry={() => setRefreshKey(k => k + 1)} emptyMessage={t('morarji.noCohort')}>
          {cohortGroups.length ? <GroupedColumnChart axis={t('morarji.studentsAxis')} description={t('morarji.cohortSizes')} series={[t('morarji.inTraining'), t('morarji.cohortApplied'), t('morarji.tookExam'), t('morarji.passed')]} items={cohortGroups} /> : <p className="text-sm text-muted">{t('morarji.noCohort')}</p>}
        </ChartCard>
      </div>

      {operational ? (
        <>
          <DataTable<CentreLine> reference="6.7" caption={t('morarji.byCentre')} columns={centreColumns} data={centreTable.rows} getRowId={r => r.id} exportName={context.capabilities?.export === true ? `MASS-morarji-by-centre-${cohortLabel}` : undefined} state={centreTable.result.status} errorMessage={centreTable.error} emptyMessage={t('morarji.noRecords')} onRetry={centreTable.retry} server={centreTable.server} />
          <DataTable<FollowUp> reference="6.8" caption={t('morarji.followup')} columns={followColumns} data={followTable.rows} getRowId={r => r.id} exportName={context.capabilities?.export === true ? `MASS-morarji-follow-up-${cohortLabel}` : undefined} state={followTable.result.status} errorMessage={followTable.error} emptyMessage={t('morarji.noRecords')} onRetry={followTable.retry} server={followTable.server} />
        </>
      ) : <p className="text-xs text-muted">{t('morarji.leadership')}</p>}
      {adding && cohort ? <AddMorarjiDialog service={service} enabled={morarjiEnabled} centres={writable.map(c => ({id: c.id, label: c.label}))} initialCentre={writable.find(c => centreIds.includes(c.id))?.id ?? writable[0]!.id} cohortId={cohort.id} cohortLabel={cohort.label} onSaved={afterSave} onClose={() => setAdding(false)} /> : null}
      {editing ? <OutcomeDialog service={service} enabled={morarjiEnabled} member={{id: editing.id, centre: editing.centre, name: editing.name ?? editing.studentId, applied: editing.applied, attended: editing.attended, result: editing.result, school: editing.school}} onSaved={afterSave} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
