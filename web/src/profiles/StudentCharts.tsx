import {useEffect, useMemo, useState} from 'react';
import {ChartCard} from '../components/ChartCard';
import {ColumnChart} from '../components/charts/ColumnChart';
import {Scorecard, type ScorecardState} from '../components/Scorecard';
import {academicMonths} from '../lib/dates';
import {formatCount} from '../lib/format';
import {sharedOverview} from '../data/shared';
import {useOverview, type Slice} from '../data/useOverview';
import type {Environment, Selection} from '../data/overview';
import type {LiveBackend, References} from '../session/backend';
import {useI18n} from '../i18n/I18n';

const FROM_QUARTER = 1, TO_QUARTER = 2;
const state = <T,>(slice: Slice<T>): 'loading' | 'ready' | 'error' | 'empty' => slice.status === 'ready' ? 'ready' : slice.status === 'error' ? 'error' : slice.status === 'future' ? 'empty' : 'loading';
const cardState = <T,>(slice: Slice<T>): ScorecardState => slice.status === 'ready' ? 'ready' : slice.status === 'error' ? 'error' : slice.status === 'future' ? 'unavailable' : 'loading';

/** The Overview's student count scorecard and grade, gender and shift charts, for the students this page lists. */
export function StudentCharts({backend, today, centres, shift, grade, gender}: {backend: LiveBackend; today: string; centres: string[]; shift: string | null; grade: string | null; gender: string | null}) {
  const {t} = useI18n();
  const service = useMemo(() => sharedOverview(backend), [backend]);
  const [refs, setRefs] = useState<References | null>(null);
  useEffect(() => { let live = true; backend.readReferences().then(value => { if (live) setRefs(value); }).catch(() => undefined); return () => { live = false; }; }, [backend]);
  const year = refs ? (refs.academic_years.find(y => y.starts_on <= today && today < y.ends_before) ?? [...refs.academic_years].sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0]) : null;
  const months = useMemo(() => (year ? academicMonths(year.starts_on) : []), [year]);
  const month = year && year.starts_on <= today && today < year.ends_before ? today.slice(0, 7) : months[0] ?? '';
  const selection: Selection | null = useMemo(() => year && month ? {month, centres, shift, grade, gender} : null, [year, month, centres, shift, grade, gender]);
  const env: Environment | null = useMemo(() => year ? {yearId: year.id, today, fromQuarter: FROM_QUARTER, toQuarter: TO_QUARTER, months, hasSeries: false} : null, [year, today, months]);
  const {report, shifts, retry} = useOverview(service, selection, env, {series: false});
  const stats = report.status === 'ready' ? report.value : null;
  const message = report.status === 'error' ? report.message : undefined;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Scorecard reference="2.1" label={t('overview.enrolled')} value={stats ? formatCount(stats.children) : null} state={refs ? cardState(report) : 'loading'} message={message} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard reference="2.2" title={t('overview.byGrade')} subtitle={t('overview.aggregateFilters')} state={refs ? state(report) : 'loading'} errorMessage={message} emptyMessage={t('common.future')} onRetry={retry}>
          {stats ? <ColumnChart axis={t('common.students')} description={t('overview.byGrade')} items={Array.from({length: 10}, (_, i) => ({label: String(i + 1), value: stats.grades[String(i + 1)] ?? 0}))} /> : null}
        </ChartCard>
        <ChartCard reference="2.3" title={t('overview.byGender')} subtitle={t('overview.genderPrivacy')} state={refs ? state(report) : 'loading'} errorMessage={message} emptyMessage={t('common.future')} onRetry={retry}>
          {stats ? <ColumnChart axis={t('common.students')} description={t('overview.byGender')} items={[{label: t('common.girls'), value: stats.genders.Girl ?? 0, tone: 'accent'}, {label: t('common.boys'), value: stats.genders.Boy ?? 0}]} /> : null}
        </ChartCard>
        <ChartCard reference="2.4" title={t('overview.byShift')} subtitle={t('overview.shiftHelp')} state={refs ? state(shifts) : 'loading'} errorMessage={shifts.status === 'error' ? shifts.message : undefined} emptyMessage={t('common.future')} onRetry={retry}>
          {shifts.status === 'ready' ? <ColumnChart axis={t('common.students')} description={t('overview.byShift')} items={[{label: t('common.morning'), value: shifts.value.Morning}, {label: t('common.evening'), value: shifts.value.Evening}]} /> : null}
        </ChartCard>
      </div>
    </>
  );
}
