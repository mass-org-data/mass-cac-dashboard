import {useCallback, useEffect, useMemo, useState} from 'react';
import {AsyncState} from '../components/AsyncState';
import {DataTable, type Column} from '../components/DataTable';
import {Scorecard, type ScorecardState} from '../components/Scorecard';
import {Button} from '../components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '../components/ui/dialog';
import {Input} from '../components/ui/input';
import {VisitDialog} from '../visits/VisitDialog';
import {createVisitsService, monthWindow, type Assignment, type Conductor, type OfficerRow, type SummaryRow, type VisitRow, type VisitsService} from '../visits/service';
import {academicMonths, monthLabel, todayIst} from '../lib/dates';
import {formatCount} from '../lib/format';
import type {Capabilities, LiveBackend, References} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';
import {createTableService, type TableRequest, type TableService} from '../tables/service';
import {useServerTable} from '../tables/useServerTable';
import {useI18n} from '../i18n/I18n';
import {FilterPanel, FilterSelect as Select, english} from '../components/FilterPanel';

type Slice<T> = {status: 'loading'} | {status: 'ready'; value: T} | {status: 'error'; message: string};
const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'This could not be loaded.');
const cardState = <T,>(slice: Slice<T>): ScorecardState => slice.status;
const num = (value: number | string) => Number(value);


interface Boot {refs: References; capabilities: Capabilities; assignments: Assignment[]; conductors: Conductor[]}
interface Data {summary: SummaryRow[]; officers: OfficerRow[]}
interface OfficerLine {id: string; label: string; completed: number; target: number; records: number}

const INITIAL_FILTERS = {month: '', centre: '', shift: '', officer: ''};

