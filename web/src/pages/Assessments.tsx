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
interface CentreRow {id: string; name: string; n: number; mean: number | null}

export function Assessments({backend, context, role, service: injected, overview: injectedOverview}: {backend: LiveBackend; context: ProgrammeContext; role: string; service?: AssessmentsService; overview?: OverviewService}) {
  const service = useMemo(() => injected ?? createAssessmentsService(backend.rpc), [backend, injected]);
  const overview = useMemo(() => injectedOverview ?? sharedOverview(backend), [backend, injectedOverview]);
  const today = useMemo(() => todayIst(), []);
  const [boot, setBoot] = useState<Slice<Boot>>({status: 'loading'});
  const [bootAttempt, setBootAttempt] = useState(0);
  const [filters, setFilters] = useState({round: '2', pair: '1|2', centre: '', shift: '', grade: '', gender: ''});
  const [report, setReport] = useState<Slice<Report>>({status: 'loading'});
  const [register, setRegister] = useState<Slice<RegisterRow[]>>({status: 'loading'});
  const [refreshKey, setRefreshKey] = useState(0);
  const [entering, setEntering] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let live = true;
    setBoot({status: 'loading'});
    Promise.all([backend.readReferences(), backend.readCapabilities()]).then(([refs, capabilities]) => {
      if (!live) return;
      if (!capabilities.reviewedCharts) { setBoot({status: 'error', message: 'This backend has not enabled the reviewed reports Assessments needs.'}); return; }
      setBoot({status: 'ready', value: {refs, capabilities}});
    }).catch(error => { if (live) setBoot({status: 'error', message: messageOf(error)}); });
    return () => { live = false; };
  }, [backend, bootAttempt]);

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
    setReport({status: 'loading'}); setRegister({status: 'loading'});
    const env = {yearId: year.id, today, fromQuarter, toQuarter, months, hasSeries: false};
    if (selection.centres.length === 0) { setReport({status: 'error', message: 'No centres are in this selection.'}); setRegister({status: 'ready', value: []}); return; }
    overview.report(selection, env).then(value => { if (live) setReport({status: 'ready', value}); }).catch(error => { if (live) setReport({status: 'error', message: messageOf(error)}); });
    service.register({centres: selection.centres, yearId: year.id, shift: selection.shift, grade: selection.grade, gender: selection.gender})
      .then(value => { if (live) setRegister({status: 'ready', value}); }).catch(error => { if (live) setRegister({status: 'error', message: messageOf(error)}); });
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
  const centreRows = useMemo<CentreRow[]>(() => (stats?.centres ?? []).map(c => { const item = c.quarters.find(x => x.quarter === round); return {id: c.id, name: nameOf.get(c.id) ?? c.id, n: item?.n ?? 0, mean: item?.mean ?? null}; }), [stats, nameOf, round]);
  const centreColumns = useMemo<Column<CentreRow>[]>(() => [
    {id: 'name', header: 'Centre', value: r => r.name},
    {id: 'n', header: 'Students with scores', value: r => r.n, numeric: true},
    {id: 'mean', header: 'Average score (out of 25)', value: r => one(r.mean), numeric: true, cell: r => r.mean === null ? 'Unknown' : r.mean.toFixed(1)},
  ], []);
  const registerColumns = useMemo<Column<RegisterRow>[]>(() => [
    {id: 'centre', header: 'Centre', value: r => nameOf.get(r.centre_id) ?? r.centre_id},
    {id: 'shift', header: 'Shift', value: r => r.shift_code},
    {id: 'date', header: 'Assessment date', value: r => r.assessment_date ?? 'Unknown', cell: r => r.assessment_date ?? <span title="Historical records keep an unknown date">Unknown</span>},
    {id: 'round', header: 'Round', value: r => `F${r.quarter}`},
    {id: 'students', header: 'Students with scores', value: r => Number(r.students), numeric: true},
    {id: 'average', header: 'Average score', value: r => (r.average_score === null ? null : Number(Number(r.average_score).toFixed(1))), numeric: true, cell: r => (r.average_score === null ? 'Unknown' : Number(r.average_score).toFixed(1))},
    {id: 'created', header: 'Created by', value: r => r.created_by ?? 'Not recorded'},
    {id: 'edited', header: 'Last edited by', value: r => r.last_edited_by ?? 'Not recorded'},
    {id: 'at', header: 'Last edited at', value: r => r.last_edited_at ?? 'Not recorded'},
  ], [nameOf]);

  if (boot.status !== 'ready') return <AsyncState state={boot.status === 'error' ? 'error' : 'loading'} errorMessage={boot.status === 'error' ? boot.message : undefined} onRetry={() => setBootAttempt(n => n + 1)} loadingLabel="Preparing Assessments" rows={5} />;
  const canEnter = writable.length > 0 && Boolean(year);
  const entryEnabled = boot.value.capabilities.writes?.assessment_entry === true;
  const reportMessage = report.status === 'error' ? report.message : undefined;
  const round_label = `F${round}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{role === 'Leadership' ? 'Review combined-test performance and matched-student changes.' : 'Review one combined CAC test per exam round and enter marks.'}</p>
        {canEnter ? <Button onClick={() => { setNotice(''); setEntering(true); }}>Enter marks</Button> : <p className="text-xs text-muted">{role === 'Leadership' ? 'Leadership views assessments only.' : 'Assessment entry is not available for your centres.'}</p>}
      </div>
      <p role="status" aria-live="polite" className={notice ? 'rounded-md bg-ok-soft p-3 text-sm text-ok' : 'sr-only'}>{notice}</p>

      <div role="group" aria-label="Assessment filters" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-3">
        <Select label="Exam round" value={filters.round} options={ROUNDS} onChange={value => setFilters(f => ({...f, round: value}))} />
        <Select label="Compare rounds" value={filters.pair} options={PAIRS} onChange={value => setFilters(f => ({...f, pair: value}))} />
        {scope.length > 1 ? <Select label="Centre" value={filters.centre} options={scope.map(c => [c.id, c.label])} allLabel="All centres" onChange={value => setFilters(f => ({...f, centre: value}))} /> : null}
        <Select label="Shift" value={filters.shift} options={[['Morning', 'Morning'], ['Evening', 'Evening']]} allLabel="Both shifts" onChange={value => setFilters(f => ({...f, shift: value}))} />
        <Select label="Grade" value={filters.grade} options={Array.from({length: 10}, (_, i) => [String(i + 1), String(i + 1)] as [string, string])} allLabel="All grades" onChange={value => setFilters(f => ({...f, grade: value}))} />
        <Select label="Gender" value={filters.gender} options={[['Girl', 'Girls'], ['Boy', 'Boys'], ['Unknown', 'Unknown']]} allLabel="All genders" onChange={value => setFilters(f => ({...f, gender: value}))} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Scorecard reference="4.1" label="Students with exam scores recorded" value={stats ? `${formatCount(q?.n ?? 0)} / ${formatCount(stats.children)}` : null} hint={`${round_label} · selected students`} state={cardState(report)} message={reportMessage} />
        <Scorecard reference="4.2" label="Average student exam score" value={q?.mean != null ? q.mean.toFixed(1) : null} hint="Combined test · out of 25" state={stats && q?.mean == null ? 'unavailable' : cardState(report)} message={stats && q?.mean == null ? 'No scores are recorded for this round' : reportMessage} />
        <Scorecard reference="4.3" label="Students without an exam score" value={stats ? formatCount(stats.children - (q?.n ?? 0)) : null} hint="Missing is not a zero score" state={cardState(report)} message={reportMessage} />
        <Scorecard reference="4.4" label="Average score improvement" value={growth === null ? null : `${growth > 0 ? '+' : ''}${growth.toFixed(1)}%`} hint={`F${fromQuarter} → F${toQuarter} · ${change?.n ?? 0} matched students`} state={stats && growth === null ? 'unavailable' : cardState(report)} message={stats && growth === null ? 'Needs matched students and a non-zero earlier average' : reportMessage} />
      </div>
      <p className="rounded-md bg-brand-soft p-3 text-sm"><strong>Combined test only.</strong> F1–F4 are separate exam rounds with a maximum of 25 marks. Missing scores stay unknown. Percentage improvement = (later average − earlier average) ÷ earlier average × 100 for the same matched students; it is not the percentage of students who improved. Equal maxima alone do not prove paper comparability.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard reference="4.5" title="Current exam performance" subtitle={`${round_label} · 25-mark records only`} state={asState(report)} errorMessage={reportMessage} onRetry={() => setRefreshKey(k => k + 1)} emptyMessage="No scores are recorded for this round.">
          {bands.length ? <><ColumnChart axis="Students" description={`Students by score band, ${round_label}`} items={bands} /><p className="mt-2 text-xs text-muted">Recorded n={q?.n}; fractional marks unbanded={q?.precision_review ?? 0}.</p></> : <p className="text-sm text-muted">No scores are recorded for this round; nothing is counted as zero.</p>}
        </ChartCard>
        <ChartCard reference="4.6" title="Progress across exam rounds" subtitle="Average score by round · selected students" state={asState(report)} errorMessage={reportMessage} onRetry={() => setRefreshKey(k => k + 1)}>
          <ColumnChart axis="Average score (out of 25)" description="Average score by exam round" items={progress} />
          <p className="mt-2 text-xs text-muted">Round averages may include different children; the matched comparison below uses the same students.</p>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable<CentreRow> reference="4.7" caption="Average score by centre" columns={centreColumns} data={centreRows} getRowId={r => r.id} exportName={`MASS-assessment-by-centre-${round_label}`}
          state={asState(report)} errorMessage={reportMessage} emptyMessage="No centres in this selection." onRetry={() => setRefreshKey(k => k + 1)} />
        <ChartCard reference="4.8" title="Matched comparison" subtitle={`F${fromQuarter} → F${toQuarter} · students with both scores`} state={asState(report)} errorMessage={reportMessage} onRetry={() => setRefreshKey(k => k + 1)}>
          {change && change.n > 0 ? (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted">Matched students</dt><dd className="font-semibold">{formatCount(change.n)}</dd>
              <dt className="text-muted">Improved</dt><dd className="font-semibold">{formatCount(change.improved)}</dd>
              <dt className="text-muted">Unchanged</dt><dd className="font-semibold">{formatCount(change.unchanged)}</dd>
              <dt className="text-muted">Declined</dt><dd className="font-semibold">{formatCount(change.declined)}</dd>
              <dt className="text-muted">Average change (marks)</dt><dd className="font-semibold">{change.meanChange === null ? 'Unknown' : `${change.meanChange > 0 ? '+' : ''}${change.meanChange.toFixed(1)}`}</dd>
              <dt className="text-muted">Average, earlier → later</dt><dd className="font-semibold">{change.earlierMean === null || change.laterMean === null ? 'Unknown' : `${change.earlierMean.toFixed(1)} → ${change.laterMean.toFixed(1)}`}</dd>
            </dl>
          ) : <p className="text-sm text-muted">No students have a recorded score in both rounds. Nothing is inferred.</p>}
        </ChartCard>
      </div>

      {register.status === 'error' ? <AsyncState state="error" errorMessage={register.message} onRetry={() => setRefreshKey(k => k + 1)} /> : (
        <DataTable<RegisterRow> reference="4.9" caption="Assessment register" columns={registerColumns} data={register.status === 'ready' ? register.value : []}
          getRowId={r => `${r.centre_id}|${r.shift_code}|${r.assessment_date ?? 'unknown'}|${r.quarter}`} exportName="MASS-assessment-register" state={register.status === 'ready' ? 'ready' : 'loading'} emptyMessage="No saved assessments for this selection." />
      )}
      <p className="text-xs text-muted">One record per centre, shift, observed date and round. Historical dates remain unknown; no date is invented. Correcting a saved score uses its own approved workflow in the standard application.</p>

      {entering && year && refs ? <EntryDialog service={service} refs={refs} year={year} centres={writable.map(c => ({id: c.id, label: c.label}))} initialCentre={writable.some(c => c.id === filters.centre) ? filters.centre : writable[0]!.id} today={today} enabled={entryEnabled} onSaved={afterSave} onClose={() => setEntering(false)} /> : null}
    </div>
  );
}
