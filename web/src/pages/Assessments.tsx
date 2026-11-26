import {useCallback, useEffect, useMemo, useState} from 'react';
import {AsyncState, type LoadState} from '../components/AsyncState';
import {ChartCard} from '../components/ChartCard';
import {ColumnChart} from '../components/charts/ColumnChart';
import {DataTable, type Column} from '../components/DataTable';
import {Scorecard, type ScorecardState} from '../components/Scorecard';
import {Button} from '../components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '../components/ui/dialog';
import {Input} from '../components/ui/input';
import {EntryDialog, type EditTarget} from '../assessments/EntryDialog';
import {createAssessmentsService, type AssessmentsService, type RegisterRow} from '../assessments/service';
import {type OverviewService, type Report} from '../data/overview';
import {academicMonths, todayIst} from '../lib/dates';
import {formatCount, formatPercent} from '../lib/format';
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
const ROUNDS: Array<[string, string]> = [['1', 'F1'], ['2', 'F2'], ['3', 'F3'], ['4', 'F4']];
const one = (value: number | null | undefined) => (value === null || value === undefined ? null : Number(value.toFixed(1)));


interface Boot {refs: References; capabilities: Capabilities}
interface CentreRow {centre_id: string; centre_label: string; score_n: number | string | null; score_mean: number | string | null}

const INITIAL_FILTERS = {round: '2', centre: '', shift: '', grade: '', gender: ''};

