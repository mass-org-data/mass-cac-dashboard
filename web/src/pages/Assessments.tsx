import {useCallback, useEffect, useMemo, useState} from 'react';
import {AsyncState, type LoadState} from '../components/AsyncState';
import {ChartCard} from '../components/ChartCard';
import {ColumnChart} from '../components/charts/ColumnChart';
import {DataTable, type Column} from '../components/DataTable';
import {Scorecard, type ScorecardState} from '../components/Scorecard';
import {Button} from '../components/ui/button';
import {EntryDialog} from '../assessments/EntryDialog';
import {createAssessmentsService, type AssessmentsService, type RegisterRow} from '../assessments/service';
import {type OverviewService, type Report} from '../data/overview';
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
const ROUNDS: Array<[string, string]> = [['1', 'F1'], ['2', 'F2'], ['3', 'F3'], ['4', 'F4']];
const PAIRS: Array<[string, string]> = [['1|2', 'F1 → F2'], ['2|3', 'F2 → F3'], ['3|4', 'F3 → F4'], ['1|4', 'F1 → F4']];
const one = (value: number | null | undefined) => (value === null || value === undefined ? null : Number(value.toFixed(1)));

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

interface Boot {refs: References; capabilities: Capabilities}
interface CentreRow {centre_id: string; centre_label: string; score_n: number | string | null; score_mean: number | string | null}

