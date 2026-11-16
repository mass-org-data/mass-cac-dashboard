import {useCallback, useEffect, useMemo, useState} from 'react';
import {AsyncState, type LoadState} from '../components/AsyncState';
import {ChartCard} from '../components/ChartCard';
import {ColumnChart} from '../components/charts/ColumnChart';
import {LineChart} from '../components/charts/LineChart';
import {DataTable, type Column} from '../components/DataTable';
import {Scorecard} from '../components/Scorecard';
import {Button} from '../components/ui/button';
import {RegisterDialog, type Selection} from '../attendance/RegisterDialog';
import {createAttendanceService, isSupported, PAGE_SIZE, type AttendanceService, type Distribution, type Filters, type PageRequest, type RegisterCapabilities, type RegisterPage, type RegisterRow, type SortKey} from '../attendance/service';
import {type OverviewService, type Report, type Series} from '../data/overview';
import {academicMonths, monthLabel, monthShort, todayIst} from '../lib/dates';
import {formatCount, formatPercent} from '../lib/format';
import {attendanceSummaryDisplay} from '../../../src/live/attendance-register.js';
import {sharedOverview} from '../data/shared';
import type {LiveBackend, References} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';

type Slice<T> = {status: 'loading'} | {status: 'ready'; value: T} | {status: 'error'; message: string};
const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'This could not be loaded.');
const asState = <T,>(slice: Slice<T>): LoadState => slice.status === 'ready' ? 'ready' : slice.status;

// Attendance bands from the server's days-present distribution. Same bands as the current page; the last band is open-ended.
const BANDS: Array<[string, (days: number) => boolean]> = [['Below 15', d => d < 15], ['15 days', d => d === 15], ['16–20', d => d >= 16 && d <= 20], ['21 or more', d => d > 20]];

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

