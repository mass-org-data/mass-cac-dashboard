import {useCallback, useEffect, useMemo, useState} from 'react';
import {AsyncState, type LoadState} from '../components/AsyncState';
import {ChartCard} from '../components/ChartCard';
import {ColumnChart} from '../components/charts/ColumnChart';
import {LineChart} from '../components/charts/LineChart';
import {DataTable, type Column} from '../components/DataTable';
import {Scorecard, type ScorecardState} from '../components/Scorecard';
import {academicMonths, monthLabel, monthShort, reportingDay, todayIst} from '../lib/dates';
import {formatCount, formatPercent, UNKNOWN} from '../lib/format';
import {FUTURE_NOTICE, type Environment, type OverviewService, type Report, type Selection} from '../data/overview';
import {useOverview, type Slice} from '../data/useOverview';
import {sharedOverview} from '../data/shared';
import type {Capabilities, LiveBackend, References} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';
import {createTableService, type TableRequest, type TableService} from '../tables/service';
import {useServerTable} from '../tables/useServerTable';

const ROLE_HEADING: Record<string, string> = {'Cluster Officer': 'Centres assigned to you'};
const FROM_QUARTER = 1;
const TO_QUARTER = 2; // the exam shown on the scorecards (F2), as in the current Overview

interface Bootstrap {refs: References; capabilities: Capabilities; donors: Record<string, string | null>}
interface CentreRow {centre_id: string; centre_label: string; children: number; percentage: number | string | null; score_n: number | string | null; score_mean: number | string | null}
const EMPTY_DONORS: Record<string, string | null> = {};

const sliceState = <T,>(slice: Slice<T>): LoadState => slice.status === 'ready' ? 'ready' : slice.status === 'error' ? 'error' : slice.status === 'future' ? 'empty' : 'loading';
const cardState = <T,>(slice: Slice<T>): ScorecardState => slice.status === 'ready' ? 'ready' : slice.status === 'error' ? 'error' : slice.status === 'future' ? 'unavailable' : 'loading';

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

