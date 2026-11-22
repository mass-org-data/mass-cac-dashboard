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
import {academicMonths, monthLabel, monthShort, reportingDay, todayIst} from '../lib/dates';
import {formatCount, formatDateTime, formatPercent, formatRelativeTime} from '../lib/format';
import {attendanceSummaryDisplay} from '../../../src/live/attendance-register.js';
import {sharedOverview} from '../data/shared';
import type {LiveBackend, References} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';
import {createTableService, type TableRequest, type TableService} from '../tables/service';
import {useServerTable} from '../tables/useServerTable';
import {useI18n} from '../i18n/I18n';
import type {MessageKey} from '../i18n/en';
import {FilterPanel, FilterSelect as Select, english} from '../components/FilterPanel';

type Slice<T> = {status: 'loading'} | {status: 'ready'; value: T} | {status: 'error'; message: string};
const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'This could not be loaded.');
const asState = <T,>(slice: Slice<T>): LoadState => slice.status === 'ready' ? 'ready' : slice.status;

// Attendance bands from the server's days-present distribution. Same bands as the current page; the last band is open-ended.
const BANDS: Array<[MessageKey, (days: number) => boolean]> = [['attendance.below15', d => d < 15], ['attendance.15days', d => d === 15], ['attendance.16to20', d => d >= 16 && d <= 20], ['attendance.21plus', d => d > 20]];


const INITIAL_FILTERS = {month: '', centre: '', shift: '', grade: '', gender: ''};

