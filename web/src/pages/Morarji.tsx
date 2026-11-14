import {useEffect, useMemo, useState} from 'react';
import {AsyncState, type LoadState} from '../components/AsyncState';
import {ChartCard} from '../components/ChartCard';
import {ColumnChart} from '../components/charts/ColumnChart';
import {DataTable, type Column} from '../components/DataTable';
import {Scorecard, type ScorecardState} from '../components/Scorecard';
import {resultOf, yesNo, type MorarjiService} from '../morarji/service';
import {type ProfilesService, type StudentRow} from '../profiles/service';
import {type MorarjiCohort, type OverviewService, type Report} from '../data/overview';
import {academicMonths, todayIst} from '../lib/dates';
import {formatCount} from '../lib/format';
import {sharedMorarji, sharedOverview, sharedProfiles} from '../data/shared';
import type {Capabilities, LiveBackend, References} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';

type Slice<T> = {status: 'loading'} | {status: 'ready'; value: T} | {status: 'error'; message: string};
const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'This could not be loaded.');
const asState = <T,>(slice: Slice<T>): LoadState => slice.status;
const cardState = <T,>(slice: Slice<T>): ScorecardState => slice.status;
const years = (range: {starts_on: string; ends_before: string}) => `${range.starts_on.slice(0, 4)}–${range.ends_before.slice(0, 4)}`;

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

interface FollowUp {id: string; cohort: string; name: string | null; studentId: string; centre: string; applied: boolean | null; attended: boolean | null; result: string; school: string | null}
interface CentreLine {id: string; name: string; members: number; applied: number; attended: number; passed: number}

