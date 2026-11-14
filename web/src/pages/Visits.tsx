import {useCallback, useEffect, useMemo, useState} from 'react';
import {AsyncState, type LoadState} from '../components/AsyncState';
import {DataTable, type Column} from '../components/DataTable';
import {Scorecard, type ScorecardState} from '../components/Scorecard';
import {Button} from '../components/ui/button';
import {VisitDialog} from '../visits/VisitDialog';
import {createVisitsService, type Assignment, type OfficerRow, type SummaryRow, type VisitRow, type VisitsService} from '../visits/service';
import {academicMonths, monthLabel, todayIst} from '../lib/dates';
import {formatCount} from '../lib/format';
import type {Capabilities, LiveBackend, References} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';

type Slice<T> = {status: 'loading'} | {status: 'ready'; value: T} | {status: 'error'; message: string};
const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'This could not be loaded.');
const asState = <T,>(slice: Slice<T>): LoadState => slice.status;
const cardState = <T,>(slice: Slice<T>): ScorecardState => slice.status;
const num = (value: number | string) => Number(value);

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

interface Boot {refs: References; capabilities: Capabilities; assignments: Assignment[]}
interface Data {summary: SummaryRow[]; officers: OfficerRow[]}
interface OfficerLine {id: string; label: string; completed: number; target: number; records: number}