export function Attendance({backend, context, service: injected, overview: injectedOverview, tables: injectedTables}: {backend: LiveBackend; context: ProgrammeContext; role: string; service?: AttendanceService; overview?: OverviewService; tables?: TableService}) {
  const {t} = useI18n();
  const service = useMemo(() => injected ?? createAttendanceService(backend.rpc), [backend, injected]);
  const overview = useMemo(() => injectedOverview ?? sharedOverview(backend), [backend, injectedOverview]);
  const tables = useMemo(() => injectedTables ?? createTableService(backend.rpc), [backend, injectedTables]);
  const today = useMemo(() => todayIst(), []);

  const [boot, setBoot] = useState<Slice<{caps: RegisterCapabilities; refs: References; hasSeries: boolean}>>({status: 'loading'});
  const [bootAttempt, setBootAttempt] = useState(0);
  const [filters, setFilters] = useState<typeof INITIAL_FILTERS>(INITIAL_FILTERS);
  const [page, setPage] = useState<PageRequest>({offset: 0, sort: 'date', reverse: true});
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

  const scope = context.centres;
  // Write access is per centre and comes from the server (`can_write`). Leadership inherits operational writes for every centre; the server still enforces it.
  const writable = useMemo(() => scope.filter(c => c.can_write), [scope]);
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
  useEffect(() => { setPage({offset: 0, sort: 'date', reverse: true}); }, [queryKey]);

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

  const sortId = ({centre: 'centre', shift: 'shift', date: 'date', present: 'present', percentage: 'percentage', last_edited_at: 'last_edited_at'} as Record<SortKey, string>)[page.sort];
  const columns = useMemo<Column<RegisterRow>[]>(() => [
    {id: 'centre', header: t('common.centre'), value: r => nameOf.get(r.centre_id) ?? r.centre_id},
    {id: 'shift', header: t('common.shift'), value: r => r.shift_code},
    {id: 'date', header: t('common.date'), value: r => r.attendance_date},
    {id: 'present', header: t('attendance.presentCount'), value: r => attendanceSummaryDisplay(r).ratio, numeric: true},
    {id: 'percentage', header: t('attendance.presentPercent'), value: r => attendanceSummaryDisplay(r).percentage, numeric: true, cell: r => { const d = attendanceSummaryDisplay(r); return <>{d.percentage}{d.incomplete ? <span className="block text-xs text-muted">{t('attendance.incomplete')}</span> : null}</>; }},
    {id: 'last_edited_at', header: t('attendance.lastEdited'), value: r => r.last_edited_at ?? null, cell: r => <time dateTime={r.last_edited_at ?? undefined} title={formatDateTime(r.last_edited_at)}>{formatRelativeTime(r.last_edited_at)}</time>},
    {id: 'action', header: t('attendance.edit'), sortable: false, value: r => r.session_type === 'Holiday' ? t('attendance.recordedHoliday') : writable.some(c => c.id === r.centre_id) && canWrite ? t('attendance.edit') : t('attendance.viewOnly'),
      cell: r => r.session_type === 'Holiday' ? t('attendance.recordedHoliday')
        : writable.some(c => c.id === r.centre_id) && canWrite
          ? <Button variant="ghost" size="sm" aria-label={t('attendance.editLabel', {centre: nameOf.get(r.centre_id) ?? r.centre_id, shift: r.shift_code, date: r.attendance_date})} onClick={() => openEditor({centre: r.centre_id, shift: r.shift_code, date: r.attendance_date})}>{t('attendance.edit')}</Button>
          : <span className="text-xs text-muted">{t('attendance.viewOnly')}</span>},
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [nameOf, writable, canWrite, t]);

  const bandItems = distribution.status === 'ready' ? BANDS.map(([label, test]) => ({label: t(label), value: distribution.value.days.filter(d => test(d.days)).reduce((n, d) => n + d.students, 0)})) : [];
  const trend = series.status === 'ready' ? months.map(m => ({label: monthShort(m), value: series.value[m] ?? null})) : [];
  const stats = report.status === 'ready' ? report.value : null;
  interface CentreRow {centre_id: string; centre_label: string; present: number | string; percentage: number | string | null}
  const centreContext = useMemo(() => query && year ? {on: reportingDay(month, today), from: `${month}-01`, until: (() => { const d = new Date(`${month}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); })(), year: year.id, grade: query.grade, shift: query.shift, gender: query.gender, earlier: 1, later: 2, quarter: 2} : null, [queryKey, year, month, today]);
  const loadCentres = useCallback((request: TableRequest) => query && centreContext ? tables.page<CentreRow>('reviewed_centres', query.centres, centreContext, request) : Promise.resolve({rows: [], total: 0}), [tables, queryKey, centreContext]);
  const centreTable = useServerTable<CentreRow>({key: JSON.stringify([queryKey, centreContext]), load: loadCentres, initialSort: 'centre', refreshKey});
  const centreColumns = useMemo<Column<CentreRow>[]>(() => [
    {id: 'centre', header: t('common.centre'), value: r => r.centre_label},
    {id: 'present', header: t('attendance.presentDays'), value: r => Number(r.present), numeric: true},
    {id: 'attendance', header: t('attendance.rate'), value: r => r.percentage === null ? null : Number(Number(r.percentage).toFixed(1)), numeric: true, cell: r => r.percentage === null ? t('common.unknown') : formatPercent(Number(r.percentage))},
  ], [t]);

  if (boot.status !== 'ready') return <AsyncState state={boot.status === 'error' ? 'error' : 'loading'} errorMessage={boot.status === 'error' ? boot.message : undefined} onRetry={() => setBootAttempt(n => n + 1)} loadingLabel={t('attendance.prepare')} rows={5} />;
  if (!supported) return <p role="alert" className="rounded-md bg-warn-soft p-4 text-sm text-warn">{t('attendance.oldApi')}</p>;

  const future = month > today.slice(0, 7);
  const server = register.status === 'ready' && query ? {total: register.value.total, pageIndex: page.offset / PAGE_SIZE, onPageChange: (index: number) => setPage(p => ({...p, offset: index * PAGE_SIZE})), sort: {id: sortId, desc: page.reverse}, onSortChange: (id: string) => setPage(p => p.sort === id ? {...p, offset: 0, reverse: !p.reverse} : {offset: 0, sort: id as SortKey, reverse: false}), exportRows: async () => {
    const rows: RegisterRow[] = [];
    for (let offset = 0; offset <= 1000000; offset += 500) {
      const found = await service.page(query, {...page, offset, limit: 500}); rows.push(...found.rows);
      if (rows.length >= found.total || found.rows.length < 500) return rows;
    }
    throw new Error('The export is too large. Narrow the filters and try again.');
  }} : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t('attendance.intro')}</p>
        {canWrite ? <Button onClick={() => openEditor()}>{t('attendance.add')}</Button> : <p className="text-xs text-muted">{t(caps.enabled ? 'attendance.noCentreWrite' : 'attendance.disabled')}</p>}
      </div>
      <p role="status" aria-live="polite" className={notice ? 'rounded-md bg-ok-soft p-3 text-sm text-ok' : 'sr-only'}>{notice}</p>

      <FilterPanel label={t('attendance.filters')} active={JSON.stringify(filters) !== JSON.stringify(INITIAL_FILTERS)} onClear={() => setFilters(INITIAL_FILTERS)}>
        <Select active={filters.month !== ''} label={t('overview.reportingMonth')} value={month} options={months.map(m => [m, monthLabel(m)])} onChange={value => setFilters(f => ({...f, month: value}))} />
        {scope.length > 1 ? <Select label={t('common.centre')} value={filters.centre} options={scope.map(c => [c.id, c.label])} allLabel={english('common.allCentres')} onChange={value => setFilters(f => ({...f, centre: value}))} /> : null}
        <Select label={t('common.shift')} value={filters.shift} options={[['Morning', english('common.morning')], ['Evening', english('common.evening')]]} allLabel={english('common.bothShifts')} onChange={value => setFilters(f => ({...f, shift: value}))} />
        <Select label={t('common.grade')} value={filters.grade} options={Array.from({length: 10}, (_, i) => [String(i + 1), String(i + 1)] as [string, string])} allLabel={english('common.allGrades')} onChange={value => setFilters(f => ({...f, grade: value}))} />
        <Select label={t('common.gender')} value={filters.gender} options={[['Girl', english('common.girls')], ['Boy', english('common.boys')], ['Unknown', english('common.unknown')]]} allLabel={english('common.allGenders')} onChange={value => setFilters(f => ({...f, gender: value}))} />
      </FilterPanel>

      <div className="grid gap-4 sm:grid-cols-2">
        <Scorecard reference="2.1" label={t('attendance.studentRate')} value={stats ? formatPercent(stats.attendance.percentage) : null} state={future ? 'unavailable' : stats ? 'ready' : report.status === 'error' ? 'error' : 'loading'} message={future ? t('common.future') : report.status === 'error' ? report.message : undefined} />
        <Scorecard reference="2.2" label={t('attendance.low')} state="unavailable" message={t('attendance.lowHelp')} tone="alert" />
      </div>

      {register.status === 'error' ? <AsyncState state="error" errorMessage={register.message} onRetry={() => setRefreshKey(k => k + 1)} /> : (
        <div aria-busy={registerBusy} className={registerBusy ? 'opacity-60 transition-opacity' : undefined}>
        <DataTable<RegisterRow>
          reference="2.3" caption={t('attendance.register')} columns={columns} data={register.status === 'ready' ? register.value.rows : []} getRowId={r => `${r.centre_id}|${r.shift_code}|${r.attendance_date}`}
          exportName={context.capabilities?.export === true ? `MASS-attendance-register-${month}` : undefined} state={register.status === 'ready' ? 'ready' : 'loading'} emptyMessage={t('attendance.noSaved')} server={server}
        />
        </div>
      )}
      <p className="text-xs text-muted">{t('attendance.registerFootnote')}</p>


      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard reference="2.4" title={t('attendance.overTime')} subtitle={t('attendance.overTimeHelp')} state={asState(series)} errorMessage={series.status === 'error' ? series.message : undefined} onRetry={() => setRefreshKey(k => k + 1)}>
          <LineChart points={trend} description={t('attendance.byMonth')} />
        </ChartCard>
        <ChartCard reference="2.5" title={t('attendance.bands')} subtitle={t('attendance.bandsHelp')} state={future ? 'empty' : asState(distribution)} emptyMessage={t('common.future')} errorMessage={distribution.status === 'error' ? distribution.message : undefined} onRetry={() => setRefreshKey(k => k + 1)}>
          <ColumnChart axis={t('common.students')} description={t('attendance.byDays')} items={bandItems} />
          <p className="mt-2 text-xs text-muted">{t('attendance.recordedStudentHelp', {count: formatCount(distribution.status === 'ready' ? distribution.value.recorded_students ?? null : null)})}</p>
        </ChartCard>
      </div>

      <DataTable<CentreRow>
        reference="2.6" caption={t('attendance.byCentre')} columns={centreColumns} data={centreTable.rows} getRowId={r => r.centre_id} exportName={context.capabilities?.export === true ? `MASS-attendance-by-centre-${month}` : undefined}
        state={future ? 'empty' : centreTable.result.status} server={centreTable.server} emptyMessage={future ? t('common.future') : t('overview.noCentres')} errorMessage={centreTable.error} onRetry={centreTable.retry}
      />

      {editor && caps ? <RegisterDialog service={service} capabilities={caps} centres={writable.map(c => ({id: c.id, label: c.label}))} initial={editor} today={today} onSaved={afterSave} onClose={() => setEditor(null)} /> : null}
    </div>
  );
}