export function Morarji({backend, context, role, service: injected, profiles: injectedProfiles, overview: injectedOverview}: {backend: LiveBackend; context: ProgrammeContext; role: string; service?: MorarjiService; profiles?: ProfilesService; overview?: OverviewService}) {
  const service = useMemo(() => injected ?? sharedMorarji(backend), [backend, injected]);
  const profiles = useMemo(() => injectedProfiles ?? sharedProfiles(backend), [backend, injectedProfiles]);
  const overview = useMemo(() => injectedOverview ?? sharedOverview(backend), [backend, injectedOverview]);
  const today = useMemo(() => todayIst(), []);
  const [boot, setBoot] = useState<Slice<{refs: References; capabilities: Capabilities}>>({status: 'loading'});
  const [bootAttempt, setBootAttempt] = useState(0);
  const [filters, setFilters] = useState({cohort: '', centre: ''});
  const [report, setReport] = useState<Slice<Report>>({status: 'loading'});
  const [rows, setRows] = useState<Slice<FollowUp[]>>({status: 'loading'});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let live = true;
    setBoot({status: 'loading'});
    Promise.all([backend.readReferences(), backend.readCapabilities()]).then(([refs, capabilities]) => {
      if (!live) return;
      if (!capabilities.reviewedCharts) { setBoot({status: 'error', message: 'This backend has not enabled the reviewed reports Morarji needs.'}); return; }
      setBoot({status: 'ready', value: {refs, capabilities}});
    }).catch(error => { if (live) setBoot({status: 'error', message: messageOf(error)}); });
    return () => { live = false; };
  }, [backend, bootAttempt]);

  const scope = useMemo(() => context.centres.filter(c => c.roles.includes(role)), [context, role]);
  const nameOf = useMemo(() => new Map(context.centres.map(c => [c.id, c.label])), [context]);
  const selected = useMemo(() => scope.filter(c => !filters.centre || c.id === filters.centre), [scope, filters.centre]);
  const refs = boot.status === 'ready' ? boot.value.refs : null;
  const year = refs ? (refs.academic_years.find(y => y.starts_on <= today && today < y.ends_before) ?? [...refs.academic_years].sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0]) : undefined;
  const months = useMemo(() => (year ? academicMonths(year.starts_on) : []), [year]);
  const cohorts = useMemo(() => [...(refs?.programme_cohorts ?? [])].sort((a, b) => b.label.localeCompare(a.label)), [refs]);
  const cohortLabel = filters.cohort || cohorts[0]?.label || '';
  const yearLabelOf = useMemo(() => new Map((refs?.academic_years ?? []).map(y => [y.id, years(y)])), [refs]);
  const key = JSON.stringify([selected.map(c => c.id)]);
  const operational = role !== 'Leadership';

  useEffect(() => {
    if (!year || boot.status !== 'ready') return;
    let live = true;
    setReport({status: 'loading'}); setRows({status: 'loading'});
    const ids = selected.map(c => c.id);
    if (!ids.length) { setReport({status: 'error', message: 'No centres are in this selection.'}); setRows({status: 'ready', value: []}); return; }
    overview.report({month: today.slice(0, 7), centres: ids, shift: null, grade: null, gender: null}, {yearId: year.id, today, fromQuarter: 1, toQuarter: 2, months, hasSeries: false})
      .then(value => { if (live) setReport({status: 'ready', value}); }).catch(error => { if (live) setReport({status: 'error', message: messageOf(error)}); });
    if (!operational) { setRows({status: 'ready', value: []}); return () => { live = false; }; }
    service.memberships(ids).then(async members => {
      // The batched follow-up already carries the student id and name; only an older database needs the roster reads.
      const detailed = members.every(m => m.detailed);
      const students = new Map((detailed ? [] : await profiles.students(ids, members.map(m => m.enrolment_id))).map(s => [s.enrolment, s] as [string, StudentRow]));
      const label = new Map((refs?.programme_cohorts ?? []).map(c => [c.id, c.label]));
      const list: FollowUp[] = members.map(m => ({id: m.membership_id, cohort: label.get(m.cohort_id) ?? '', name: detailed ? (m.full_name ?? null) : students.get(m.enrolment_id)?.name ?? null, studentId: detailed ? (m.student_id ?? '') : students.get(m.enrolment_id)?.studentId ?? '', centre: m.centre, applied: m.applied, attended: m.attended, result: resultOf(m), school: m.school_name}));
      if (live) setRows({status: 'ready', value: list});
    }).catch(error => { if (live) setRows({status: 'error', message: messageOf(error)}); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, service, profiles, key, refreshKey, boot.status]);

  const stats = report.status === 'ready' ? report.value : null;
  const cohortStat: MorarjiCohort | undefined = stats?.morarji?.find(c => c.cohort === cohortLabel);
  const all = rows.status === 'ready' ? rows.value : [];
  const forCohort = all.filter(r => r.cohort === cohortLabel);
  const pending = cohortStat ? (cohortStat.knownPassed ? cohortStat.members - cohortStat.knownPassed : null) : null;
  const trend = (stats?.morarjiYears ?? []).map(y => ({label: yearLabelOf.get(y.academicYear) ?? y.academicYear, value: y.passed})).sort((a, b) => a.label.localeCompare(b.label));

  const cohortColumns = useMemo<Column<MorarjiCohort>[]>(() => [
    {id: 'cohort', header: 'Cohort', value: r => r.cohort},
    {id: 'members', header: 'In training cohort', value: r => r.members, numeric: true},
    {id: 'applied', header: 'Applied', value: r => r.applied, numeric: true},
    {id: 'attended', header: 'Took the exam', value: r => r.attended, numeric: true},
    {id: 'passed', header: 'Passed', value: r => r.passed, numeric: true},
  ], []);
  const centreLines = useMemo<CentreLine[]>(() => selected.map(c => {
    const rs = forCohort.filter(r => r.centre === c.id);
    return {id: c.id, name: nameOf.get(c.id) ?? c.id, members: rs.length, applied: rs.filter(r => r.applied === true).length, attended: rs.filter(r => r.attended === true).length, passed: rs.filter(r => r.result === 'Passed').length};
  }).filter(line => line.members > 0), [selected, forCohort, nameOf]);
  const centreColumns = useMemo<Column<CentreLine>[]>(() => [
    {id: 'name', header: 'Centre', value: r => r.name},
    {id: 'members', header: 'In training cohort', value: r => r.members, numeric: true},
    {id: 'attended', header: 'Took the exam', value: r => r.attended, numeric: true},
    {id: 'passed', header: 'Passed', value: r => r.passed, numeric: true},
  ], []);
  const followColumns = useMemo<Column<FollowUp>[]>(() => [
    {id: 'student', header: 'Student', value: r => r.name ?? 'Name not recorded', cell: r => <>{r.name ?? 'Name not recorded'}<span className="block text-xs text-muted">{r.studentId}</span></>},
    {id: 'centre', header: 'Centre', value: r => nameOf.get(r.centre) ?? r.centre},
    {id: 'applied', header: 'Application', value: r => (r.applied === null ? 'Not recorded' : r.applied ? 'Applied' : 'Not applied')},
    {id: 'attended', header: 'Took the exam', value: r => yesNo(r.attended)},
    {id: 'result', header: 'Exam result', value: r => r.result},
    {id: 'school', header: 'School', value: r => r.school ?? 'Not recorded'},
  ], [nameOf]);

  if (boot.status !== 'ready') return <AsyncState state={boot.status === 'error' ? 'error' : 'loading'} errorMessage={boot.status === 'error' ? boot.message : undefined} onRetry={() => setBootAttempt(n => n + 1)} loadingLabel="Preparing Morarji" rows={5} />;
  const msg = report.status === 'error' ? report.message : undefined;
  const none = report.status === 'ready' && (stats?.morarji?.length ?? 0) === 0 && cohorts.length === 0;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">Compare yearly entrance-exam results, then review the selected cohort{operational ? '’s follow-up' : ''}. Passing does not imply selection, admission or scholarship receipt.</p>
      <div role="group" aria-label="Morarji filters" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-3">
        {cohorts.length ? <Select label="Cohort year" value={cohortLabel} options={cohorts.map(c => [c.label, c.label])} onChange={value => setFilters(f => ({...f, cohort: value}))} /> : null}
        {scope.length > 1 ? <Select label="Centre" value={filters.centre} options={scope.map(c => [c.id, c.label])} allLabel="All centres" onChange={value => setFilters(f => ({...f, centre: value}))} /> : null}
      </div>
      {none ? <p role="note" className="rounded-md bg-brand-soft p-4 text-sm">Verified cohort outcomes have not been imported. Historical candidates remain under review; no cohort, exam or result is inferred.</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Scorecard reference="6.1" label="Children in the training cohort" value={cohortStat ? formatCount(cohortStat.members) : null} hint={cohortLabel || 'No cohort'} state={none || (stats && !cohortStat) ? 'unavailable' : cardState(report)} message={msg ?? 'No verified cohort recorded'} />
        <Scorecard reference="6.2" label="Took the exam" value={cohortStat?.attended != null ? formatCount(cohortStat.attended) : null} hint="Recorded answers only" state={stats && cohortStat?.attended == null ? 'unavailable' : cardState(report)} message={msg ?? 'Not recorded'} />
        <Scorecard reference="6.3" label="Children passed" value={cohortStat?.passed != null ? formatCount(cohortStat.passed) : null} hint="Recorded pass results" state={stats && cohortStat?.passed == null ? 'unavailable' : cardState(report)} message={msg ?? 'Not recorded'} />
        <Scorecard reference="6.4" label="Results pending" value={pending === null ? null : formatCount(pending)} hint="Unknown is not counted as failed" state={stats && pending === null ? 'unavailable' : cardState(report)} message={msg ?? 'Not recorded'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <ChartCard reference="6.5" title="Children passing, year on year" subtitle="Recorded pass results · same centre scope" state={asState(report)} errorMessage={msg} onRetry={() => setRefreshKey(k => k + 1)} emptyMessage="No verified cohort outcomes.">
          {trend.length ? <><ColumnChart axis="Children passed" description="Children who passed by cohort year" items={trend} /><p className="mt-2 text-xs text-muted">Counts compare different cohorts; they do not measure change in the same children. A dash is an unrecorded result, not zero.</p></> : <p className="text-sm text-muted">No verified cohort outcomes.</p>}
        </ChartCard>
        <DataTable<MorarjiCohort> reference="6.6" caption="Cohort sizes compared" columns={cohortColumns} data={stats?.morarji ?? []} getRowId={r => r.cohortId} exportName="MASS-morarji-cohorts" state={asState(report)} errorMessage={msg} emptyMessage="No verified cohort outcomes." onRetry={() => setRefreshKey(k => k + 1)} />
      </div>

      {operational ? (
        <>
          <DataTable<CentreLine> reference="6.7" caption="Morarji results by centre" columns={centreColumns} data={centreLines} getRowId={r => r.id} exportName={`MASS-morarji-by-centre-${cohortLabel}`} state={asState(rows)} errorMessage={rows.status === 'error' ? rows.message : undefined} emptyMessage="No cohort records for the selected year and centres." onRetry={() => setRefreshKey(k => k + 1)} />
          <DataTable<FollowUp> reference="6.8" caption="Cohort follow-up" columns={followColumns} data={forCohort} getRowId={r => r.id} exportName={`MASS-morarji-follow-up-${cohortLabel}`} state={asState(rows)} errorMessage={rows.status === 'error' ? rows.message : undefined} emptyMessage="No cohort records for the selected year and centres." onRetry={() => setRefreshKey(k => k + 1)} />
        </>
      ) : <p className="text-xs text-muted">Leadership sees cohort totals only; individual follow-up stays with the centre staff.</p>}
      <p className="text-xs text-muted">This screen only reads. Adding a child to a training cohort and updating outcomes use their own approved workflow in the standard application (the database keeps that activation off). No training dates are inferred from cohort labels.</p>
    </div>
  );
}
