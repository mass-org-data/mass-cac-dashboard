import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {Visits} from './Visits';
import type {Assignment, Conductor, OfficerRow, SummaryRow, VisitRow, VisitsService} from '../visits/service';
import type {LiveBackend} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';
import {violations} from '../test/axe';
import {testTableService} from '../test/tableService';

vi.mock('../lib/dates', async importOriginal => ({...(await importOriginal<typeof import('../lib/dates')>()), todayIst: () => '2026-11-14'}));

const ctx = (roles: string[], write = true): ProgrammeContext => ({user_id: 'u1', role: roles[0], centres: [{id: 'c1', label: 'Centre 01', can_write: write}, {id: 'c2', label: 'Centre 02', can_write: write}]});
const refs = {academic_years: [{id: 'y1', starts_on: '2026-04-01', ends_before: '2027-04-01'}], assessment_periods: [], assessment_definitions: []};
const sum = (id: string, m: number, e: number, rec = m + e): SummaryRow => ({centre_id: id, morning: m, evening: e, target_morning: 2, target_evening: 2, achieved: m >= 2 && e >= 2, recorded_count: rec});
const officers: OfficerRow[] = [{centre_id: 'c1', officer_id: 'o1', label: 'Meera', morning: 2, evening: 2, recorded_count: 4}, {centre_id: 'c2', officer_id: 'o1', label: 'Meera', morning: 1, evening: 0, recorded_count: 1}];
const assignment: Assignment = {id: 'a1', centre_id: 'c1', officer_id: 'o1', shift_scope: 'Both shifts', starts_on: '2026-04-01', ends_before: null};
const visit: VisitRow = {id: 'v1', centre_id: 'c1', officer_id: 'o1', shift_code: 'Morning', visit_date: '2026-11-03', status: 'Completed', feedback: 'Roster complete', next_action: 'Follow up', row_version: 1};

function setup(options: {role?: string; writes?: Record<string, boolean>; summary?: SummaryRow[]; assignments?: Assignment[]; conductors?: Conductor[] | null; fail?: boolean} = {}) {
  const service = {
    assignments: vi.fn(async () => options.assignments ?? [assignment]),
    conductors: vi.fn(async () => options.conductors === undefined ? [{user_id: 'u-lead', centre_id: null, role_code: 'Leadership', label: 'Priya Rao'}, {user_id: 'u-co', centre_id: 'c1', role_code: 'Cluster Officer', label: 'Anil Kumar'}, {user_id: 'u-co2', centre_id: 'c2', role_code: 'Cluster Officer', label: 'Other Officer'}] : options.conductors),
    summary: vi.fn(async () => { if (options.fail) throw new Error('statement timeout'); return options.summary ?? [sum('c1', 2, 2), sum('c2', 1, 0)]; }),
    officers: vi.fn(async () => officers), log: vi.fn(async () => [visit]), record: vi.fn(async () => 1),
  } as unknown as VisitsService;
  const backend = {rpc: vi.fn(), readReferences: vi.fn(async () => refs), readCapabilities: vi.fn(async () => ({reviewedCharts: true, reviewedAttendanceSeries: true, writes: options.writes ?? {}}))} as unknown as LiveBackend;
  const role = options.role ?? 'Cluster Officer';
  const summary = options.summary ?? [sum('c1', 2, 2), sum('c2', 1, 0)];
  const officerLines = [{id: 'o1', label: 'Meera', completed: 5, target: 8, records: 5}];
  const view = render(<Visits backend={backend} context={ctx([role])} role={role} service={service} tables={testTableService({visit_centres: summary, visit_officers: officerLines, visit_log: [visit]})} />);
  return {service, ...view};
}

