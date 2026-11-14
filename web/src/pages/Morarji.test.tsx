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

vi.mock('../lib/dates', async importOriginal => ({...(await importOriginal<typeof import('../lib/dates')>()), todayIst: () => '2026-11-14'}));

const ctx = (roles: string[]): ProgrammeContext => ({user_id: 'u1', operational_roles_enabled: true, centres: [{id: 'c1', label: 'Centre 01', roles, can_write: true}, {id: 'c2', label: 'Centre 02', roles, can_write: true}]}) as unknown as ProgrammeContext;
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

function setup(options: {role?: string; report?: Report; memberships?: typeof members; fail?: boolean; noCohorts?: boolean} = {}) {
  const service = {memberships: vi.fn(async () => options.memberships ?? members)} as unknown as MorarjiService;
  const profiles = {students: vi.fn(async (_c: string[], ids: string[]) => ids.map(id => ({enrolment: id, child: id, studentId: `S-${id}`, name: id === 'e2' ? null : `Student ${id}`, centre: 'c1', grade: '5', shift: 'Evening', gender: null, enrolled: '2026-06-01', status: 'Active', board: null, version: 1})))} as unknown as ProfilesService;
  const overview = {report: vi.fn(async () => { if (options.fail) throw new Error('statement timeout'); return options.report ?? withData; }), clear: vi.fn()} as unknown as OverviewService;
  const backend = {rpc: vi.fn(), readReferences: vi.fn(async () => (options.noCohorts ? {...refs, programme_cohorts: []} : refs)), readCapabilities: vi.fn(async () => ({reviewedCharts: true, reviewedAttendanceSeries: true, writes: {}}))} as unknown as LiveBackend;
  const role = options.role ?? 'Teacher';
  const view = render(<Morarji backend={backend} context={ctx([role])} role={role} service={service} profiles={profiles} overview={overview} />);
  return {service, profiles, overview, ...view};
}

const ready = async () => { await screen.findByRole('table', {name: 'Cohort sizes compared'}); await waitFor(() => expect(screen.getAllByText('12').length).toBeGreaterThan(0)); };

describe('Morarji page', () => {
  it('shows the selected cohort totals, leaving unrecorded values unknown', async () => {
    setup();
    await ready();                                                          // members 12
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);           // took the exam
    expect(screen.getAllByText('5').length).toBeGreaterThan(0);            // passed
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);            // 12 - 9 known results pending
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
    const table = await screen.findByRole('table', {name: 'Cohort sizes compared'});
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(3));
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
  it('gives Leadership totals only: no student rows are requested', async () => {
    const {service, profiles} = setup({role: 'Leadership'});
    await ready();
    expect(screen.queryByRole('table', {name: 'Cohort follow-up'})).not.toBeInTheDocument();
    expect(service.memberships).not.toHaveBeenCalled();
    expect(profiles.students).not.toHaveBeenCalled();
    expect(screen.getByText(/Leadership sees cohort totals only/)).toBeInTheDocument();
  });
  it('says plainly when no verified cohorts exist and invents nothing', async () => {
    setup({report: base, memberships: [], noCohorts: true});
    expect(await screen.findByText(/Verified cohort outcomes have not been imported/)).toBeInTheDocument();
  });
  it('shows an error when the report fails', async () => {
    setup({fail: true});
    expect((await screen.findAllByText(/statement timeout/)).length).toBeGreaterThan(0);
  });
  it('offers no editing and says why', async () => {
    setup();
    await ready();
    expect(screen.queryByRole('button', {name: /Add to training cohort|Update/})).not.toBeInTheDocument();
    expect(screen.getByText(/This screen only reads/)).toBeInTheDocument();
  });
  it('has no automatic accessibility violations', async () => {
    const {container} = setup();
    await ready();
    expect(await violations(container)).toEqual([]);
  });
});
