import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {Assessments} from './Assessments';
import type {AssessmentsService, RegisterRow} from '../assessments/service';
import type {OverviewService, Report} from '../data/overview';
import type {LiveBackend} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';
import {violations} from '../test/axe';
import {testTableService} from '../test/tableService';

vi.mock('../lib/dates', async importOriginal => ({...(await importOriginal<typeof import('../lib/dates')>()), todayIst: () => '2026-11-14'}));

const ctx = (roles: string[], write = true): ProgrammeContext => ({user_id: 'u1', role: roles[0], centres: [{id: 'c1', label: 'Centre 01', can_write: write}, {id: 'c2', label: 'Centre 02', can_write: write}]});
const refs = {academic_years: [{id: 'y1', starts_on: '2026-04-01', ends_before: '2027-04-01'}], assessment_periods: [1, 2, 3, 4].map(q => ({id: `p${q}`, academic_year_id: 'y1', quarter: q})), assessment_definitions: [1, 2, 3, 4].map(q => ({id: `d${q}`, period_id: `p${q}`, max_score: 25}))};
const report: Report = {children: 40, grades: {}, genders: {}, attendance: {p: 0, a: 0, l: 0, excluded: 0, percentage: null},
  quarters: [{quarter: 1, n: 30, mean: 12, low: 3, developing: 10, good: 12, strong: 5, precision_review: 0}, {quarter: 2, n: 32, mean: 15.25, above20: 8, low: 2, developing: 8, good: 14, strong: 8, precision_review: 1}],
  changes: {n: 28, meanChange: 3, earlierMean: 12, laterMean: 15, improved: 20, unchanged: 3, declined: 5},
  centres: [{id: 'c1', children: 20, attendance: {p: 0, a: 0, l: 0, excluded: 0, percentage: null}, quarters: [{quarter: 2, n: 16, mean: 16}]}, {id: 'c2', children: 20, attendance: {p: 0, a: 0, l: 0, excluded: 0, percentage: null}, quarters: [{quarter: 2, n: 16, mean: 14.5}]}]};
const rows: RegisterRow[] = [{centre_id: 'c1', shift_code: 'Evening', assessment_date: '2026-10-05', quarter: 2, students: 16, average_score: '16.0', created_by: 'Source import / not recorded', last_edited_by: 'Source import / not recorded', last_edited_at: null}, {centre_id: 'c2', shift_code: 'Morning', assessment_date: null, quarter: 1, students: 15, average_score: null}];

function setup(options: {role?: string; writes?: Record<string, boolean>; reportFn?: OverviewService['report']; write?: boolean; reviewed?: boolean} = {}) {
  const service = {
    register: vi.fn(async () => rows),
    roster: vi.fn(async () => [{enrolment: 'e1', child: 'k1', studentId: 'S001', name: 'Asha', grade: '4', shift: 'Evening', gender: 'Girl'}, {enrolment: 'e2', child: 'k2', studentId: 'S002', name: null, grade: '5', shift: 'Evening', gender: null}]),
    saved: vi.fn(async () => new Map()), save: vi.fn(async () => 1),
  } as unknown as AssessmentsService;
  const overview = {report: options.reportFn ?? vi.fn(async () => report), shifts: vi.fn(), series: vi.fn(), clear: vi.fn()} as unknown as OverviewService;
  const backend = {rpc: vi.fn(), readReferences: vi.fn(async () => refs), readCapabilities: vi.fn(async () => ({reviewedCharts: options.reviewed ?? true, reviewedAttendanceSeries: true, writes: options.writes ?? {}}))} as unknown as LiveBackend;
  const role = options.role ?? 'Teacher';
  const centreRows = report.centres.map((r, i) => ({centre_id: r.id, centre_label: `Centre 0${i + 1}`, children: r.children, percentage: null, score_mean: r.quarters[0]?.mean ?? null}));
  const view = render(<Assessments backend={backend} context={ctx([role], options.write ?? true)} role={role} service={service} overview={overview} tables={testTableService({reviewed_centres: centreRows, assessment_register: rows})} />);
  return {service, overview, ...view};
}

