import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createLimiter} from '../../src/live/limiter.js';
import {aggregateFromReviewed} from '../../src/live/reviewed-aggregate.js';

test('limiter never runs more than its limit and keeps first-in first-out order', async () => {
  const limit = createLimiter(2), started = [];
  let running = 0, peak = 0;
  const job = id => limit(async () => { started.push(id); running++; peak = Math.max(peak, running); await new Promise(r => setTimeout(r, 5)); running--; return id; });
  const results = await Promise.all([1, 2, 3, 4, 5, 6].map(job));
  assert.deepEqual(results, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(started, [1, 2, 3, 4, 5, 6]);
  assert.equal(peak, 2);
  assert.deepEqual(limit.stats(), {running: 0, waiting: 0});
});

test('limiter passes failures to the caller and keeps draining the queue', async () => {
  const limit = createLimiter(1);
  const failing = limit(async () => { throw new Error('boom'); });
  const after = limit(async () => 'ok');
  await assert.rejects(failing, /boom/);
  assert.equal(await after, 'ok');
  assert.throws(() => createLimiter(0));
});

test('aggregate built from one reviewed report keeps the aggregate shape and totals', () => {
  const reviewed = {
    children: 40, grades: {1: 15, 2: 25}, genders: {Girl: 22, Boy: 18},
    attendance: {p: 90, a: 6, l: 4, excluded: 10, percentage: 90},
    quarters: [{quarter: 1, n: 30, mean: 16, low: 2, developing: 10, good: 8, strong: 10, above20: 9, precision_review: 0}],
    changes: {n: 20, earlierMean: 15, laterMean: 18, improved: 14, unchanged: 2, declined: 4, meanChange: 3, ambiguous: 0},
    centres: [{id: 'c1', children: 17, attendance: {p: 40, a: 3, l: 2, excluded: 4}}, {id: 'c2', children: 23, attendance: {p: 50, a: 3, l: 2, excluded: 6}}],
  };
  const a = aggregateFromReviewed(reviewed, {fromExam: 'F1', toExam: 'F2'});
  assert.equal(a.students, 40);
  assert.deepEqual(a.genders, {Girl: 22, Boy: 18});
  assert.deepEqual(a.grades, {1: 15, 2: 25});
  assert.deepEqual(a.attendance, {p: 90, a: 6, l: 4, excluded: 10});
  assert.equal(a.quarters[1].n, 30);
  assert.equal(a.quarters[1].total, 480);
  assert.equal(a.quarters[1].above20, 9);
  assert.deepEqual(a.changes['1|2'], {n: 20, earlier: 300, later: 360, improved: 14, unchanged: 2, declined: 4});
  assert.deepEqual(a.centres.map(c => c.centre_id), ['c1', 'c2']);
  assert.equal(a.centres.reduce((n, c) => n + c.students, 0), a.students);
  assert.equal(a.centres.reduce((n, c) => n + c.attendance.p, 0), a.attendance.p);
});

test('missing assessment changes stay absent rather than becoming zero', () => {
  const a = aggregateFromReviewed({children: 1, grades: {}, genders: {}, attendance: {}, quarters: [], changes: {n: 0}, centres: []}, {fromExam: 'F1', toExam: 'F4'});
  assert.deepEqual(a.changes, {});
  assert.deepEqual(a.quarters, {});
});

test('startup source: no per-centre aggregate loop with reviewed charts, parallel probes, one reviewed queue', async () => {
  const source = await readFile(new URL('../../src/live/original-review.js', import.meta.url), 'utf8');
  assert.match(source, /if\(!globalThis\.__massAggregateMode\|\|capabilities\.reviewedCharts\)return;/);
  assert.match(source, /reviewedLimiter=createLimiter\(2\)/);
  assert.match(source, /void reviewedLimiter\(\(\)=>rpc\('reviewed_chart_metrics'/);
  assert.match(source, /Promise\.all\(\[reads\.context[^\n]*discoverCentreEvents\(rpc\)[^\n]*get_attendance_register_capabilities/);
  assert.match(source, /refresh\(\{skipVerify:true\}\)/);
  assert.equal((source.match(/get_attendance_register_capabilities/g) || []).length, 1);
  const app = await readFile(new URL('../../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /data-lazy-months/);
  assert.match(app, /new window\.IntersectionObserver/);
  assert.match(app, /paginateTables\(\$\('#app'\)\);observeLazyMonths\(\);/);
});

test('the monthly series capability needs reviewed charts and is absent on older backends', async () => {
  const {discoverCapabilities} = await import('../../src/live/backend-capabilities.js');
  const base = {activation_control: 1, original_workflows: 20, period_assessments: true, operational_details: 22, aggregate_api: 23, writes: {}};
  const withSeries = await discoverCapabilities(async () => ({...base, reviewed_charts: 24, reviewed_attendance_series: 1}));
  assert.equal(withSeries.reviewedAttendanceSeries, true);
  const older = await discoverCapabilities(async () => ({...base, reviewed_charts: 24}));
  assert.equal(older.reviewedAttendanceSeries, false);
  const disabled = await discoverCapabilities(async () => ({...base, reviewed_attendance_series: 1}));
  assert.equal(disabled.reviewedAttendanceSeries, false);
});

test('Overview chart uses one series request when available and falls back to per-month reports', async () => {
  const review = await readFile(new URL('../../src/live/original-review.js', import.meta.url), 'utf8');
  assert.match(review, /rpc\('reviewed_attendance_series'/);
  assert.match(review, /delete globalThis\.__massAttendanceSeries/);
  const app = await readFile(new URL('../../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /series=liveReview\?globalThis\.__massAttendanceSeries\?\.\(state,scope\(\)\):null/);
  assert.match(app, /if\(series&&!series\.unavailable\)/);
});
