import {useEffect, useState} from 'react';
import type {Rpc} from '../session/backend';
import {useI18n} from '../i18n/I18n';
import {DataTable, type Column} from './DataTable';
import {ChartCard} from './ChartCard';
import {ColumnChart} from './charts/ColumnChart';

type Centre = {id: string; label: string};
type Filters = {centre_id: string; shift_code: 'Morning' | 'Evening'};
type Activity = Filters & {
  recorded_students: number | string;
  students_at_least_two: number | string;
  cultural_responses: number | string;
  sports_responses: number | string;
  missing_responses: number | string;
};
type Visit = Filters & {recorded_visits: number | string};
type Selection = {rpc: Rpc; centres: Centre[]; month: string; shift: string | null};
type Report =
  | (Selection & {kind: 'activity'; grade: string | null; gender: string | null})
  | (Selection & {kind: 'visits'; officer: string | null});

type Result =
  | {status: 'loading'}
  | {status: 'error'}
  | {status: 'ready'; rows: Activity[] | Visit[]};

export function HistoricalReports(report: Report) {
  const {t} = useI18n();
  const [open, setOpen] = useState(false);
  const caption = t(report.kind === 'activity' ? 'history.activity' : 'history.visits');
  const request = JSON.stringify({
    p_centres: report.centres.map(centre => centre.id),
    p_month: `${report.month}-01`,
    p_shift: report.shift,
    ...(report.kind === 'activity' ? {p_grade: report.grade, p_gender: report.gender} : {p_officer: report.officer}),
  });

  return <details className="rounded-lg border border-line bg-white p-4" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-semibold text-ink">{caption}</summary>
    {open ? <HistoricalResults key={request} report={report} request={request} /> : null}
  </details>;
}

function HistoricalResults({report, request}: {report: Report; request: string}) {
  const {t} = useI18n();
  const [result, setResult] = useState<Result>({status: 'loading'});
  const [attempt, setAttempt] = useState(0);
  const {rpc, kind} = report;

  useEffect(() => {
    const params = JSON.parse(request) as {p_centres: string[]};
    if (params.p_centres.length === 0) {
      setResult({status: 'ready', rows: []});
      return;
    }

    let active = true;
    setResult({status: 'loading'});
    const method = kind === 'activity' ? 'monthly_activity_history_summary' : 'historical_visit_summary';
    rpc<Activity[] | Visit[]>(method, params)
      .then(rows => { if (active) setResult({status: 'ready', rows}); })
      .catch(() => { if (active) setResult({status: 'error'}); });
    return () => { active = false; };
  }, [rpc, kind, request, attempt]);

  const centreNames = new Map(report.centres.map(centre => [centre.id, centre.label]));
  const shiftLabel = (shift: Filters['shift_code']) => t(shift === 'Morning' ? 'common.morning' : 'common.evening');
  const shared: Column<Filters>[] = [
    {id: 'centre', header: t('common.centre'), value: row => centreNames.get(row.centre_id)},
    {id: 'shift', header: t('common.shift'), value: row => shiftLabel(row.shift_code)},
  ];
  const rows = result.status === 'ready' ? result.rows : [];
  const getRowId = (row: Filters) => `${row.centre_id}-${row.shift_code}`;
  const retry = () => setAttempt(n => n + 1);
  const state = result.status === 'ready' && rows.length === 0 ? 'empty' : result.status;
  const emptyMessage = t('history.empty');
  const errorMessage = t('history.error');

  if (kind === 'activity') {
    const activityRows = rows as Activity[];
    const columns: Column<Activity>[] = [
      ...shared,
      {id: 'students', header: t('history.students'), numeric: true, value: row => Number(row.recorded_students)},
      {id: 'two', header: t('history.two'), numeric: true, value: row => Number(row.students_at_least_two)},
      {id: 'cultural', header: t('history.cultural'), numeric: true, value: row => Number(row.cultural_responses)},
      {id: 'sports', header: t('history.sports'), numeric: true, value: row => Number(row.sports_responses)},
      {id: 'missing', header: t('history.missing'), numeric: true, value: row => Number(row.missing_responses)},
    ];
    const total = (key: 'cultural_responses' | 'sports_responses') => activityRows.reduce((sum, row) => sum + Number(row[key]), 0);

    return <div className="mt-4 space-y-4">
      <ChartCard title={t('history.activityChart')} subtitle={t('history.activityBasis')} state={state} emptyMessage={emptyMessage} errorMessage={errorMessage} onRetry={retry}>
        <ColumnChart axis={t('history.yesResponses')} description={t('history.activityChart')} items={[
          {label: t('history.cultural'), value: total('cultural_responses')},
          {label: t('history.sports'), value: total('sports_responses')},
        ]} />
      </ChartCard>
      {rows.length > 0 ? <DataTable caption={t('history.byCentre')} columns={columns} data={activityRows} getRowId={getRowId} /> : null}
    </div>;
  }

  const visitRows = rows as Visit[];
  const columns: Column<Visit>[] = [
    ...shared,
    {id: 'visits', header: t('history.visitCount'), numeric: true, value: row => Number(row.recorded_visits)},
  ];
  const shifts = (['Morning', 'Evening'] as const).filter(shift => !report.shift || shift === report.shift);

  return <div className="mt-4 space-y-4">
    <ChartCard title={t('history.visitChart')} subtitle={t('history.visitBasis')} state={state} emptyMessage={emptyMessage} errorMessage={errorMessage} onRetry={retry}>
      <ColumnChart axis={t('history.visitCount')} description={t('history.visitChart')} items={shifts.map(shift => ({
        label: shiftLabel(shift),
        value: visitRows.filter(row => row.shift_code === shift).reduce((sum, row) => sum + Number(row.recorded_visits), 0),
      }))} />
    </ChartCard>
    {rows.length > 0 ? <DataTable caption={t('history.byCentre')} columns={columns} data={visitRows} getRowId={getRowId} /> : null}
  </div>;
}