describe('Assessments page', () => {
  it('shows the F2 scorecards, bands and comparison from the reviewed report', async () => {
    setup();
    expect(await screen.findByText('32 of 40 enrolled students have a score')).toBeInTheDocument();
    expect(screen.getAllByText('15.3').length).toBeGreaterThan(0);   // F2 mean 15.25
    expect(screen.getByText('8 of 40 enrolled students have no score')).toBeInTheDocument();       // 40 - 32 without a score, shown as 20.0% with the count underneath
    expect(screen.getByRole('group', {name: 'Students with exam scores recorded'})).toHaveTextContent('80.0%');
    expect(screen.getByText('+25.0%')).toBeInTheDocument();          // (15 - 12) / 12
    expect(screen.getByText(/Recorded n=32; fractional marks unbanded=1/)).toBeInTheDocument();
    expect(screen.getByText('Matched students')).toBeInTheDocument();
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);      // improved
  });
  it('requests the report for the chosen compare pair and asks again when the round changes', async () => {
    const user = userEvent.setup();
    const {overview} = setup();
    await screen.findByText('32 of 40 enrolled students have a score');
    const first = vi.mocked(overview.report).mock.calls[0]!;
    expect(first[1]).toEqual(expect.objectContaining({yearId: 'y1', fromQuarter: 1, toQuarter: 2}));
    await user.selectOptions(screen.getByLabelText('Compare rounds'), '2|3');
    await waitFor(() => expect(vi.mocked(overview.report).mock.calls.at(-1)![1]).toEqual(expect.objectContaining({fromQuarter: 2, toQuarter: 3})));
    await user.selectOptions(screen.getByLabelText('Exam round'), '1');
    expect(await screen.findByText('30 of 40 enrolled students have a score')).toBeInTheDocument();
  });
  it('treats a missing score as unknown, never zero', async () => {
    setup({reportFn: vi.fn(async () => ({...report, quarters: [{quarter: 1, n: 0, mean: null}], changes: {n: 0, meanChange: null, earlierMean: null, laterMean: null, improved: 0, unchanged: 0, declined: 0}})) as never});
    expect(await screen.findByText('No scores are recorded for this round')).toBeInTheDocument();
    expect(screen.getByText(/No students have a recorded score in both rounds/)).toBeInTheDocument();
  });
  it('lists the saved assessment register with unknown historical dates', async () => {
    setup();
    const table = await screen.findByRole('table', {name: 'Assessment register'});
    await waitFor(() => expect(within(table).getAllByRole('row').length).toBe(3));
    expect(within(table).getByText('Unknown', {selector: 'span'})).toBeInTheDocument();
    expect(within(table).queryByText('Source import / not recorded')).not.toBeInTheDocument();
    expect(within(table).getAllByRole('button', {name: 'Edit'}).length).toBeGreaterThan(0);
    expect(within(table).queryByRole('button', {name: 'Delete'})).not.toBeInTheDocument();
  });
  it('shows an error with retry when the report fails, without hiding the register', async () => {
    setup({reportFn: vi.fn(async () => { throw new Error('statement timeout'); }) as never});
    expect((await screen.findAllByText(/statement timeout/)).length).toBeGreaterThan(0);
    expect(await screen.findByRole('table', {name: 'Assessment register'})).toBeInTheDocument();
  });
  it('explains a backend without reviewed reports', async () => {
    setup({reviewed: false});
    expect(await screen.findByText(/has not enabled the reviewed reports/)).toBeInTheDocument();
  });
  it('gives Leadership inherited assessment entry', async () => {
    setup({role: 'Leadership'});
    await screen.findByText('32 of 40 enrolled students have a score');
    expect(screen.getByRole('button', {name: 'Enter marks'})).toBeInTheDocument();
    expect(screen.getByText(/Review one combined CAC test/)).toBeInTheDocument();
  });
  it('opens entry for review with saving off until the gate is on', async () => {
    const user = userEvent.setup();
    const {service} = setup();
    await screen.findByText('32 of 40 enrolled students have a score');
    await user.click(screen.getByRole('button', {name: 'Enter marks'}));
    expect(await screen.findByText(/This date is in round F3/)).toBeInTheDocument();
    await user.selectOptions(within(await screen.findByRole('dialog')).getByLabelText('Shift'), 'Evening');
    await user.click(screen.getByRole('button', {name: 'Continue'}));
    expect(await screen.findByRole('table', {name: 'Students to score'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save assessment'})).toBeDisabled();
    expect(service.save).not.toHaveBeenCalled();
  });
  it('saves entered marks in one batch with the derived definition and the observed date', async () => {
    const user = userEvent.setup();
    const {service} = setup({writes: {assessment_entry: true}});
    await screen.findByText('32 of 40 enrolled students have a score');
    await user.click(screen.getByRole('button', {name: 'Enter marks'}));
    await user.selectOptions(within(await screen.findByRole('dialog')).getByLabelText('Shift'), 'Evening');
    await user.click(await screen.findByRole('button', {name: 'Continue'}));
    await screen.findByRole('table', {name: 'Students to score'});
    await user.type(screen.getByLabelText('Marks for Asha'), '30');
    await user.click(screen.getByRole('button', {name: 'Save assessment'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Marks must be 0–25.');
    await user.clear(screen.getByLabelText('Marks for Asha'));
    await user.type(screen.getByLabelText('Marks for Asha'), '19');
    await user.click(screen.getByRole('button', {name: 'Save assessment'}));
    await waitFor(() => expect(service.save).toHaveBeenCalledWith([{enrolment: 'e1', definition: 'd3', date: '2026-11-14', score: 19, expected: 0}]));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('edits a saved register: marks come filled in and a changed mark is saved as a correction with its version', async () => {
    const user = userEvent.setup();
    const {service} = setup({writes: {assessment_entry: true}});
    (service.saved as ReturnType<typeof vi.fn>).mockResolvedValue(new Map([['e1', {id: 'r1', enrolment: 'e1', score: 10, date: '2026-10-05', version: 3}]]));
    const table = await screen.findByRole('table', {name: 'Assessment register'});
    await user.click((await within(table).findAllByRole('button', {name: 'Edit'}))[0]!);
    const marks = await screen.findByLabelText('Marks for Asha');
    expect(marks).toHaveValue(10);
    await user.clear(marks); await user.type(marks, '14');
    await user.click(screen.getByRole('button', {name: 'Save assessment'}));
    await waitFor(() => expect(service.save).toHaveBeenCalledWith([{enrolment: 'e1', definition: 'd2', date: '2026-10-05', score: 14, expected: 3}]));
  });
  it('has no automatic accessibility violations', async () => {
    const {container} = setup();
    await screen.findByText('32 of 40 enrolled students have a score');
    expect(await violations(container)).toEqual([]);
  });
});