export function Overview({backend, context, role, service: injected, tables: injectedTables}: {backend: LiveBackend; context: ProgrammeContext; role: string; service?: OverviewService; tables?: TableService}) {
  const service = useMemo(() => injected ?? sharedOverview(backend), [backend, injected]);
  const tables = useMemo(() => injectedTables ?? createTableService(backend.rpc), [backend, injectedTables]);
  const [boot, setBoot] = useState<Slice<Bootstrap>>({status: 'loading'});
  const [bootAttempt, setBootAttempt] = useState(0);
  const [filters, setFilters] = useState({month: '', centre: '', donor: '', shift: '', grade: '', gender: ''});

  // References and capabilities gate the first report; the donor directory only adds labels and the donor filter.
  useEffect(() => {
    let live = true;
    setBoot({status: 'loading'});
    Promise.all([backend.readReferences(), backend.readCapabilities(), backend.readDirectory().catch(() => null)]).then(([refs, capabilities, directory]) => {
      if (!live) return;
      if (!capabilities.reviewedCharts) { setBoot({status: 'error', message: 'This backend has not enabled the reviewed reports the Overview needs.'}); return; }
      setBoot({status: 'ready', value: {refs, capabilities, donors: directory ? Object.fromEntries(directory.map(row => [row.centre_id, row.donor_label ?? null])) : {}}});
    }).catch(() => { if (live) setBoot({status: 'error', message: 'The Overview could not be prepared.'}); });
    return () => { live = false; };
  }, [backend, bootAttempt]);

  const today = useMemo(() => todayIst(), []);
  const year = boot.status === 'ready' ? (boot.value.refs.academic_years.find(y => y.starts_on <= today && today < y.ends_before) ?? [...boot.value.refs.academic_years].sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0]) : null;
  const months = useMemo(() => (year ? academicMonths(year.starts_on) : []), [year]);
  const defaultMonth = year && year.starts_on <= today && today < year.ends_before ? today.slice(0, 7) : months[0] ?? '';
  const month = filters.month || defaultMonth;

  const scope = useMemo(() => context.centres.filter(centre => centre.roles.includes(role)), [context, role]);
  const donors = boot.status === 'ready' ? boot.value.donors : EMPTY_DONORS;
  const donorNames = useMemo(() => [...new Set(scope.map(c => donors[c.id]).filter((d): d is string => Boolean(d)))].sort(), [scope, donors]);
  const selected = useMemo(() => scope.filter(c => (!filters.centre || c.id === filters.centre) && (!filters.donor || donors[c.id] === filters.donor)), [scope, filters.centre, filters.donor, donors]);

  const configuredQuarters = useMemo(() => {
    if (boot.status !== 'ready' || !year) return new Set<number>();
    const periods = new Map(boot.value.refs.assessment_periods.map(p => [p.id, p]));
    return new Set(boot.value.refs.assessment_definitions.map(d => periods.get(d.period_id)).filter(p => p?.academic_year_id === year.id).map(p => p!.quarter));
  }, [boot, year]);

  const leadership = role === 'Leadership';
  const selection: Selection | null = useMemo(() => boot.status === 'ready' && year && month ? {month, centres: selected.map(c => c.id), shift: leadership ? null : filters.shift || null, grade: leadership ? null : filters.grade || null, gender: leadership ? null : filters.gender || null} : null, [boot.status, year, month, selected, leadership, filters.shift, filters.grade, filters.gender]);
  const env: Environment | null = useMemo(() => boot.status === 'ready' && year ? {yearId: year.id, today, fromQuarter: FROM_QUARTER, toQuarter: TO_QUARTER, months, hasSeries: boot.value.capabilities.reviewedAttendanceSeries} : null, [boot, year, today, months]);
  const {report, shifts, series, retry} = useOverview(service, selection, env);

  const stats: Report | null = report.status === 'ready' ? report.value : null;
  const quarter = stats?.quarters.find(q => q.quarter === TO_QUARTER);
  const donorCount = new Set(selected.map(c => donors[c.id]).filter(Boolean)).size;
  const girls = stats?.genders.Girl ?? 0;
  const boys = stats?.genders.Boy ?? 0;
  const population = stats?.children ?? 0;
  const reportMessage = report.status === 'error' ? report.message : report.status === 'future' ? FUTURE_NOTICE : undefined;

  const tableContext = useMemo(() => selection && env ? {on: reportingDay(selection.month, env.today), from: `${selection.month}-01`, until: (() => { const d = new Date(`${selection.month}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); })(), year: env.yearId, grade: selection.grade, shift: selection.shift, gender: selection.gender, earlier: env.fromQuarter, later: env.toQuarter, quarter: TO_QUARTER} : null, [selection, env]);
  const loadCentres = useCallback((request: TableRequest) => selection && tableContext ? tables.page<CentreRow>('reviewed_centres', selection.centres, tableContext, request) : Promise.resolve({rows: [], total: 0}), [tables, selection, tableContext]);
  const centreTable = useServerTable({key: JSON.stringify([selection, tableContext]), load: loadCentres, initialSort: 'centre'});

  const columns = useMemo<Column<CentreRow>[]>(() => [
    {id: 'centre', header: 'Centre', value: row => row.centre_label},
    {id: 'students', header: 'Students', value: row => Number(row.children), numeric: true},
    {id: 'attendance', header: 'Attendance Rate', value: row => row.percentage === null ? null : Number(Number(row.percentage).toFixed(1)), numeric: true, cell: row => row.percentage === null ? 'Unknown' : `${Number(row.percentage).toFixed(1)}%`},
    {id: 'score', header: 'Average Exam Score', value: row => !Number(row.score_n) || row.score_mean === null ? null : Number(Number(row.score_mean).toFixed(1)), numeric: true, cell: row => !Number(row.score_n) || row.score_mean === null ? 'Unknown' : `${Number(row.score_mean).toFixed(1)} / 25`},
  ], []);

  const trend = series.status === 'ready' ? months.map(m => ({label: monthShort(m), value: series.value[m] ?? null})) : [];

  if (boot.status !== 'ready') {
    return <AsyncState state={boot.status === 'error' ? 'error' : 'loading'} errorMessage={boot.status === 'error' ? boot.message : undefined} onRetry={() => setBootAttempt(n => n + 1)} loadingLabel="Preparing the Overview" rows={5} />;
  }

  return (
    <div className="space-y-6">
      <div role="group" aria-label="Overview filters" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-3">
        <Select label="Reporting month" value={month} options={months.map(m => [m, monthLabel(m)])} onChange={value => setFilters(f => ({...f, month: value}))} />
        {scope.length > 1 ? <Select label="Centre" value={filters.centre} options={scope.map(c => [c.id, c.label])} allLabel="All centres" onChange={value => setFilters(f => ({...f, centre: value}))} /> : null}
        {leadership && donorNames.length > 0 ? <Select label="Donor" value={filters.donor} options={donorNames.map(n => [n, n])} allLabel="All donors" onChange={value => setFilters(f => ({...f, donor: value}))} /> : null}
        {leadership ? null : <>
          <Select label="Shift" value={filters.shift} options={[['Morning', 'Morning'], ['Evening', 'Evening']]} allLabel="Both shifts" onChange={value => setFilters(f => ({...f, shift: value}))} />
          <Select label="Grade" value={filters.grade} options={Array.from({length: 10}, (_, i) => [String(i + 1), String(i + 1)] as [string, string])} allLabel="All grades" onChange={value => setFilters(f => ({...f, grade: value}))} />
          <Select label="Gender" value={filters.gender} options={[['Girl', 'Girls'], ['Boy', 'Boys'], ['Unknown', 'Unknown']]} allLabel="All genders" onChange={value => setFilters(f => ({...f, gender: value}))} />
        </>}
      </div>

      {selected.length === 0 ? <AsyncState state="empty" emptyMessage="No centres match these filters." /> : <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Scorecard reference="1.1" label={ROLE_HEADING[role] ?? 'Centres in this selection'} value={formatCount(role === 'Cluster Officer' ? scope.length : selected.length)} />
          <Scorecard reference="1.2" label="Students enrolled" value={stats ? formatCount(stats.children) : null} state={cardState(report)} message={reportMessage} />
          <Scorecard reference="1.3" label="Girls" value={stats && population > 0 ? formatPercent((girls / population) * 100) : null} hint={stats ? `${formatCount(girls)} students` : undefined} state={cardState(report)} message={reportMessage} />
          <Scorecard reference="1.4" label="Boys" value={stats && population > 0 ? formatPercent((boys / population) * 100) : null} hint={stats ? `${formatCount(boys)} students` : undefined} state={cardState(report)} message={reportMessage} />
          <Scorecard reference="1.5" label="Donors represented" value={formatCount(donorCount)} />
          <Scorecard reference="1.6" label="Students with good engagement" state="unavailable" message="Agreed engagement rule; complete records required" />
          <Scorecard reference="1.7" label="Students with low attendance" state="unavailable" message="Below 15 days; complete scheduled-day coverage required" tone="alert" />
          <Scorecard
            reference="1.8" label="Students scoring above 20"
            value={quarter ? formatCount(quarter.above20 ?? null) : null}
            hint={`F${TO_QUARTER} · out of 25`}
            state={!configuredQuarters.has(TO_QUARTER) ? 'unavailable' : cardState(report)}
            message={!configuredQuarters.has(TO_QUARTER) ? 'No approved assessment definition exists for this quarter.' : reportMessage}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard reference="1.9" title="Students by grade" subtitle="Authorized aggregate · selected filters" state={sliceState(report)} errorMessage={reportMessage} emptyMessage={FUTURE_NOTICE} onRetry={retry}>
            {stats ? <ColumnChart axis="Students" description="Students by grade" items={Array.from({length: 10}, (_, i) => ({label: String(i + 1), value: stats.grades[String(i + 1)] ?? 0}))} /> : null}
          </ChartCard>
          <ChartCard reference="1.10" title="Students by gender" subtitle="Aggregate counts only; private profiles remain restricted." state={sliceState(report)} errorMessage={reportMessage} emptyMessage={FUTURE_NOTICE} onRetry={retry}>
            {stats ? <ColumnChart axis="Students" description="Students by gender" items={[{label: 'Girls', value: stats.genders.Girl ?? 0, tone: 'accent'}, {label: 'Boys', value: stats.genders.Boy ?? 0}]} /> : null}
          </ChartCard>
          <ChartCard reference="1.11" title="Students by shift" subtitle="Distinct active children within each recorded shift." state={sliceState(shifts)} errorMessage={shifts.status === 'error' ? shifts.message : undefined} emptyMessage={FUTURE_NOTICE} onRetry={retry}>
            {shifts.status === 'ready' ? <ColumnChart axis="Students" description="Students by shift" items={[{label: 'Morning', value: shifts.value.Morning}, {label: 'Evening', value: shifts.value.Evening}]} /> : null}
          </ChartCard>
        </div>

        <ChartCard reference="1.12" title="Attendance over time" subtitle="Monthly present ÷ recorded classroom attendance × 100 · unknown months remain gaps" state={series.status === 'ready' ? 'ready' : series.status === 'error' ? 'error' : 'loading'} errorMessage={series.status === 'error' ? series.message : undefined} onRetry={retry}>
          <LineChart points={trend} description="Attendance by month" />
        </ChartCard>

        <DataTable<CentreRow>
          reference="1.13" caption="Centre comparison" columns={columns} data={centreTable.rows} getRowId={row => row.centre_id}
          exportName={`MASS-centre-comparison-${month}`} state={centreTable.result.status} server={centreTable.server}
          errorMessage={centreTable.error} emptyMessage="No centres match these filters." onRetry={centreTable.retry}
        />
        <p className="text-xs text-muted">Values come from the same authorised reports as the current interface. {UNKNOWN} means not recorded, never zero. {formatPercent(stats?.attendance.percentage ?? null)} is the selected month’s overall attendance rate.</p>
      </>}
    </div>
  );
}
