import {useCallback, useEffect, useMemo, useState} from 'react';
import {AsyncState} from '../components/AsyncState';
import {DataTable, type Column} from '../components/DataTable';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';
import {AddStudentDialog, EditStudentDialog} from '../profiles/StudentDialogs';
import {isProfileSupported, PROFILE_PAGE_SIZE, type ProfileCapabilities, type ProfilePageRequest, type ProfileSort, type ProfilesService, type StudentRow} from '../profiles/service';
import {todayIst} from '../lib/dates';
import {sharedOverview, sharedProfiles} from '../data/shared';
import type {LiveBackend} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';

type Slice<T> = {status: 'loading'} | {status: 'ready'; value: T} | {status: 'error'; message: string};
const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'This could not be loaded.');
const DEFAULT_PAGE: ProfilePageRequest = {offset: 0, sort: 'name', reverse: false};

function Select({label, value, options, onChange, allLabel}: {label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void; allLabel: string}) {
  return (
    <label className="flex min-w-40 flex-col gap-1 text-xs font-semibold text-muted">
      {label}
      <select value={value} onChange={event => onChange(event.target.value)} className="min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink">
        <option value="">{allLabel}</option>
        {options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}
      </select>
    </label>
  );
}

function useDebounced(value: string, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), ms); return () => window.clearTimeout(timer); }, [value, ms]);
  return debounced;
}

