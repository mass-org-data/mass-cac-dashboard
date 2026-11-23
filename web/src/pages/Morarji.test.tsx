import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {Morarji} from './Morarji';
import type {MorarjiService} from '../morarji/service';
import type {ProfilesService} from '../profiles/service';
import type {OverviewService, Report} from '../data/overview';
import type {LiveBackend} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';
import {violations} from '../test/axe';
import {testTableService} from '../test/tableService';

vi.mock('../lib/dates', async importOriginal => ({...(await importOriginal<typeof import('../lib/dates')>()), todayIst: () => '2026-11-14'}));

const ctx = (roles: string[]): ProgrammeContext => ({user_id: 'u1', role: roles[0], centres: [{id: 'c1', label: 'Centre 01', can_write: true}, {id: 'c2', label: 'Centre 02', can_write: true}]});
const cohorts = [{id: 'k1', label: '2024–25', academic_year_id: 'y0'}, {id: 'k2', label: '2025–26', academic_year_id: 'y1'}];
const refs = {academic_years: [{id: 'y0', starts_on: '2025-04-01', ends_before: '2026-04-01'}, {id: 'y1', starts_on: '2026-04-01', ends_before: '2027-04-01'}], assessment_periods: [], assessment_definitions: [], programme_cohorts: cohorts};
const base: Report = {children: 40, grades: {}, genders: {}, attendance: {p: 0, a: 0, l: 0, excluded: 0, percentage: null}, quarters: [], centres: []};
const withData: Report = {...base,
  morarji: [{cohort: '2025–26', cohortId: 'k2', academicYear: 'y1', members: 12, passed: 5, knownPassed: 9, applied: 11, attended: 10}, {cohort: '2024–25', cohortId: 'k1', academicYear: 'y0', members: 10, passed: null, knownPassed: 0, applied: null, attended: null}],
  morarjiYears: [{academicYear: 'y1', members: 12, passed: 5, knownPassed: 9}, {academicYear: 'y0', members: 10, passed: null, knownPassed: 0}]};
const members = [
  {membership_id: 'm1', cohort_id: 'k2', child_id: 'a', enrolment_id: 'e1', shift_code: 'Evening', applied: true, attended: true, passed: true, school_name: 'Morarji School', centre: 'c1'},
  {membership_id: 'm2', cohort_id: 'k2', child_id: 'b', enrolment_id: 'e2', shift_code: 'Evening', applied: true, attended: null, passed: null, school_name: null, centre: 'c1'},
  {membership_id: 'm3', cohort_id: 'k1', child_id: 'c', enrolment_id: 'e3', shift_code: 'Evening', applied: null, attended: null, passed: null, school_name: null, centre: 'c2'},
];

function setup(options: {role?: string; report?: Report; memberships?: typeof members; fail?: boolean; noCohorts?: boolean; writes?: Record<string, boolean>} = {}) {
  const service = {memberships: vi.fn(async () => options.memberships ?? members), grade5: vi.fn(async () => [{enrolment: 'e9', studentId: 'S-9', name: 'Meena', shift: 'Evening'}]), outcomeVersion: vi.fn(async () => 2), addMember: vi.fn(async () => 'm9'), recordOutcome: vi.fn(async () => 'o1')} as unknown as MorarjiService;
  const profiles = {students: vi.fn(async (_c: string[], ids: string[]) => ids.map(id => ({enrolment: id, child: id, studentId: `S-${id}`, name: id === 'e2' ? null : `Student ${id}`, centre: 'c1', grade: '5', shift: 'Evening', gender: null, enrolled: '2026-06-01', status: 'Active', board: null, version: 1})))} as unknown as ProfilesService;
  const overview = {report: vi.fn(async () => { if (options.fail) throw new Error('statement timeout'); return options.report ?? withData; }), clear: vi.fn()} as unknown as OverviewService;
  const backend = {rpc: vi.fn(), readReferences: vi.fn(async () => (options.noCohorts ? {...refs, programme_cohorts: []} : refs)), readCapabilities: vi.fn(async () => ({reviewedCharts: true, reviewedAttendanceSeries: true, writes: options.writes ?? {}}))} as unknown as LiveBackend;
  const role = options.role ?? 'Teacher';
  const active = options.memberships ?? members;
  const follow = active.map(m => ({id: m.membership_id, cohort: m.cohort_id, name: m.enrolment_id === 'e2' ? null : `Student ${m.enrolment_id}`, studentId: `S-${m.enrolment_id}`, centre: m.centre, applied: m.applied, attended: m.attended, result: m.passed === true ? 'Passed' : m.passed === false ? 'Not passed' : 'Pending', school: m.school_name}));
  const cohortRows = options.report?.morarji ?? withData.morarji ?? [];
  const tables = testTableService({morarji_cohorts: cohortRows, morarji_followup: context => follow.filter(row => row.cohort === context.cohort), morarji_centres: context => {
    const rs = follow.filter(row => row.cohort === context.cohort);
    return ['c1', 'c2'].map((id, i) => { const own = rs.filter(row => row.centre === id); return {id, name: `Centre 0${i + 1}`, members: own.length, applied: own.filter(row => row.applied).length, attended: own.filter(row => row.attended).length, passed: own.filter(row => row.result === 'Passed').length}; }).filter(row => row.members);
  }});
  const view = render(<Morarji backend={backend} context={ctx([role])} role={role} service={service} profiles={profiles} overview={overview} tables={tables} />);
  return {service, profiles, overview, ...view};
}