export function Attendance({backend, context, role, service: injected, overview: injectedOverview}: {backend: LiveBackend; context: ProgrammeContext; role: string; service?: AttendanceService; overview?: OverviewService}) {
  const service = useMemo(() => injected ?? createAttendanceService(backend.rpc), [backend, injected]);
  const overview = useMemo(() => injectedOverview ?? sharedOverview(backend), [backend, injectedOverview]);
  const today = useMemo(() => todayIst(), []);

  const [boot, setBoot] = useState<Slice<{caps: RegisterCapabilities; refs: References; hasSeries: boolean}>>({status: 'loading'});
  const [bootAttempt, setBootAttempt] = useState(0);
  const [filters, setFilters] = useState({month: '', centre: '', shift: '', grade: '', gender: ''});
  const [page, setPage] = useState<PageRequest>({offset: 0, sort: 'date', reverse: false});
  const [refreshKey, setRefreshKey] = useState(0);
  const [register, setRegister] = useState<Slice<RegisterPage>>({status: 'loading'});
  const [registerBusy, setRegisterBusy] = useState(false);
  const [distribution, setDistribution] = useState<Slice<Distribution>>({status: 'loading'});
  const [report, setReport] = useState<Slice<Report>>({status: 'loading'});
  const [series, setSeries] = useState<Slice<Series>>({status: 'loading'});
  const [editor, setEditor] = useState<Selection | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let live = true;
    setBoot({status: 'loading'});
    Promise.all([service.capabilities(), backend.readReferences(), backend.readCapabilities()]).then(([caps, refs, backendCaps]) => {
      if (live) setBoot({status: 'ready', value: {caps, refs, hasSeries: backendCaps.reviewedAttendanceSeries}});
    }).catch(error => { if (live) setBoot({status: 'error', message: messageOf(error)}); });
    return () => { live = false; };
  }, [backend, service, bootAttempt]);

  const scope = useMemo(() => context.centres.filter(c => c.roles.includes(role)), [context, role]);
  // Same entry rule as the current register: write access is per centre, only for the active operational role, never Leadership.
  const writable = useMemo(() => scope.filter(c => c.can_write && role !== 'Leadership' && (context.operational_roles_enabled === true || !context.centres.some(x => x.roles.includes('Leadership')))), [scope, context, role]);
  const nameOf = useMemo(() => new Map(context.centres.map(c => [c.id, c.label])), [context]);

  const year = boot.status === 'ready' ? (boot.value.refs.academic_years.find(y => y.starts_on <= today && today < y.ends_before) ?? [...boot.value.refs.academic_years].sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0]) : null;
  const months = useMemo(() => (year ? academicMonths(year.starts_on) : []), [year]);
  const month = filters.month || (year && year.starts_on <= today && today < year.ends_before ? today.slice(0, 7) : months[0] ?? '');
  const selected = useMemo(() => scope.filter(c => !filters.centre || c.id === filters.centre), [scope, filters.centre]);
  const query: Filters | null = month ? {month, centres: selected.map(c => c.id), shift: filters.shift || null, grade: filters.grade || null, gender: filters.gender || null} : null;
  const queryKey = JSON.stringify(query);
  const caps = boot.status === 'ready' ? boot.value.caps : null;
  const supported = isSupported(caps);
  const canWrite = supported && caps.enabled === true && writable.length > 0;

  // Filters change the data and return to the first page, newest first.
  useEffect(() => { setPage({offset: 0, sort: 'date', reverse: false}); }, [queryKey]);

  useEffect(() => {
    if (!query || !supported || boot.status !== 'ready' || !year) return;
    let live = true;
    // Keep the rows on screen while the next page loads, so the table does not jump.
    setRegister(previous => previous.status === 'ready' ? previous : {status: 'loading'});
    setRegisterBusy(true);
    service.page(query, page).then(value => { if (live) { setRegister({status: 'ready', value}); setRegisterBusy(false); } }).catch(error => { if (live) { setRegister({status: 'error', message: messageOf(error)}); setRegisterBusy(false); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, queryKey, page.offset, page.sort, page.reverse, refreshKey, supported, boot.status]);

  useEffect(() => {
    if (!query || !supported || boot.status !== 'ready' || !year || month > today.slice(0, 7)) return;
    let live = true;
    setDistribution({status: 'loading'}); setReport({status: 'loading'}); setSeries({status: 'loading'});
    const env = {yearId: year.id, today, fromQuarter: 1, toQuarter: 2, months, hasSeries: boot.value.hasSeries};
    const selection = {month: query.month, centres: query.centres, shift: query.shift, grade: query.grade, gender: query.gender};
    if (query.centres.length === 0) { setDistribution({status: 'ready', value: {days: []}}); return; }
    service.distribution(query).then(value => { if (live) setDistribution({status: 'ready', value}); }).catch(error => { if (live) setDistribution({status: 'error', message: messageOf(error)}); });
    overview.report(selection, env).then(value => { if (live) setReport({status: 'ready', value}); }).catch(error => { if (live) setReport({status: 'error', message: messageOf(error)}); });
    overview.series(selection, env).then(value => { if (live) setSeries({status: 'ready', value}); }).catch(error => { if (live) setSeries({status: 'error', message: messageOf(error)}); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, overview, queryKey, refreshKey, supported, boot.status]);

  const afterSave = useCallback(async (message: string) => {
    overview.clear();
    setRefreshKey(key => key + 1);
    setNotice(message);
  }, [overview]);

  const openEditor = (selection?: Selection) => {
    const allowedIds = new Set(writable.map(c => c.id));
    const centre = selection?.centre ?? (allowedIds.has(filters.centre) ? filters.centre : writable[0]?.id);
    if (!centre) return;
    const date = selection?.date ?? (month === today.slice(0, 7) ? today : `${month}-01`);
    setNotice('');
    setEditor({centre, shift: selection?.shift ?? (filters.shift || 'Morning'), date});
  };

  const sortId = ({centre: 'centre', shift: 'shift', date: 'date', present: 'present', percentage: 'percentage'} as Record<SortKey, string>)[page.sort];
  const columns = useMemo<Column<RegisterRow>[]>(() => [
    {id: 'centre', header: 'Centre', value: r => nameOf.get(r.centre_id) ?? r.centre_id},
    {id: 'shift', header: 'Shift', value: r => r.shift_code},
    {id: 'date', header: 'Date', value: r => r.attendance_date},
    {id: 'present', header: 'No. of students present', value: r => attendanceSummaryDisplay(r).ratio, numeric: true},
    {id: 'percentage', header: '% students present', value: r => attendanceSummaryDisplay(r).percentage, numeric: true, cell: r => { const d = attendanceSummaryDisplay(r); return <>{d.percentage}{d.incomplete ? <span className="block text-xs text-muted">Incomplete attendance</span> : null}</>; }},
    {id: 'created_by', header: 'Created by', value: r => r.created_by ?? 'Not recorded', sortable: false},
    {id: 'last_edited_by', header: 'Last edited by', value: r => r.last_edited_by ?? 'Not recorded', sortable: false},
    {id: 'last_edited_at', header: 'Last edited at', value: r => r.last_edited_at ?? 'Not recorded', sortable: false},
    {id: 'action', header: 'Action', sortable: false, value: r => r.session_type === 'Holiday' ? 'Recorded holiday' : writable.some(c => c.id === r.centre_id) && canWrite ? 'Edit attendance' : 'View only',
      cell: r => r.session_type === 'Holiday' ? 'Recorded holiday'
        : writable.some(c => c.id === r.centre_id) && canWrite
          ? <Button variant="ghost" size="sm" aria-label={`Edit attendance: ${nameOf.get(r.centre_id) ?? r.centre_id}, ${r.shift_code}, ${r.attendance_date}`} onClick={() => openEditor({centre: r.centre_id, shift: r.shift_code, date: r.attendance_date})}>Edit attendance</Button>
          : <span className="text-xs text-muted">View only</span>},
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [nameOf, writable, canWrite]);

  const bandItems = distribution.status === 'ready' ? BANDS.map(([label, test]) => ({label, value: distribution.value.days.filter(d => test(d.days)).reduce((n, d) => n + d.students, 0)})) : [];
  const trend = series.status === 'ready' ? months.map(m => ({label: monthShort(m), value: series.value[m] ?? null})) : [];
  const stats = report.status === 'ready' ? report.value : null;
  const centreRows = useMemo(() => (stats?.centres ?? []).map(c => ({id: c.id, name: nameOf.get(c.id) ?? c.id, rate: c.attendance.percentage === null ? null : Number(c.attendance.percentage), present: c.attendance.p})), [stats, nameOf]);
  const centreColumns = useMemo<Column<{id: string; name: string; rate: number | null; present: number}>[]>(() => [
    {id: 'name', header: 'Centre', value: r => r.name},
    {id: 'present', header: 'Present student-days', value: r => r.present, numeric: true},
    {id: 'rate', header: 'Attendance rate', value: r => r.rate === null ? null : Number(r.rate.toFixed(1)), numeric: true, cell: r => r.rate === null ? 'Unknown' : `${r.rate.toFixed(1)}%`},
  ], []);

  if (boot.status !== 'ready') return <AsyncState state={boot.status === 'error' ? 'error' : 'loading'} errorMessage={boot.status === 'error' ? boot.message : undefined} onRetry={() => setBootAttempt(n => n + 1)} loadingLabel="Preparing Attendance" rows={5} />;
  if (!supported) return <p role="alert" className="rounded-md bg-warn-soft p-4 text-sm text-warn">The attendance register API installed here is older than the new interface supports. Use the standard application for attendance.</p>;

  const future = month > today.slice(0, 7);
  const server = register.status === 'ready' ? {total: register.value.total, pageIndex: page.offset / PAGE_SIZE, onPageChange: (index: number) => setPage(p => ({...p, offset: index * PAGE_SIZE})), sort: {id: sortId, desc: (page.sort === 'date') !== page.reverse}, onSortChange: (id: string) => setPage(p => p.sort === id ? {...p, offset: 0, reverse: !p.reverse} : {offset: 0, sort: id as SortKey, reverse: false})} : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Find low attendance, review saved registers and add or correct attendance.</p>
        {canWrite ? <Button onClick={() => openEditor()}>Add Attendance</Button> : <p className="text-xs text-muted">{role === 'Leadership' ? 'Leadership views attendance only.' : caps.enabled ? 'Attendance entry is not available for your centres.' : 'Attendance entry is not enabled for this workspace.'}</p>}
      </div>
      <p role="status" aria-live="polite" className={notice ? 'rounded-md bg-ok-soft p-3 text-sm text-ok' : 'sr-only'}>{notice}</p>

      <div role="group" aria-label="Attendance filters" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-3">
        <Select label="Reporting month" value={month} options={months.map(m => [m, monthLabel(m)])} onChange={value => setFilters(f => ({...f, month: value}))} />
        {scope.length > 1 ? <Select label="Centre" value={filters.centre} options={scope.map(c => [c.id, c.label])} allLabel="All centres" onChange={value => setFilters(f => ({...f, centre: value}))} /> : null}
        <Select label="Shift" value={filters.shift} options={[['Morning', 'Morning'], ['Evening', 'Evening']]} allLabel="Both shifts" onChange={value => setFilters(f => ({...f, shift: value}))} />
        <Select label="Grade" value={filters.grade} options={Array.from({length: 10}, (_, i) => [String(i + 1), String(i + 1)] as [string, string])} allLabel="All grades" onChange={value => setFilters(f => ({...f, grade: value}))} />
        <Select label="Gender" value={filters.gender} options={[['Girl', 'Girls'], ['Boy', 'Boys'], ['Unknown', 'Unknown']]} allLabel="All genders" onChange={value => setFilters(f => ({...f, gender: value}))} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Scorecard reference="2.1" label="Student attendance rate" value={stats ? formatPercent(stats.attendance.percentage) : null} hint="Present ÷ recorded classroom attendance" state={future ? 'unavailable' : stats ? 'ready' : report.status === 'error' ? 'error' : 'loading'} message={future ? 'Future reporting periods have no verified observations.' : report.status === 'error' ? report.message : undefined} />
        <Scorecard reference="2.2" label="Present student-days" value={stats ? formatCount(stats.attendance.p) : null} hint="Selected month" state={future ? 'unavailable' : stats ? 'ready' : report.status === 'error' ? 'error' : 'loading'} message={future ? 'Future reporting periods have no verified observations.' : report.status === 'error' ? report.message : undefined} />
        <Scorecard reference="2.3" label="Students with low attendance" state="unavailable" message="Below 15 days; complete scheduled-day coverage required" tone="alert" />
      </div>

      {register.status === 'error' ? <AsyncState state="error" errorMessage={register.message} onRetry={() => setRefreshKey(k => k + 1)} /> : (
        <div aria-busy={registerBusy} className={registerBusy ? 'opacity-60 transition-opacity' : undefined}>
        <DataTable<RegisterRow>
          reference="2.4" caption="Attendance register" columns={columns} data={register.status === 'ready' ? register.value.rows : []} getRowId={r => `${r.centre_id}|${r.shift_code}|${r.attendance_date}`}
          exportName={`MASS-attendance-register-${month}`} state={register.status === 'ready' ? 'ready' : 'loading'} emptyMessage="No saved attendance for this selection." server={server}
        />
        </div>
      )}
      <p className="text-xs text-muted">Count = present/enrolled on that date. Percentage = present ÷ recorded classroom attendance × 100. Holidays and monthly meetings are excluded; unmarked students remain unknown. Historical leave keeps its original treatment. Edit opens the full register, including students outside the chart filters.</p>

      <ChartCard reference="2.5" title="Attendance over time" subtitle="Monthly present ÷ recorded classroom attendance × 100 · unknown months remain gaps" state={asState(series)} errorMessage={series.status === 'error' ? series.message : undefined} onRetry={() => setRefreshKey(k => k + 1)}>
        <LineChart points={trend} description="Attendance by month" />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard reference="2.6" title="Attendance bands" subtitle="Students by days present · selected month" state={future ? 'empty' : asState(distribution)} emptyMessage="Future reporting periods have no verified observations." errorMessage={distribution.status === 'error' ? distribution.message : undefined} onRetry={() => setRefreshKey(k => k + 1)}>
          <ColumnChart axis="Students" description="Students by days present" items={bandItems} />
          <p className="mt-2 text-xs text-muted">{formatCount(distribution.status === 'ready' ? distribution.value.recorded_students ?? null : null)} students have recorded attendance in this month; students without records are not counted.</p>
        </ChartCard>
        <DataTable<{id: string; name: string; rate: number | null; present: number}>
          reference="2.7" caption="Attendance by centre" columns={centreColumns} data={centreRows} getRowId={r => r.id} exportName={`MASS-attendance-by-centre-${month}`}
          state={future ? 'empty' : asState(report)} emptyMessage="Future reporting periods have no verified observations." errorMessage={report.status === 'error' ? report.message : undefined} onRetry={() => setRefreshKey(k => k + 1)}
        />
      </div>

      {editor && caps ? <RegisterDialog service={service} capabilities={caps} centres={writable.map(c => ({id: c.id, label: c.label}))} initial={editor} today={today} onSaved={afterSave} onClose={() => setEditor(null)} /> : null}
    </div>
  );
}