export function Visits({backend, context, role, service: injected}: {backend: LiveBackend; context: ProgrammeContext; role: string; service?: VisitsService}) {
  const service = useMemo(() => injected ?? createVisitsService(backend.rpc), [backend, injected]);
  const today = useMemo(() => todayIst(), []);
  const [boot, setBoot] = useState<Slice<Boot>>({status: 'loading'});
  const [bootAttempt, setBootAttempt] = useState(0);
  const [filters, setFilters] = useState({month: '', centre: '', shift: '', officer: ''});
  const [data, setData] = useState<Slice<Data>>({status: 'loading'});
  const [log, setLog] = useState<Slice<VisitRow[]>>({status: 'loading'});
  const [refreshKey, setRefreshKey] = useState(0);
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let live = true;
    setBoot({status: 'loading'});
    Promise.all([backend.readReferences(), backend.readCapabilities(), role === 'Cluster Officer' ? service.assignments() : Promise.resolve([] as Assignment[])])
      .then(([refs, capabilities, assignments]) => { if (live) setBoot({status: 'ready', value: {refs, capabilities, assignments}}); })
      .catch(error => { if (live) setBoot({status: 'error', message: messageOf(error)}); });
    return () => { live = false; };
  }, [backend, service, role, bootAttempt]);

  const scope = useMemo(() => context.centres.filter(c => c.roles.includes(role)), [context, role]);
  const nameOf = useMemo(() => new Map(context.centres.map(c => [c.id, c.label])), [context]);
  const writable = useMemo(() => scope.filter(c => c.can_write && role === 'Cluster Officer' && (context.operational_roles_enabled === true || !context.centres.some(x => x.roles.includes('Leadership')))), [scope, context, role]);
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
    setData({status: 'loading'}); setLog({status: 'loading'});
    const ids = selected.map(c => c.id);
    Promise.all([service.summary(ids, month, officer), service.officers(ids, month)])
      .then(([summary, officers]) => { if (live) setData({status: 'ready', value: {summary, officers}}); })
      .catch(error => { if (live) setData({status: 'error', message: messageOf(error)}); });
    const logCentres = writable.filter(c => ids.includes(c.id)).map(c => c.id);
    service.log(logCentres, month).then(value => { if (live) setLog({status: 'ready', value}); }).catch(error => { if (live) setLog({status: 'error', message: messageOf(error)}); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, key, refreshKey, boot.status]);

  const afterSave = useCallback(async (message: string) => { setRefreshKey(k => k + 1); setNotice(message); }, []);

  const rows = data.status === 'ready' ? data.value.summary : null;
  const observed = Boolean(rows?.some(r => num(r.recorded_count) > 0));
  const count = (shift: 'morning' | 'evening') => (rows && observed ? rows.reduce((n, r) => n + num(r[shift]), 0) : null);
  const morning = count('morning'), evening = count('evening');
  const actual = observed ? (filters.shift === 'Morning' ? morning : filters.shift === 'Evening' ? evening : (morning ?? 0) + (evening ?? 0)) : null;
  const target = (rows?.length ?? 0) * (filters.shift ? 2 : 4);
  const achieved = rows && observed ? rows.filter(r => r.achieved).length : null;

  const officerLines = useMemo<OfficerLine[]>(() => {
    const byOfficer = new Map<string, OfficerLine>();
    const ids = new Set(selected.map(c => c.id));
    for (const r of data.status === 'ready' ? data.value.officers : []) {
      if (!ids.has(r.centre_id) || (officer && r.officer_id !== officer)) continue;
      const line = byOfficer.get(r.officer_id) ?? {id: r.officer_id, label: r.label, completed: 0, target: 0, records: 0};
      line.completed += filters.shift === 'Morning' ? num(r.morning) : filters.shift === 'Evening' ? num(r.evening) : num(r.morning) + num(r.evening);
      line.target += filters.shift ? 2 : 4; line.records += num(r.recorded_count);
      byOfficer.set(r.officer_id, line);
    }
    return [...byOfficer.values()];
  }, [data, selected, officer, filters.shift]);
  const officerChoices = useMemo(() => [...new Map((data.status === 'ready' ? data.value.officers : []).map(r => [r.officer_id, r.label])).entries()], [data]);

  const officerColumns = useMemo<Column<OfficerLine>[]>(() => [
    {id: 'label', header: 'Officer', value: r => r.label},
    {id: 'completed', header: 'Completed visits', value: r => (r.records ? r.completed : null), numeric: true},
    {id: 'target', header: 'Monthly target', value: r => r.target, numeric: true},
  ], []);
  const coverageColumns = useMemo<Column<SummaryRow>[]>(() => [
    {id: 'centre', header: 'Centre', value: r => nameOf.get(r.centre_id) ?? r.centre_id},
    {id: 'morning', header: 'Morning completed', value: r => (num(r.recorded_count) ? num(r.morning) : null), numeric: true},
    {id: 'evening', header: 'Evening completed', value: r => (num(r.recorded_count) ? num(r.evening) : null), numeric: true},
    {id: 'status', header: 'Standard 2 + 2', value: r => (num(r.recorded_count) ? (r.achieved ? 'Recorded target achieved' : 'Recorded target not achieved') : 'No verified visits')},
  ], [nameOf]);
  const logColumns = useMemo<Column<VisitRow>[]>(() => [
    {id: 'date', header: 'Date', value: r => r.visit_date},
    {id: 'centre', header: 'Centre', value: r => nameOf.get(r.centre_id) ?? r.centre_id},
    {id: 'shift', header: 'Shift', value: r => r.shift_code},
    {id: 'status', header: 'Status', value: r => r.status},
    {id: 'feedback', header: 'Feedback', value: r => r.feedback},
    {id: 'next', header: 'Next action', value: r => r.next_action},
  ], [nameOf]);

  if (boot.status !== 'ready') return <AsyncState state={boot.status === 'error' ? 'error' : 'loading'} errorMessage={boot.status === 'error' ? boot.message : undefined} onRetry={() => setBootAttempt(n => n + 1)} loadingLabel="Preparing Visits" rows={5} />;
  if (officerBlocked) return <p role="alert" className="rounded-md bg-warn-soft p-4 text-sm text-warn">No verified, dated officer assignment is configured for this account. Names and directory observations do not establish permission, so visit coverage is unavailable.</p>;
  const canRecord = role === 'Cluster Officer' && boot.value.assignments.length > 0 && writable.length > 0;
  const entryEnabled = boot.value.capabilities.writes?.visit_entry === true;
  const msg = data.status === 'error' ? data.message : undefined;
  const heading = role === 'Leadership' ? 'Officer visits' : 'Visits to your centres';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{heading}: the official monthly target is two Morning and two Evening completed visits per applicable centre.</p>
        {canRecord ? <Button onClick={() => { setNotice(''); setRecording(true); }}>Record a visit</Button> : null}
      </div>
      <p role="status" aria-live="polite" className={notice ? 'rounded-md bg-ok-soft p-3 text-sm text-ok' : 'sr-only'}>{notice}</p>

      <div role="group" aria-label="Visit filters" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-3">
        <Select label="Reporting month" value={month} options={months.map(m => [m, monthLabel(m)])} onChange={value => setFilters(f => ({...f, month: value}))} />
        {scope.length > 1 ? <Select label="Centre" value={filters.centre} options={scope.map(c => [c.id, c.label])} allLabel="All centres" onChange={value => setFilters(f => ({...f, centre: value}))} /> : null}
        <Select label="Shift" value={filters.shift} options={[['Morning', 'Morning'], ['Evening', 'Evening']]} allLabel="Both shifts" onChange={value => setFilters(f => ({...f, shift: value}))} />
        {role !== 'Cluster Officer' && officerChoices.length > 0 ? <Select label="Officer" value={filters.officer} options={officerChoices.map(([id, label]) => [id, label])} allLabel="All officers" onChange={value => setFilters(f => ({...f, officer: value}))} /> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Scorecard reference="5.1" label="Visits completed" value={data.status === 'ready' ? (actual === null ? null : formatCount(actual)) : null} hint={observed ? `Standard target ${target} (2 Morning + 2 Evening per centre)` : 'No verified visit observations; planned visits do not count'} state={data.status === 'ready' && actual === null ? 'unavailable' : cardState(data)} message={msg ?? 'No verified visits recorded for this month'} />
        <Scorecard reference="5.2" label="Morning-shift visits completed" value={morning === null ? null : formatCount(morning)} hint="Standard 2 per applicable centre" state={data.status === 'ready' && morning === null ? 'unavailable' : cardState(data)} message={msg ?? 'No verified visits recorded'} />
        <Scorecard reference="5.3" label="Evening-shift visits completed" value={evening === null ? null : formatCount(evening)} hint="Standard 2 per applicable centre" state={data.status === 'ready' && evening === null ? 'unavailable' : cardState(data)} message={msg ?? 'No verified visits recorded'} />
        <Scorecard reference="5.4" label="Centres meeting standard 2 + 2" value={achieved === null ? null : formatCount(achieved)} hint={`Recorded counts · ${rows?.length ?? 0} selected centres`} state={data.status === 'ready' && achieved === null ? 'unavailable' : cardState(data)} message={msg ?? 'No verified visits recorded'} />
      </div>
      <p className="rounded-md bg-brand-soft p-3 text-sm">Completed visits and monthly targets stay separate. Missing visit data is unknown, not zero, and the applicability of each centre's target is not inferred.</p>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <DataTable<OfficerLine> reference="5.5" caption="Visits by officer" columns={officerColumns} data={officerLines} getRowId={r => r.id} exportName={`MASS-visits-by-officer-${month}`} state={asState(data)} errorMessage={msg} emptyMessage="No verified dated officer assignments are configured." onRetry={() => setRefreshKey(k => k + 1)} />
        <DataTable<SummaryRow> reference="5.6" caption="Centre coverage" columns={coverageColumns} data={rows ?? []} getRowId={r => r.centre_id} exportName={`MASS-visit-coverage-${month}`} state={asState(data)} errorMessage={msg} emptyMessage="No centres in this selection." onRetry={() => setRefreshKey(k => k + 1)} />
      </div>

      {role === 'Cluster Officer' ? (
        <DataTable<VisitRow> reference="5.7" caption="Visit log" columns={logColumns} data={log.status === 'ready' ? [...log.value].sort((a, b) => b.visit_date.localeCompare(a.visit_date)) : []} getRowId={r => r.id} exportName={`MASS-visit-log-${month}`}
          state={asState(log)} errorMessage={log.status === 'error' ? log.message : undefined} emptyMessage="No visits recorded for this month." onRetry={() => setRefreshKey(k => k + 1)} />
      ) : null}
      <p className="text-xs text-muted">Correcting a saved visit and its revision history use their own approved workflow in the standard application.</p>

      {recording ? <VisitDialog service={service} assignments={boot.value.assignments} centres={writable.map(c => ({id: c.id, label: c.label}))} initialCentre={writable.some(c => c.id === filters.centre) ? filters.centre : writable[0]!.id} initialShift={filters.shift} today={today} enabled={entryEnabled} onSaved={afterSave} onClose={() => setRecording(false)} /> : null}
    </div>
  );
}