const ready = async () => { await screen.findByRole('img', {name: /Cohort sizes compared/}); await waitFor(() => expect(screen.getAllByText('12').length).toBeGreaterThan(0)); };

describe('Morarji page', () => {
  it('shows the selected cohort totals, leaving unrecorded values unknown', async () => {
    setup();
    for (const [label, total] of [
      ['Children in the training cohort', '12'], ['Took the exam', '10'],
      ['Children passed', '5'], ['Results pending', '3'],
    ]) {
      expect(await within(await screen.findByRole('group', {name: label})).findByText(total)).toBeVisible();
    }
  });
  it('switches cohort and shows unknown rather than zero for an unrecorded cohort', async () => {
    const user = userEvent.setup();
    setup();
    await ready();
    await user.selectOptions(screen.getByLabelText('Cohort year'), '2024–25');
    await waitFor(() => expect(screen.getAllByText('Not recorded').length).toBeGreaterThanOrEqual(3)); // took the exam, passed, pending are unknown, not 0
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);                                        // the cohort still has 10 members
  });
  it('compares cohorts and charts passed children per year, with a dash for an unrecorded year', async () => {
    setup();
    // 6.6 is a grouped vertical bar chart: one group per cohort, four bars (in training, applied, took the exam, passed).
    const chart = await screen.findByRole('img', {name: /Cohort sizes compared/});
    expect(chart).toHaveAccessibleName(/In training 12.*Cohort applied.*Took the exam.*Passed/s);
    expect(screen.getByRole('img', {name: /Children who passed by cohort year/})).toBeInTheDocument();
  });
  it('lists the follow-up for the selected cohort with names, ids and unknown results as Pending', async () => {
    setup();
    const follow = await screen.findByRole('table', {name: 'Cohort follow-up'});
    await waitFor(() => expect(within(follow).getAllByRole('row')).toHaveLength(3)); // header + 2 members of 2025–26
    expect(within(follow).getByText('Student e1')).toBeInTheDocument();
    expect(within(follow).getByText('Name not recorded')).toBeInTheDocument();
    expect(within(follow).getByText('Passed')).toBeInTheDocument();
    expect(within(follow).getByText('Pending')).toBeInTheDocument();
    expect(within(follow).getByText('Morarji School')).toBeInTheDocument();
  });
  it('shows by-centre counts from the records', async () => {
    setup();
    const t = await screen.findByRole('table', {name: 'Morarji results by centre'});
    await waitFor(() => expect(within(t).getAllByRole('row')).toHaveLength(2));
    expect(within(t).getByText('Centre 01')).toBeInTheDocument();
  });
  it('gives Leadership inherited individual Morarji follow-up', async () => {
    setup({role: 'Leadership'});
    await ready();
    expect(screen.getByRole('table', {name: 'Cohort follow-up'})).toBeInTheDocument();
    expect(screen.getByText('Student e1')).toBeInTheDocument();
  });
  it('says plainly when no verified cohorts exist and invents nothing', async () => {
    setup({report: base, memberships: [], noCohorts: true});
    expect(await screen.findByText(/Verified cohort outcomes have not been imported/)).toBeInTheDocument();
  });
  it('shows an error when the report fails', async () => {
    setup({fail: true});
    expect((await screen.findAllByText(/statement timeout/)).length).toBeGreaterThan(0);
  });
  it('offers no editing to a Teacher', async () => {
    setup();
    await ready();
    expect(screen.queryByRole('button', {name: /Add Record/})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
  });
  it('adds a Grade 5 student to the selected cohort, then records the first outcome', async () => {
    const user = userEvent.setup();
    const {service} = setup({role: 'Cluster Officer', writes: {morarji: true}});
    await ready();
    await user.click(screen.getByRole('button', {name: 'Add Record'}));
    const dialog = within(await screen.findByRole('dialog'));
    await user.selectOptions(await dialog.findByLabelText('Student'), 'e9');
    await user.selectOptions(dialog.getByLabelText('Application'), 'yes');
    await user.click(dialog.getByRole('button', {name: 'Add to cohort'}));
    await waitFor(() => expect(service.addMember).toHaveBeenCalledWith('e9', 'k2'));
    await waitFor(() => expect(service.recordOutcome).toHaveBeenCalledWith({member: 'm9', applied: true, attended: null, passed: null, school: '', expected: 0}));
  });
  it('saves a changed outcome with the version read from the server', async () => {
    const user = userEvent.setup();
    const {service} = setup({role: 'Leadership', writes: {morarji: true}});
    await ready();
    await user.click((await screen.findAllByRole('button', {name: 'Edit'}))[0]!);
    const dialog = within(await screen.findByRole('dialog'));
    await waitFor(() => expect(service.outcomeVersion).toHaveBeenCalled());
    await user.selectOptions(dialog.getByLabelText('Took the exam'), 'no');
    await user.click(dialog.getByRole('button', {name: 'Save outcome'}));
    await waitFor(() => expect(service.recordOutcome).toHaveBeenCalledWith(expect.objectContaining({expected: 2, attended: false})));
  });
  it('has no automatic accessibility violations', async () => {
    const {container} = setup();
    await ready();
    expect(await violations(container)).toEqual([]);
  });
});