export function Assessments({backend, context, service: injected, overview: injectedOverview, tables: injectedTables}: {backend: LiveBackend; context: ProgrammeContext; role: string; service?: AssessmentsService; overview?: OverviewService; tables?: TableService}) {
  const {t} = useI18n();
  const service = useMemo(() => injected ?? createAssessmentsService(backend.rpc), [backend, injected]);
  const overview = useMemo(() => injectedOverview ?? sharedOverview(backend), [backend, injectedOverview]);
  const tables = useMemo(() => injectedTables ?? createTableService(backend.rpc), [backend, injectedTables]);
  const today = useMemo(() => todayIst(), []);
  const [boot, setBoot] = useState<Slice<Boot>>({status: 'loading'});
  const [bootAttempt, setBootAttempt] = useState(0);
  const [filters, setFilters] = useState<typeof INITIAL_FILTERS>(INITIAL_FILTERS);
  const [report, setReport] = useState<Slice<Report>>({status: 'loading'});
  const [refreshKey, setRefreshKey] = useState(0);
  const [entering, setEntering] = useState(false);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [notice, setNotice] = useState('');
  const [deletingRegister, setDeletingRegister] = useState<{row: RegisterRow; definition: string; targets: Array<{date: string | null; count: number; token: string; request: string}>} | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  const scope = context.centres;
  const writable = useMemo(() => scope.filter(c => c.can_write), [scope]);
  const nameOf = useMemo(() => new Map(context.centres.map(c => [c.id, c.label])), [context]);
  const refs = boot.status === 'ready' ? boot.value.refs : null;
  const year = refs ? (refs.academic_years.find(y => y.starts_on <= today && today < y.ends_before) ?? [...refs.academic_years].sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0]) : undefined;
  const months = useMemo(() => (year ? academicMonths(year.starts_on) : []), [year]);
  const selected = useMemo(() => scope.filter(c => !filters.centre || c.id === filters.centre), [scope, filters.centre]);
  const [fromQuarter, toQuarter] = [1, 2] as const;
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
  const bands = q?.n ? [['0–8', q.low], ['9–15', q.developing], ['16–20', q.good], ['21–25', q.strong]].map(([label, value]) => ({label: String(label), value: Number(value ?? 0)})) : [];
  const progress = ROUNDS.map(([value, label]) => ({label, value: one(stats?.quarters.find(item => item.quarter === Number(value))?.mean)}));
  const tableContext = useMemo(() => year ? {on: today, from: `${today.slice(0, 7)}-01`, until: (() => { const d = new Date(`${today.slice(0, 7)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); })(), year: year.id, grade: selection.grade, shift: selection.shift, gender: selection.gender, earlier: fromQuarter, later: toQuarter, quarter: round} : null, [year, today, key, round]);
  const loadCentres = useCallback((request: TableRequest) => tableContext ? tables.page<CentreRow>('reviewed_centres', selection.centres, tableContext, request) : Promise.resolve({rows: [], total: 0}), [tables, key, tableContext]);
  const centreTable = useServerTable<CentreRow>({key: JSON.stringify([key, round]), load: loadCentres, initialSort: 'centre', refreshKey});
  const loadRegister = useCallback((request: TableRequest) => year ? tables.page<RegisterRow>('assessment_register', selection.centres, {year: year.id, shift: selection.shift, grade: selection.grade, gender: selection.gender}, request) : Promise.resolve({rows: [], total: 0}), [tables, key, year]);
  const registerTable = useServerTable<RegisterRow>({key, load: loadRegister, initialSort: 'date', initialReverse: true, refreshKey});
  const openRegisterDeletion = useCallback(async (row: RegisterRow) => {
    if (!refs || !year) return;
    const period = refs.assessment_periods.find(p => p.academic_year_id === year.id && p.quarter === row.quarter);
    const definition = refs.assessment_definitions.find(d => d.period_id === period?.id)?.id;
    if (!definition) { setNotice(t('assessment.definitionMissing')); return; }
    setDeleteError(''); setDeleteReason('');
    try {
      // Registers are grouped by round, so every observed date inside this centre, shift and round is previewed and deleted together.
      const dates = await service.registerDates(row.centre_id, row.shift_code, definition, year.starts_on, year.ends_before);
      const targets = await Promise.all((dates.length ? dates : [row.assessment_date]).map(async date => { const preview = await service.previewRegisterDeletion(row.centre_id, row.shift_code, definition, date); return {date, count: preview.count, token: preview.token, request: crypto.randomUUID()}; }));
      setDeletingRegister({row, definition, targets});
    } catch (error) { setNotice(messageOf(error)); }
  }, [refs, year, service, t]);
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
    {id: 'action', header: t('common.action'), sortable: false, value: () => t('attendance.edit'), cell: r => writable.some(c => c.id === r.centre_id) ? <Button variant="ghost" size="sm" onClick={() => { setNotice(''); setEditing({centre: r.centre_id, shift: r.shift_code, quarter: r.quarter, date: r.assessment_date}); }}>{t('attendance.edit')}</Button> : null},
  ], [nameOf, writable, t]);

  if (boot.status !== 'ready') return <AsyncState state={boot.status === 'error' ? 'error' : 'loading'} errorMessage={boot.status === 'error' ? boot.message : undefined} onRetry={() => setBootAttempt(n => n + 1)} loadingLabel={t('assessment.preparing')} rows={5} />;
  const canEnter = writable.length > 0 && Boolean(year);
  const entryEnabled = boot.value.capabilities.writes?.assessment_entry === true;
  const reportMessage = report.status === 'error' ? report.message : undefined;
  const round_label = `F${round}`;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">{t('assessment.operationalIntro')}</p>
      <p role="status" aria-live="polite" className={notice ? 'rounded-md bg-ok-soft p-3 text-sm text-ok' : 'sr-only'}>{notice}</p>

      <FilterPanel label={t('assessment.filters')} active={JSON.stringify(filters) !== JSON.stringify(INITIAL_FILTERS)} onClear={() => setFilters(INITIAL_FILTERS)}>
        <Select active={filters.round !== INITIAL_FILTERS.round} label={t('assessment.examRound')} value={filters.round} options={ROUNDS} onChange={value => setFilters(f => ({...f, round: value}))} />
        {scope.length > 1 ? <CentreFilter label={t('common.centre')} value={filters.centre} options={scope} allLabel={english('common.allCentres')} onChange={value => setFilters(f => ({...f, centre: value}))} /> : null}
        <Select label={t('common.shift')} value={filters.shift} options={[['Morning', english('common.morning')], ['Evening', english('common.evening')]]} allLabel={english('common.bothShifts')} onChange={value => setFilters(f => ({...f, shift: value}))} />
        <Select label={t('common.grade')} value={filters.grade} options={Array.from({length: 10}, (_, i) => [String(i + 1), String(i + 1)] as [string, string])} allLabel={english('common.allGrades')} onChange={value => setFilters(f => ({...f, grade: value}))} />
        <Select label={t('common.gender')} value={filters.gender} options={[['Girl', english('common.girls')], ['Boy', english('common.boys')], ['Unknown', english('common.unknown')]]} allLabel={english('common.allGenders')} onChange={value => setFilters(f => ({...f, gender: value}))} />
      </FilterPanel>

      <div className="grid gap-4 sm:grid-cols-3">
        <Scorecard reference="4.1" label={t('assessment.recorded')} value={stats && stats.children > 0 ? formatPercent(((q?.n ?? 0) / stats.children) * 100) : null} hint={stats ? t('assessment.recordedOf', {count: formatCount(q?.n ?? 0), total: formatCount(stats.children)}) : undefined} state={cardState(report)} message={reportMessage} />
        <Scorecard reference="4.2" label={t('assessment.averageStudent')} value={q?.mean != null ? q.mean.toFixed(1) : null} state={stats && q?.mean == null ? 'unavailable' : cardState(report)} message={stats && q?.mean == null ? t('assessment.noScoresRound') : reportMessage} />
        <Scorecard reference="4.3" label={t('assessment.withoutScore')} value={stats && stats.children > 0 ? formatPercent(((stats.children - (q?.n ?? 0)) / stats.children) * 100) : null} hint={stats ? t('assessment.withoutOf', {count: formatCount(stats.children - (q?.n ?? 0)), total: formatCount(stats.children)}) : undefined} state={cardState(report)} message={reportMessage} />
      </div>
      <p className="rounded-md bg-brand-soft p-3 text-sm"><strong>{t('assessment.ruleLead')}</strong> {t('assessment.ruleBody')}</p>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <ChartCard reference="4.4" title={t('assessment.currentPerformance')} subtitle={t('assessment.records25', {round: round_label})} state={asState(report)} errorMessage={reportMessage} onRetry={() => setRefreshKey(k => k + 1)} emptyMessage={t('assessment.noScoresRound')}>
          {bands.length ? <><ColumnChart axis={t('common.students')} description={t('assessment.bandDescription', {round: round_label})} items={bands} /><p className="mt-2 text-xs text-muted">{t('assessment.recordedN', {count: q?.n ?? 0, unbanded: q?.precision_review ?? 0})}</p></> : <p className="text-sm text-muted">{t('assessment.noScoresZero')}</p>}
        </ChartCard>
        <ChartCard reference="4.5" title={t('assessment.progress')} subtitle={t('assessment.progressHelp')} state={asState(report)} errorMessage={reportMessage} onRetry={() => setRefreshKey(k => k + 1)} emptyMessage={t('assessment.noScoresRound')}>
          <ColumnChart axis={t('assessment.averageOutOf25')} description={t('assessment.progressDescription')} items={progress} maximum={25} />
        </ChartCard>
      </div>

      <DataTable<CentreRow> reference="4.6" caption={t('assessment.byCentre')} columns={centreColumns} data={centreTable.rows} getRowId={r => r.centre_id} exportName={context.capabilities?.export === true ? `MASS-assessment-by-centre-${round_label}` : undefined}
        state={centreTable.result.status} server={centreTable.server} errorMessage={centreTable.error} emptyMessage={t('assessment.noCentres')} onRetry={centreTable.retry} />

      <DataTable<RegisterRow> reference="4.7" caption={t('assessment.register')} columns={registerColumns} data={registerTable.rows}
        getRowId={r => `${r.centre_id}|${r.shift_code}|${r.quarter}`} exportName={context.capabilities?.export === true ? 'MASS-assessment-register' : undefined} state={registerTable.result.status} server={registerTable.server} errorMessage={registerTable.error} onRetry={registerTable.retry} emptyMessage={t('assessment.noSaved')}
        headerActions={canEnter ? <Button size="sm" onClick={() => { setNotice(''); setEntering(true); }}>{t('assessment.enter')}</Button> : null} />
      <p className="text-xs text-muted">{t('assessment.registerFootnote')}</p>

      {entering && year && refs ? <EntryDialog service={service} refs={refs} year={year} centres={writable.map(c => ({id: c.id, label: c.label}))} initialCentre={writable.some(c => c.id === filters.centre) ? filters.centre : writable[0]!.id} today={today} enabled={entryEnabled} onSaved={afterSave} onClose={() => setEntering(false)} /> : null}
      {editing && year && refs ? <EntryDialog service={service} refs={refs} year={year} centres={writable.map(c => ({id: c.id, label: c.label}))} initialCentre={editing.centre} today={today} enabled={entryEnabled} edit={editing} onDelete={() => { const row = registerTable.rows.find(r => r.centre_id === editing.centre && r.shift_code === editing.shift && r.quarter === editing.quarter); if (row) { setEditing(null); void openRegisterDeletion(row); } }} onSaved={afterSave} onClose={() => setEditing(null)} /> : null}
      {deletingRegister ? <Dialog open onOpenChange={open => { if (!open && !deleteBusy) setDeletingRegister(null); }}><DialogContent role="alertdialog" aria-describedby="delete-assessment-register-help" onInteractOutside={event => event.preventDefault()}><div><DialogTitle>{t('assessment.deleteRegisterTitle')}</DialogTitle><DialogDescription id="delete-assessment-register-help">{t('assessment.deleteRegisterHelp', {count: deletingRegister.targets.reduce((n, x) => n + x.count, 0), round: `F${deletingRegister.row.quarter}`, date: deletingRegister.targets.map(x => x.date ?? t('common.unknown')).join(', ')})}</DialogDescription></div><label className="flex flex-col gap-1 text-xs font-semibold text-muted">{t('assessment.deleteReason')}<Input value={deleteReason} maxLength={300} disabled={deleteBusy} onChange={event => setDeleteReason(event.target.value)} /></label><p role="alert" className="min-h-5 text-sm text-bad">{deleteError}</p><div className="flex justify-end gap-2"><Button variant="outline" disabled={deleteBusy} onClick={() => setDeletingRegister(null)}>{t('common.cancel')}</Button><Button className="bg-bad hover:bg-bad" disabled={deleteBusy || !entryEnabled || !deleteReason.trim()} onClick={() => { setDeleteBusy(true); const d = deletingRegister; setDeleteError(''); (async () => { for (const target of d.targets) await service.deleteRegister(target.request, d.row.centre_id, d.row.shift_code, d.definition, target.date, target.token, deleteReason); })().then(() => { setDeletingRegister(null); setDeleteBusy(false); void afterSave(t('assessment.deleteRegisterSuccess')); }).catch(error => { setDeleteError(messageOf(error)); setDeleteBusy(false); }); }}>{t(deleteBusy ? 'common.deleting' : 'common.delete')}</Button></div>{entryEnabled ? null : <p className="text-xs text-muted">{t('common.activationPending')}</p>}</DialogContent></Dialog> : null}
    </div>
  );
}