describe('Visits page', () => {
  it('shows completed counts, target and coverage from the server summary', async () => {
    setup();
    const coverage = await screen.findByRole('table', {name: 'Centre coverage'});
    expect(screen.getByRole('group', {name: 'Visits completed'})).toHaveTextContent('5');
    expect(screen.queryByText(/Standard target 8/)).not.toBeInTheDocument();
    expect(within(coverage).getByText('Recorded target achieved')).toBeInTheDocument();
    expect(within(coverage).getByText('Recorded target not achieved')).toBeInTheDocument();
  });
  it('asks only for the officer own coverage as a Cluster Officer', async () => {
    const {service} = setup();
    await screen.findByRole('table', {name: 'Centre coverage'});
    expect(vi.mocked(service.summary).mock.calls[0]).toEqual([['c1', 'c2'], '2026-11', 'o1']);
  });
  it('leaves coverage unknown, never zero, when nothing is recorded', async () => {
    setup({summary: [sum('c1', 0, 0, 0)]});
    expect(await screen.findAllByText('No verified visits recorded for this month')).not.toHaveLength(0);
    expect(within(screen.getByRole('table', {name: 'Centre coverage'})).getByText('No verified visits')).toBeInTheDocument();
  });
  it('explains an officer without a verified assignment instead of guessing one', async () => {
    setup({assignments: []});
    expect(await screen.findByRole('alert')).toHaveTextContent(/No verified, dated officer assignment/);
  });
  it('shows coverage by centre, with no officer filter, for an account linked to several officer identities', async () => {
    const {service} = setup({assignments: [assignment, {...assignment, id: 'a2', centre_id: 'c2', officer_id: 'o2'}]});
    await screen.findByRole('table', {name: 'Centre coverage'});
    expect(screen.queryByRole('alert')).toBeNull();
    expect(vi.mocked(service.summary).mock.calls[0]![2]).toBeNull();
    expect(screen.getByRole('button', {name: 'Record a visit'})).toBeInTheDocument();
  });
  it('shows an error and retry when the server fails', async () => {
    setup({role: 'Leadership', fail: true});
    expect((await screen.findAllByText(/statement timeout/)).length).toBeGreaterThan(0);
  });
  it('gives Leadership inherited visit entry, full details and the officer filter', async () => {
    const {service} = setup({role: 'Leadership'});
    expect(await screen.findByLabelText('Officer')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Record a visit'})).toBeInTheDocument();
    expect(screen.getByRole('table', {name: 'Visit log'})).toBeInTheDocument();
    expect(vi.mocked(service.summary).mock.calls[0]![2]).toBeNull();
  });
  it('lists the visit log for a Cluster Officer', async () => {
    setup();
    const log = await screen.findByRole('table', {name: 'Visit log'});
    await waitFor(() => expect(within(log).getByText('Roster complete')).toBeInTheDocument());
  });
  it('opens Record a visit for review with saving off until the gate is on', async () => {
    const user = userEvent.setup();
    const {service} = setup();
    await user.click(await screen.findByRole('button', {name: 'Record a visit'}));
    expect(await screen.findByText(/Saving is switched off/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save visit'})).toBeDisabled();
    expect(service.record).not.toHaveBeenCalled();
  });
  it('validates and then records a visit once with the covering assignment', async () => {
    const user = userEvent.setup();
    const {service} = setup({writes: {visit_entry: true}});
    await user.click(await screen.findByRole('button', {name: 'Record a visit'}));
    const dialog = within(await screen.findByRole('dialog'));
    await user.selectOptions(dialog.getByLabelText('Visit status'), 'Completed');
    await user.click(dialog.getByRole('button', {name: 'Save visit'}));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Completed visits need valid feedback and a non-future date.');
    await user.type(dialog.getByLabelText('Centre feedback'), 'Registers complete');
    await user.click(dialog.getByRole('button', {name: 'Save visit'}));
    await waitFor(() => expect(service.record).toHaveBeenCalledWith(expect.objectContaining({assignment: 'a1', shift: 'Morning', date: '2026-11-14', status: 'Completed', feedback: 'Registers complete', id: expect.any(String)})));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(vi.mocked(service.summary).mock.calls.length).toBeGreaterThan(1);
  });
  it('offers Leadership users and the centre Cluster Officer as who conducted the visit, and sends the choice', async () => {
    const user = userEvent.setup();
    const {service} = setup({writes: {visit_entry: true}});
    await user.click(await screen.findByRole('button', {name: 'Record a visit'}));
    const dialog = within(await screen.findByRole('dialog'));
    const field = await dialog.findByLabelText('Visit conducted by');
    const names = within(field).getAllByRole('option').map(o => o.textContent);
    expect(names).toEqual(['Me (the person recording)', 'Priya Rao (Leadership)', 'Anil Kumar (Cluster Officer)']);   // not the other centre's officer
    await user.selectOptions(field, 'u-lead');
    await user.click(dialog.getByRole('button', {name: 'Save visit'}));
    await waitFor(() => expect(service.record).toHaveBeenCalledWith(expect.objectContaining({conductedBy: 'u-lead'})));
  });
  it('hides the field when the database does not have it yet', async () => {
    const user = userEvent.setup();
    setup({writes: {visit_entry: true}, conductors: null});
    await user.click(await screen.findByRole('button', {name: 'Record a visit'}));
    const dialog = within(await screen.findByRole('dialog'));
    await dialog.findByLabelText('Visit date');
    expect(dialog.queryByLabelText('Visit conducted by')).not.toBeInTheDocument();
  });
  it('has no automatic accessibility violations', async () => {
    const {container} = setup();
    await screen.findByRole('table', {name: 'Centre coverage'});
    expect(await violations(container)).toEqual([]);
  });
});