export function Visits({backend, context, role, service: injected, tables: injectedTables}: {backend: LiveBackend; context: ProgrammeContext; role: string; service?: VisitsService; tables?: TableService}) {
  const {t} = useI18n();
  const service = useMemo(() => injected ?? createVisitsService(backend.rpc), [backend, injected]);
  const tables = useMemo(() => injectedTables ?? createTableService(backend.rpc), [backend, injectedTables]);
  const today = useMemo(() => todayIst(), []);
  const [boot, setBoot] = useState<Slice<Boot>>({status: 'loading'});
  const [bootAttempt, setBootAttempt] = useState(0);
  const [filters, setFilters] = useState<typeof INITIAL_FILTERS>(INITIAL_FILTERS);
  const [data, setData] = useState<Slice<Data>>({status: 'loading'});
  const [refreshKey, setRefreshKey] = useState(0);
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<(VisitRow & {request: string}) | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setBoot({status: 'loading'});
    Promise.all([backend.readReferences(), backend.readCapabilities(), role !== 'Teacher' ? service.assignments() : Promise.resolve([] as Assignment[]), role !== 'Teacher' ? service.conductors(context.centres.filter(c => c.can_write).map(c => c.id)).catch(() => null) : Promise.resolve(null)])
      .then(([refs, capabilities, assignments, conductors]) => { if (live) setBoot({status: 'ready', value: {refs, capabilities, assignments, conductors: conductors ?? []}}); })
      .catch(error => { if (live) setBoot({status: 'error', message: messageOf(error)}); });
    return () => { live = false; };
  }, [backend, service, role, bootAttempt]);

  const scope = context.centres;
  const nameOf = useMemo(() => new Map(context.centres.map(c => [c.id, c.label])), [context]);
  const writable = useMemo(() => scope.filter(c => c.can_write && role !== 'Teacher'), [scope, role]);
  const refs = boot.status === 'ready' ? boot.value.refs : null;
  const year = refs ? (refs.academic_years.find(y => y.starts_on <= today && today < y.ends_before) ?? [...refs.academic_years].sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0]) : undefined;
  const months = useMemo(() => (year ? academicMonths(year.starts_on) : []), [year]);
  const month = filters.month || (year && year.starts_on <= today && today < year.ends_before ? today.slice(0, 7) : months[0] ?? '');
  const selected = useMemo(() => scope.filter(c => !filters.centre || c.id === filters.centre), [scope, filters.centre]);
  // A Cluster Officer sees their own coverage: one verified staff identity is required for officer-specific targets.
  const officerIds = boot.status === 'ready' ? [...new Set(boot.value.assignments.map(a => a.officer_id))] : [];
  const ownOfficer = role === 'Cluster Officer' ? (officerIds.length === 1 ? officerIds[0]! : null) : null;
  const officer = role === 'Cluster Officer' ? ownOfficer : (filters.officer || null);
  const key = JSON.stringify([month, selected.map(c => c.id), officer]);
  const officerBlocked = role === 'Cluster Officer' && boot.status === 'ready' && ownOfficer === null;

  useEffect(() => {
    if (boot.status !== 'ready' || !month || officerBlocked) return;
    let live = true;
    setData({status: 'loading'});
    const ids = selected.map(c => c.id);
    Promise.all([service.summary(ids, month, officer), service.officers(ids, month, officer)])
      .then(([summary, officers]) => { if (live) setData({status: 'ready', value: {summary, officers}}); })
      .catch(error => { if (live) setData({status: 'error', message: messageOf(error)}); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, key, refreshKey, boot.status]);

  const afterSave = useCallback(async (message: string) => { setRefreshKey(k => k + 1); setNotice(message); }, []);

  const rows = data.status === 'ready' ? data.value.summary : null;
  const observed = Boolean(rows?.some(r => num(r.recorded_count) > 0));
  const count = (shift: 'morning' | 'evening') => (rows && observed ? rows.reduce((n, r) => n + num(r[shift]), 0) : null);
  const morning = count('morning'), evening = count('evening');
  const actual = observed ? (filters.shift === 'Morning' ? morning : filters.shift === 'Evening' ? evening : (morning ?? 0) + (evening ?? 0)) : null;
  const achieved = rows && observed ? rows.filter(r => r.achieved).length : null;

  const officerChoices = useMemo(() => [...new Map((data.status === 'ready' ? data.value.officers : []).map(r => [r.officer_id, r.label])).entries()], [data]);
  const tableContext = useMemo(() => month ? ({...monthWindow(month), officer, shift: filters.shift || null}) : ({from: '', until: '', officer, shift: filters.shift || null}), [month, officer, filters.shift]);
  const tableKey = JSON.stringify([selected.map(c => c.id), tableContext]);
  const loadOfficers = useCallback((request: TableRequest) => month ? tables.page<OfficerLine>('visit_officers', selected.map(c => c.id), tableContext, request) : Promise.resolve({rows: [], total: 0}), [tables, tableKey, month]);
  const officerTable = useServerTable<OfficerLine>({key: tableKey, load: loadOfficers, initialSort: 'label', refreshKey});
  const loadCoverage = useCallback((request: TableRequest) => month ? tables.page<SummaryRow>('visit_centres', selected.map(c => c.id), tableContext, request) : Promise.resolve({rows: [], total: 0}), [tables, tableKey, month]);
  const coverageTable = useServerTable<SummaryRow>({key: tableKey, load: loadCoverage, initialSort: 'centre', refreshKey});
  const logCentres = useMemo(() => writable.filter(c => selected.some(s => s.id === c.id)).map(c => c.id), [writable, selected]);
  const loadLog = useCallback(async (request: TableRequest) => {
    if (!month) return {rows: [], total: 0};
    const needle = request.query.trim().toLowerCase();
    const rows = (await service.log(logCentres, month)).filter(row => !needle || `${nameOf.get(row.centre_id) ?? ''} ${row.shift_code} ${row.status} ${row.feedback} ${row.next_action}`.toLowerCase().includes(needle));
    const value = (row: VisitRow) => request.sort === 'centre' ? nameOf.get(row.centre_id) ?? row.centre_id : request.sort === 'shift' ? row.shift_code : request.sort === 'status' ? row.status : request.sort === 'feedback' ? row.feedback : request.sort === 'next' ? row.next_action : row.visit_date;
    rows.sort((a, b) => String(value(a)).localeCompare(String(value(b)), 'en', {numeric: true}) || a.id.localeCompare(b.id));
    if (request.reverse) rows.reverse();
    return {rows: rows.slice(request.offset, request.offset + request.limit), total: rows.length};
  }, [service, tableKey, logCentres, month, nameOf]);
  const logTable = useServerTable<VisitRow>({key: JSON.stringify([tableKey, logCentres]), load: loadLog, initialSort: 'date', initialReverse: true, refreshKey});

  const officerColumns = useMemo<Column<OfficerLine>[]>(() => [
    {id: 'label', header: t('visit.officer'), value: r => r.label},
    {id: 'completed', header: t('visit.completedVisits'), value: r => (r.records ? r.completed : null), numeric: true},
    {id: 'target', header: t('visit.monthlyTarget'), value: r => r.target, numeric: true},
  ], [t]);
  const coverageColumns = useMemo<Column<SummaryRow>[]>(() => [
    {id: 'centre', header: t('common.centre'), value: r => nameOf.get(r.centre_id) ?? r.centre_id},
    {id: 'morning', header: t('visit.morningCompleted'), value: r => (num(r.recorded_count) ? num(r.morning) : null), numeric: true},
    {id: 'evening', header: t('visit.eveningCompleted'), value: r => (num(r.recorded_count) ? num(r.evening) : null), numeric: true},
    {id: 'status', header: t('visit.standard'), value: r => (num(r.recorded_count) ? t(r.achieved ? 'visit.targetAchieved' : 'visit.targetMissed') : t('visit.noVerified'))},
  ], [nameOf, t]);
  const conductorName = useMemo(() => new Map((boot.status === 'ready' ? boot.value.conductors : []).map(c => [c.user_id, c.label])), [boot]);
  const logColumns = useMemo<Column<VisitRow>[]>(() => [
    {id: 'date', header: t('common.date'), value: r => r.visit_date},
    {id: 'centre', header: t('common.centre'), value: r => nameOf.get(r.centre_id) ?? r.centre_id},
    {id: 'shift', header: t('common.shift'), value: r => r.shift_code},
    {id: 'status', header: t('common.status'), value: r => r.status},
    {id: 'feedback', header: t('visit.feedbackShort'), value: r => r.feedback},
    {id: 'conductor', header: t('visit.conductedBy'), sortable: false, value: r => conductorName.get(r.conducted_by ?? '') ?? t('common.unknown')},
    {id: 'next', header: t('visit.nextAction'), value: r => r.next_action},
    {id: 'action', header: t('common.action'), sortable: false, value: () => t('common.delete'), cell: r => <Button variant="ghost" size="sm" className="text-bad" onClick={() => { setDeleting({...r, request: crypto.randomUUID()}); setDeleteReason(''); setDeleteError(''); }}>{t('common.delete')}</Button>},
  ], [nameOf, conductorName, t]);

  if (boot.status !== 'ready') return <AsyncState state={boot.status === 'error' ? 'error' : 'loading'} errorMessage={boot.status === 'error' ? boot.message : undefined} onRetry={() => setBootAttempt(n => n + 1)} loadingLabel={t('visit.preparing')} rows={5} />;
  if (officerBlocked) return <p role="alert" className="rounded-md bg-warn-soft p-4 text-sm text-warn">{boot.value.assignments.length === 0 ? t('visit.noAssignment') : t('visit.multipleIdentities', {count: officerIds.length})}</p>;
  const canRecord = role !== 'Teacher' && boot.value.assignments.length > 0 && writable.length > 0;
  const entryEnabled = boot.value.capabilities.writes?.visit_entry === true;
  const msg = data.status === 'error' ? data.message : undefined;
  const heading = t(role === 'Leadership' ? 'visit.officerVisits' : 'visit.yourCentres');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t('visit.intro', {heading})}</p>
        {canRecord ? <Button onClick={() => { setNotice(''); setRecording(true); }}>{t('visit.recordButton')}</Button> : null}
      </div>
      <p role="status" aria-live="polite" className={notice ? 'rounded-md bg-ok-soft p-3 text-sm text-ok' : 'sr-only'}>{notice}</p>

      <FilterPanel label={t('visit.filters')} active={JSON.stringify(filters) !== JSON.stringify(INITIAL_FILTERS)} onClear={() => setFilters(INITIAL_FILTERS)}>
        <Select active={filters.month !== ''} label={t('overview.reportingMonth')} value={month} options={months.map(m => [m, monthLabel(m)])} onChange={value => setFilters(f => ({...f, month: value}))} />
        {scope.length > 1 ? <Select label={t('common.centre')} value={filters.centre} options={scope.map(c => [c.id, c.label])} allLabel={english('common.allCentres')} onChange={value => setFilters(f => ({...f, centre: value}))} /> : null}
        <Select label={t('common.shift')} value={filters.shift} options={[['Morning', english('common.morning')], ['Evening', english('common.evening')]]} allLabel={english('common.bothShifts')} onChange={value => setFilters(f => ({...f, shift: value}))} />
        {role !== 'Cluster Officer' && officerChoices.length > 0 ? <Select label={t('visit.officer')} value={filters.officer} options={officerChoices.map(([id, label]) => [id, label])} allLabel={english('visit.allOfficers')} onChange={value => setFilters(f => ({...f, officer: value}))} /> : null}
      </FilterPanel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Scorecard reference="5.1" label={t('visit.visitsCompleted')} value={data.status === 'ready' ? (actual === null ? null : formatCount(actual)) : null} state={data.status === 'ready' && actual === null ? 'unavailable' : cardState(data)} message={msg ?? t('visit.noneMonth')} />
        <Scorecard reference="5.2" label={t('visit.morningVisits')} value={morning === null ? null : formatCount(morning)} state={data.status === 'ready' && morning === null ? 'unavailable' : cardState(data)} message={msg ?? t('visit.noneRecorded')} />
        <Scorecard reference="5.3" label={t('visit.eveningVisits')} value={evening === null ? null : formatCount(evening)} state={data.status === 'ready' && evening === null ? 'unavailable' : cardState(data)} message={msg ?? t('visit.noneRecorded')} />
        <Scorecard reference="5.4" label={t('visit.centresMeeting')} value={achieved === null ? null : formatCount(achieved)} state={data.status === 'ready' && achieved === null ? 'unavailable' : cardState(data)} message={msg ?? t('visit.noneRecorded')} />
      </div>
      <p className="rounded-md bg-brand-soft p-3 text-sm">{t('visit.rule')}</p>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <DataTable<OfficerLine> reference="5.5" caption={t('visit.byOfficer')} columns={officerColumns} data={officerTable.rows} getRowId={r => r.id} exportName={context.capabilities?.export === true ? `MASS-visits-by-officer-${month}` : undefined} state={officerTable.result.status} server={officerTable.server} errorMessage={officerTable.error} emptyMessage={t('visit.noAssignments')} onRetry={officerTable.retry} />
        <DataTable<SummaryRow> reference="5.6" caption={t('visit.coverage')} columns={coverageColumns} data={coverageTable.rows} getRowId={r => r.centre_id} exportName={context.capabilities?.export === true ? `MASS-visit-coverage-${month}` : undefined} state={coverageTable.result.status} server={coverageTable.server} errorMessage={coverageTable.error} emptyMessage={t('assessment.noCentres')} onRetry={coverageTable.retry} />
      </div>

      {role !== 'Teacher' ? (
        <DataTable<VisitRow> reference="5.7" caption={t('visit.log')} columns={logColumns} data={logTable.rows} getRowId={r => r.id} exportName={context.capabilities?.export === true ? `MASS-visit-log-${month}` : undefined}
          state={logTable.result.status} server={logTable.server} errorMessage={logTable.error} emptyMessage={t('visit.noMonth')} onRetry={logTable.retry} />
      ) : null}
      <p className="text-xs text-muted">{t('visit.footnote')}</p>

      {recording ? <VisitDialog service={service} assignments={boot.value.assignments} centres={writable.map(c => ({id: c.id, label: c.label}))} initialCentre={writable.some(c => c.id === filters.centre) ? filters.centre : writable[0]!.id} initialShift={filters.shift} today={today} enabled={entryEnabled} onSaved={afterSave} onClose={() => setRecording(false)} /> : null}
      {deleting ? <Dialog open onOpenChange={open => { if (!open && !deleteBusy) setDeleting(null); }}><DialogContent role="alertdialog" aria-describedby="delete-visit-help" onInteractOutside={event => event.preventDefault()}><div><DialogTitle>{t('visit.deleteTitle')}</DialogTitle><DialogDescription id="delete-visit-help">{t('visit.deleteHelp', {date: deleting.visit_date, centre: nameOf.get(deleting.centre_id) ?? deleting.centre_id})}</DialogDescription></div><label className="flex flex-col gap-1 text-xs font-semibold text-muted">{t('visit.deleteReason')}<Input value={deleteReason} maxLength={300} disabled={deleteBusy} onChange={event => setDeleteReason(event.target.value)} /></label><p role="alert" className="min-h-5 text-sm text-bad">{deleteError}</p><div className="flex justify-end gap-2"><Button variant="outline" disabled={deleteBusy} onClick={() => setDeleting(null)}>{t('common.cancel')}</Button><Button className="bg-bad hover:bg-bad" disabled={deleteBusy || !deleteReason.trim() || !entryEnabled} onClick={() => { setDeleteBusy(true); service.deleteVisit(deleting.request, deleting.id, deleting.row_version, deleteReason).then(() => { setDeleting(null); setDeleteBusy(false); void afterSave(t('visit.deleteSuccess')); }).catch(error => { setDeleteError(messageOf(error)); setDeleteBusy(false); }); }}>{t(deleteBusy ? 'common.deleting' : 'common.delete')}</Button></div>{entryEnabled ? null : <p className="text-xs text-muted">{t('common.activationPending')}</p>}</DialogContent></Dialog> : null}
    </div>
  );
}