export function Profiles({backend, context, role, service: injected}: {backend: LiveBackend; context: ProgrammeContext; role: string; service?: ProfilesService}) {
  const service = useMemo(() => injected ?? sharedProfiles(backend), [backend, injected]);
  const today = useMemo(() => todayIst(), []);
  const [boot, setBoot] = useState<Slice<{caps: ProfileCapabilities; writes: Record<string, boolean>}>>({status: 'loading'});
  const [bootAttempt, setBootAttempt] = useState(0);
  const [filters, setFilters] = useState({centre: '', grade: '', shift: '', gender: ''});
  const [search, setSearch] = useState('');
  const [idSearch, setIdSearch] = useState('');
  const query = useDebounced(search), idQuery = useDebounced(idSearch);
  const [page, setPage] = useState<ProfilePageRequest>(DEFAULT_PAGE);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState<Slice<{rows: StudentRow[]; total: number}>>({status: 'loading'});
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [notice, setNotice] = useState('');

  const leadership = role === 'Leadership';
  useEffect(() => {
    if (leadership) return;
    let live = true;
    setBoot({status: 'loading'});
    Promise.all([service.capabilities(), backend.readCapabilities()]).then(([caps, backendCaps]) => { if (live) setBoot({status: 'ready', value: {caps, writes: backendCaps.writes ?? {}}}); })
      .catch(error => { if (live) setBoot({status: 'error', message: messageOf(error)}); });
    return () => { live = false; };
  }, [backend, service, bootAttempt, leadership]);

  // Same rule as the current page: only the active operational role's centres where it can write.
  const writable = useMemo(() => context.centres.filter(c => c.roles.includes(role) && c.can_write && !leadership && (context.operational_roles_enabled === true || !context.centres.some(x => x.roles.includes('Leadership')))), [context, role, leadership]);
  const nameOf = useMemo(() => new Map(context.centres.map(c => [c.id, c.label])), [context]);
  const selected = useMemo(() => writable.filter(c => !filters.centre || c.id === filters.centre), [writable, filters.centre]);
  const caps = boot.status === 'ready' ? boot.value.caps : null;
  const supported = isProfileSupported(caps);
  const writes = boot.status === 'ready' ? boot.value.writes : {};
  const requestKey = JSON.stringify([selected.map(c => c.id), query, idQuery, filters.grade, filters.shift, filters.gender]);

  useEffect(() => { setPage(DEFAULT_PAGE); }, [requestKey]);

  useEffect(() => {
    if (leadership || !supported) return;
    let live = true;
    setResult(previous => previous.status === 'ready' ? previous : {status: 'loading'});
    setBusy(true);
    const ids = selected.map(c => c.id);
    service.page({centres: ids, query: query.trim(), idQuery: idQuery.trim(), grade: filters.grade || null, shift: filters.shift || null, gender: filters.gender || null}, page, today)
      .then(async found => ({rows: await service.students(ids, found.ids), total: found.total}))
      .then(value => { if (live) { setResult({status: 'ready', value}); setBusy(false); } })
      .catch(error => { if (live) { setResult({status: 'error', message: messageOf(error)}); setBusy(false); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, requestKey, page.offset, page.sort, page.reverse, refreshKey, supported]);

  const afterSave = useCallback(async (message: string) => { service.clear(); sharedOverview(backend).clear(); setRefreshKey(k => k + 1); setNotice(message); }, [service, backend]);

  const canEdit = writable.length > 0;
  const columns = useMemo<Column<StudentRow>[]>(() => [
    {id: 'id', header: 'Student ID', value: r => r.studentId},
    {id: 'name', header: 'Name', value: r => r.name ?? 'Name not recorded'},
    {id: 'centre', header: 'Centre', value: r => nameOf.get(r.centre) ?? r.centre},
    {id: 'grade', header: 'Grade', value: r => Number(r.grade), numeric: true},
    {id: 'shift', header: 'Shift', value: r => r.shift},
    {id: 'gender', header: 'Gender', value: r => r.gender ?? 'Unknown'},
    {id: 'newest', header: 'Enrolled from', value: r => r.enrolled},
    {id: 'action', header: 'Action', sortable: false, value: () => (canEdit ? 'Edit' : 'View only'),
      cell: r => canEdit ? <Button variant="ghost" size="sm" aria-label={`Edit profile: ${r.name ?? r.studentId}`} onClick={() => { setNotice(''); setEditing(r); }}>Edit</Button> : <span className="text-xs text-muted">View only</span>},
  ], [nameOf, canEdit]);

  if (leadership) return <p role="note" className="rounded-md bg-brand-soft p-4 text-sm">Leadership sees aggregate reporting only. Individual student profiles stay restricted; switch to Teacher or Cluster Officer to view the students of your centres.</p>;
  if (boot.status !== 'ready') return <AsyncState state={boot.status === 'error' ? 'error' : 'loading'} errorMessage={boot.status === 'error' ? boot.message : undefined} onRetry={() => setBootAttempt(n => n + 1)} loadingLabel="Preparing Student profiles" rows={5} />;
  if (!supported) return <p role="alert" className="rounded-md bg-warn-soft p-4 text-sm text-warn">The profile API installed here is older than the new interface supports. Use the standard application for student profiles.</p>;

  const server = result.status === 'ready' ? {
    note: 'Searched, sorted and paged by the server, ten students per page.', total: result.value.total, pageIndex: page.offset / PROFILE_PAGE_SIZE,
    onPageChange: (index: number) => setPage(p => ({...p, offset: index * PROFILE_PAGE_SIZE})), sort: {id: page.sort, desc: page.reverse},
    onSortChange: (id: string) => setPage(p => p.sort === id ? {...p, offset: 0, reverse: !p.reverse} : {offset: 0, sort: id as ProfileSort, reverse: false}),
  } : undefined;
  const addEnabled = writes.registration === true, editEnabled = writes.profiles === true;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Search the students of your centres, review their profiles and add or correct a student.</p>
        {canEdit ? <Button onClick={() => { setNotice(''); setAdding(true); }}>Add student</Button> : <p className="text-xs text-muted">Student entry is not available for your centres.</p>}
      </div>
      <p role="status" aria-live="polite" className={notice ? 'rounded-md bg-ok-soft p-3 text-sm text-ok' : 'sr-only'}>{notice}</p>

      <div role="search" aria-label="Student search" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-3">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs font-semibold text-muted">Search name, ID or centre
          <Input type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={160} />
        </label>
        <label className="flex min-w-40 flex-col gap-1 text-xs font-semibold text-muted">Student ID
          <Input type="search" value={idSearch} onChange={event => setIdSearch(event.target.value)} maxLength={160} />
        </label>
        {writable.length > 1 ? <Select label="Centre" value={filters.centre} options={writable.map(c => [c.id, c.label])} allLabel="All centres" onChange={value => setFilters(f => ({...f, centre: value}))} /> : null}
        <Select label="Grade" value={filters.grade} options={Array.from({length: 10}, (_, i) => [String(i + 1), String(i + 1)] as [string, string])} allLabel="All grades" onChange={value => setFilters(f => ({...f, grade: value}))} />
        <Select label="Shift" value={filters.shift} options={[['Morning', 'Morning'], ['Evening', 'Evening']]} allLabel="Both shifts" onChange={value => setFilters(f => ({...f, shift: value}))} />
        <Select label="Gender" value={filters.gender} options={[['Girl', 'Girls'], ['Boy', 'Boys'], ['Unknown', 'Unknown']]} allLabel="All genders" onChange={value => setFilters(f => ({...f, gender: value}))} />
      </div>

      {result.status === 'error' ? <AsyncState state="error" errorMessage={result.message} onRetry={() => setRefreshKey(k => k + 1)} /> : (
        <div aria-busy={busy} className={busy ? 'opacity-60 transition-opacity' : undefined}>
          <DataTable<StudentRow> reference="3.1" caption="Student profiles" columns={columns} data={result.status === 'ready' ? result.value.rows : []} getRowId={r => r.enrolment}
            exportName="MASS-student-profiles" state={result.status === 'ready' ? 'ready' : 'loading'} emptyMessage="No students match this search." server={server} />
        </div>
      )}
      <p className="text-xs text-muted">Students shown are those enrolled today in your centres. Names and genders appear only for centres your role may read. Transfers between centres, grades or shifts stay in the standard application.</p>

      {adding ? <AddStudentDialog service={service} centres={writable.map(c => ({id: c.id, label: c.label}))} initialCentre={filters.centre || writable[0]!.id} today={today} enabled={addEnabled} onSaved={afterSave} onClose={() => setAdding(false)} /> : null}
      {editing ? <EditStudentDialog service={service} student={editing} centreLabel={nameOf.get(editing.centre) ?? editing.centre} enabled={editEnabled} onSaved={afterSave} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