export function Assessments({backend, context, role, service: injected, overview: injectedOverview, tables: injectedTables}: {backend: LiveBackend; context: ProgrammeContext; role: string; service?: AssessmentsService; overview?: OverviewService; tables?: TableService}) {
  const {t} = useI18n();
  const service = useMemo(() => injected ?? createAssessmentsService(backend.rpc), [backend, injected]);
  const overview = useMemo(() => injectedOverview ?? sharedOverview(backend), [backend, injectedOverview]);
  const tables = useMemo(() => injectedTables ?? createTableService(backend.rpc), [backend, injectedTables]);
  const today = useMemo(() => todayIst(), []);
  const [boot, setBoot] = useState<Slice<Boot>>({status: 'loading'});
  const [bootAttempt, setBootAttempt] = useState(0);
  const [filters, setFilters] = useState({round: '2', pair: '1|2', centre: '', shift: '', grade: '', gender: ''});
  const [report, setReport] = useState<Slice<Report>>({status: 'loading'});
  const [refreshKey, setRefreshKey] = useState(0);
  const [entering, setEntering] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let live = true;
    setBoot({status: 'loading'});
    Promise.all([backend.readReferences(), backend.readCapabilities()]).then(([refs, capabilities]) => {
      if (!live) return;
      if (!capabilities.reviewedCharts) { setBoot({status: 'error', message: t('assessment.backendDisabled')}); return; }
      setBoot({status: 'ready', value: {refs, capabilities}});
    }).catch(error => { if (live) setBoot({status: 'error', message: messageOf(error)}); });
    return () => { live = false; };
  }, [backend, bootAttempt, t]);

  const scope = useMemo(() => context.centres.filter(c => c.roles.includes(role)), [context, role]);
  const writable = useMemo(() => scope.filter(c => c.can_write && role !== 'Leadership' && (context.operational_roles_enabled === true || !context.centres.some(x => x.roles.includes('Leadership')))), [scope, context, role]);
  const nameOf = useMemo(() => new Map(context.centres.map(c => [c.id, c.label])), [context]);
  const refs = boot.status === 'ready' ? boot.value.refs : null;
  const year = refs ? (refs.academic_years.find(y => y.starts_on <= today && today < y.ends_before) ?? [...refs.academic_years].sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0]) : undefined;
  const months = useMemo(() => (year ? academicMonths(year.starts_on) : []), [year]);
  const selected = useMemo(() => scope.filter(c => !filters.centre || c.id === filters.centre), [scope, filters.centre]);
  const [fromQuarter, toQuarter] = filters.pair.split('|').map(Number) as [number, number];
  const selection = {month: today.slice(0, 7), centres: selected.map(c => c.id), shift: filters.shift || null, grade: filters.grade || null, gender: filters.gender || null};
  const key = JSON.stringify([selection, fromQuarter, toQuarter]);

  useEffect(() => {
    if (!year || boot.status !== 'ready') return;
    let live = true;
    setReport({status: 'loading'});
    const env = {yearId: year.id, today, fromQuarter, toQuarter, months, hasSeries: false};
    if (selection.centres.length === 0) { setReport({status: 'error', message: t('assessment.noCentres')}); return; }
    overview.report(selection, env).then(value => { if (live) setReport({status: 'ready', value}); }).catch(error => { if (live) setReport({status: 'error', message: messageOf(error)}); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, service, key, refreshKey, boot.status]);

  const afterSave = useCallback(async (message: string) => { overview.clear(); setRefreshKey(k => k + 1); setNotice(message); }, [overview]);

  const round = Number(filters.round);
  const stats = report.status === 'ready' ? report.value : null;
  const q = stats?.quarters.find(item => item.quarter === round);
  const change = stats?.changes ?? null;
  const growth = change && change.earlierMean !== null && change.laterMean !== null && change.earlierMean > 0 ? (change.laterMean - change.earlierMean) / change.earlierMean * 100 : null;
  const bands = q?.n ? [['0–8', q.low], ['9–15', q.developing], ['16–20', q.good], ['21–25', q.strong]].map(([label, value]) => ({label: String(label), value: Number(value ?? 0)})) : [];
  const progress = [1, 2, 3, 4].map(r => ({label: `F${r}`, value: one(stats?.quarters.find(item => item.quarter === r)?.mean)}));
  const tableContext = useMemo(() => year ? {on: today, from: `${today.slice(0, 7)}-01`, until: (() => { const d = new Date(`${today.slice(0, 7)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); })(), year: year.id, grade: selection.grade, shift: selection.shift, gender: selection.gender, earlier: fromQuarter, later: toQuarter, quarter: round} : null, [year, today, key, round]);
  const loadCentres = useCallback((request: TableRequest) => tableContext ? tables.page<CentreRow>('reviewed_centres', selection.centres, tableContext, request) : Promise.resolve({rows: [], total: 0}), [tables, key, tableContext]);
  const centreTable = useServerTable<CentreRow>({key: JSON.stringify([key, round]), load: loadCentres, initialSort: 'centre', refreshKey});
  const loadRegister = useCallback((request: TableRequest) => year ? tables.page<RegisterRow>('assessment_register', selection.centres, {year: year.id, shift: selection.shift, grade: selection.grade, gender: selection.gender}, request) : Promise.resolve({rows: [], total: 0}), [tables, key, year]);
  const registerTable = useServerTable<RegisterRow>({key, load: loadRegister, initialSort: 'date', initialReverse: true, refreshKey});
  const centreColumns = useMemo<Column<CentreRow>[]>(() => [
    {id: 'centre', header: t('common.centre'), value: r => r.centre_label},
    {id: 'students', header: t('assessment.studentsScores'), value: r => Number(r.score_n ?? 0), numeric: true},
    {id: 'score', header: t('assessment.averageOutOf25'), value: r => r.score_mean === null ? null : one(Number(r.score_mean)), numeric: true, cell: r => r.score_mean === null ? t('common.unknown') : Number(r.score_mean).toFixed(1)},
  ], [t]);
  const registerColumns = useMemo<Column<RegisterRow>[]>(() => [
    {id: 'centre', header: t('common.centre'), value: r => nameOf.get(r.centre_id) ?? r.centre_id},
    {id: 'shift', header: t('common.shift'), value: r => r.shift_code},
    {id: 'date', header: t('assessment.date'), value: r => r.assessment_date ?? t('common.unknown'), cell: r => r.assessment_date ?? <span title={t('assessment.historicalDate')}>{t('common.unknown')}</span>},
    {id: 'round', header: t('assessment.round'), value: r => `F${r.quarter}`},
    {id: 'students', header: t('assessment.studentsScores'), value: r => Number(r.students), numeric: true},
    {id: 'average', header: t('assessment.averageScore'), value: r => (r.average_score === null ? null : Number(Number(r.average_score).toFixed(1))), numeric: true, cell: r => (r.average_score === null ? t('common.unknown') : Number(r.average_score).toFixed(1))},
    {id: 'created', header: t('assessment.createdBy'), value: r => r.created_by ?? t('common.notRecorded')},
    {id: 'edited', header: t('assessment.lastEditedBy'), value: r => r.last_edited_by ?? t('common.notRecorded')},
    {id: 'at', header: t('assessment.lastEditedAt'), value: r => r.last_edited_at ?? t('common.notRecorded')},
  ], [nameOf, t]);

  if (boot.status !== 'ready') return <AsyncState state={boot.status === 'error' ? 'error' : 'loading'} errorMessage={boot.status === 'error' ? boot.message : undefined} onRetry={() => setBootAttempt(n => n + 1)} loadingLabel={t('assessment.preparing')} rows={5} />;
  const canEnter = writable.length > 0 && Boolean(year);
  const entryEnabled = boot.value.capabilities.writes?.assessment_entry === true;
  const reportMessage = report.status === 'error' ? report.message : undefined;
  const round_label = `F${round}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t(role === 'Leadership' ? 'assessment.leadershipIntro' : 'assessment.operationalIntro')}</p>
        {canEnter ? <Button onClick={() => { setNotice(''); setEntering(true); }}>{t('assessment.enter')}</Button> : <p className="text-xs text-muted">{t(role === 'Leadership' ? 'assessment.leadershipOnly' : 'assessment.noEntry')}</p>}
      </div>
      <p role="status" aria-live="polite" className={notice ? 'rounded-md bg-ok-soft p-3 text-sm text-ok' : 'sr-only'}>{notice}</p>

      <div role="group" aria-label={t('assessment.filters')} className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-3">
        <Select label={t('assessment.examRound')} value={filters.round} options={ROUNDS} onChange={value => setFilters(f => ({...f, round: value}))} />
        <Select label={t('assessment.compareRounds')} value={filters.pair} options={PAIRS} onChange={value => setFilters(f => ({...f, pair: value}))} />
        {scope.length > 1 ? <Select label={t('common.centre')} value={filters.centre} options={scope.map(c => [c.id, c.label])} allLabel={t('common.allCentres')} onChange={value => setFilters(f => ({...f, centre: value}))} /> : null}
        <Select label={t('common.shift')} value={filters.shift} options={[['Morning', t('common.morning')], ['Evening', t('common.evening')]]} allLabel={t('common.bothShifts')} onChange={value => setFilters(f => ({...f, shift: value}))} />
        <Select label={t('common.grade')} value={filters.grade} options={Array.from({length: 10}, (_, i) => [String(i + 1), String(i + 1)] as [string, string])} allLabel={t('common.allGrades')} onChange={value => setFilters(f => ({...f, grade: value}))} />
        <Select label={t('common.gender')} value={filters.gender} options={[['Girl', t('common.girls')], ['Boy', t('common.boys')], ['Unknown', t('common.unknown')]]} allLabel={t('common.allGenders')} onChange={value => setFilters(f => ({...f, gender: value}))} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Scorecard reference="4.1" label={t('assessment.recorded')} value={stats ? `${formatCount(q?.n ?? 0)} / ${formatCount(stats.children)}` : null} state={cardState(report)} message={reportMessage} />
        <Scorecard reference="4.2" label={t('assessment.averageStudent')} value={q?.mean != null ? q.mean.toFixed(1) : null} state={stats && q?.mean == null ? 'unavailable' : cardState(report)} message={stats && q?.mean == null ? t('assessment.noScoresRound') : reportMessage} />
        <Scorecard reference="4.3" label={t('assessment.withoutScore')} value={stats ? formatCount(stats.children - (q?.n ?? 0)) : null} state={cardState(report)} message={reportMessage} />
        <Scorecard reference="4.4" label={t('assessment.improvement')} value={growth === null ? null : `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`} state={stats && growth === null ? 'unavailable' : cardState(report)} message={stats && growth === null ? t('assessment.improvementNeeds') : reportMessage} />
      </div>
      <p className="rounded-md bg-brand-soft p-3 text-sm"><strong>{t('assessment.ruleLead')}</strong> {t('assessment.ruleBody')}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard reference="4.5" title={t('assessment.currentPerformance')} subtitle={t('assessment.records25', {round: round_label})} state={asState(report)} errorMessage={reportMessage} onRetry={() => setRefreshKey(k => k + 1)} emptyMessage={t('assessment.noScoresRound')}>
          {bands.length ? <><ColumnChart axis={t('common.students')} description={t('assessment.bandDescription', {round: round_label})} items={bands} /><p className="mt-2 text-xs text-muted">{t('assessment.recordedN', {count: q?.n ?? 0, unbanded: q?.precision_review ?? 0})}</p></> : <p className="text-sm text-muted">{t('assessment.noScoresZero')}</p>}
        </ChartCard>
        <ChartCard reference="4.6" title={t('assessment.progress')} subtitle={t('assessment.progressHelp')} state={asState(report)} errorMessage={reportMessage} onRetry={() => setRefreshKey(k => k + 1)}>
          <ColumnChart axis={t('assessment.averageOutOf25')} description={t('assessment.progressDescription')} items={progress} />
          <p className="mt-2 text-xs text-muted">{t('assessment.progressCaution')}</p>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable<CentreRow> reference="4.7" caption={t('assessment.byCentre')} columns={centreColumns} data={centreTable.rows} getRowId={r => r.centre_id} exportName={`MASS-assessment-by-centre-${round_label}`}
          state={centreTable.result.status} server={centreTable.server} errorMessage={centreTable.error} emptyMessage={t('assessment.noCentres')} onRetry={centreTable.retry} />
        <ChartCard reference="4.8" title={t('assessment.matched')} subtitle={t('assessment.matchedHelp', {from: fromQuarter, to: toQuarter})} state={asState(report)} errorMessage={reportMessage} onRetry={() => setRefreshKey(k => k + 1)}>
          {change && change.n > 0 ? (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted">{t('assessment.matchedStudents')}</dt><dd className="font-semibold">{formatCount(change.n)}</dd>
              <dt className="text-muted">{t('assessment.improved')}</dt><dd className="font-semibold">{formatCount(change.improved)}</dd>
              <dt className="text-muted">{t('assessment.unchanged')}</dt><dd className="font-semibold">{formatCount(change.unchanged)}</dd>
              <dt className="text-muted">{t('assessment.declined')}</dt><dd className="font-semibold">{formatCount(change.declined)}</dd>
              <dt className="text-muted">{t('assessment.averageChange')}</dt><dd className="font-semibold">{change.meanChange === null ? t('common.unknown') : `${change.meanChange > 0 ? '+' : ''}${change.meanChange.toFixed(1)}`}</dd>
              <dt className="text-muted">{t('assessment.averageEarlierLater')}</dt><dd className="font-semibold">{change.earlierMean === null || change.laterMean === null ? t('common.unknown') : `${change.earlierMean.toFixed(1)} → ${change.laterMean.toFixed(1)}`}</dd>
            </dl>
          ) : <p className="text-sm text-muted">{t('assessment.noMatched')}</p>}
        </ChartCard>
      </div>

      <DataTable<RegisterRow> reference="4.9" caption={t('assessment.register')} columns={registerColumns} data={registerTable.rows}
        getRowId={r => `${r.centre_id}|${r.shift_code}|${r.assessment_date ?? 'unknown'}|${r.quarter}`} exportName="MASS-assessment-register" state={registerTable.result.status} server={registerTable.server} errorMessage={registerTable.error} onRetry={registerTable.retry} emptyMessage={t('assessment.noSaved')} />
      <p className="text-xs text-muted">{t('assessment.registerFootnote')}</p>

      {entering && year && refs ? <EntryDialog service={service} refs={refs} year={year} centres={writable.map(c => ({id: c.id, label: c.label}))} initialCentre={writable.some(c => c.id === filters.centre) ? filters.centre : writable[0]!.id} today={today} enabled={entryEnabled} onSaved={afterSave} onClose={() => setEntering(false)} /> : null}
    </div>
  );
}
