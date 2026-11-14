import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {Visits} from './Visits';
import type {Assignment, OfficerRow, SummaryRow, VisitRow, VisitsService} from '../visits/service';
import type {LiveBackend} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';
import {violations} from '../test/axe';

vi.mock('../lib/dates', async importOriginal => ({...(await importOriginal<typeof import('../lib/dates')>()), todayIst: () => '2026-11-14'}));

const ctx = (roles: string[], write = true): ProgrammeContext => ({user_id: 'u1', operational_roles_enabled: true, centres: [{id: 'c1', label: 'Centre 01', roles, can_write: write}, {id: 'c2', label: 'Centre 02', roles, can_write: write}]}) as unknown as ProgrammeContext;
const refs = {academic_years: [{id: 'y1', starts_on: '2026-04-01', ends_before: '2027-04-01'}], assessment_periods: [], assessment_definitions: []};
const sum = (id: string, m: number, e: number, rec = m + e): SummaryRow => ({centre_id: id, morning: m, evening: e, target_morning: 2, target_evening: 2, achieved: m >= 2 && e >= 2, recorded_count: rec});
const officers: OfficerRow[] = [{centre_id: 'c1', officer_id: 'o1', label: 'Meera', morning: 2, evening: 2, recorded_count: 4}, {centre_id: 'c2', officer_id: 'o1', label: 'Meera', morning: 1, evening: 0, recorded_count: 1}];
const assignment: Assignment = {id: 'a1', centre_id: 'c1', officer_id: 'o1', shift_scope: 'Both shifts', starts_on: '2026-04-01', ends_before: null};
const visit: VisitRow = {id: 'v1', centre_id: 'c1', officer_id: 'o1', shift_code: 'Morning', visit_date: '2026-11-03', status: 'Completed', feedback: 'Roster complete', next_action: 'Follow up', row_version: 1};

function setup(options: {role?: string; writes?: Record<string, boolean>; summary?: SummaryRow[]; assignments?: Assignment[]; fail?: boolean} = {}) {
  const service = {
    assignments: vi.fn(async () => options.assignments ?? [assignment]),
    summary: vi.fn(async () => { if (options.fail) throw new Error('statement timeout'); return options.summary ?? [sum('c1', 2, 2), sum('c2', 1, 0)]; }),
    officers: vi.fn(async () => officers), log: vi.fn(async () => [visit]), record: vi.fn(async () => 1),
  } as unknown as VisitsService;
  const backend = {rpc: vi.fn(), readReferences: vi.fn(async () => refs), readCapabilities: vi.fn(async () => ({reviewedCharts: true, reviewedAttendanceSeries: true, writes: options.writes ?? {}}))} as unknown as LiveBackend;
  const role = options.role ?? 'Cluster Officer';
  const view = render(<Visits backend={backend} context={ctx([role])} role={role} service={service} />);
  return {service, ...view};
}

describe('Visits page', () => {
  it('shows completed counts, target and coverage from the server summary', async () => {
    setup();
    expect(await screen.findByText('Standard target 8 (2 Morning + 2 Evening per centre)')).toBeInTheDocument();
    expect(screen.getByText('Visits completed')).toBeInTheDocument();
    const coverage = screen.getByRole('table', {name: 'Centre coverage'});
    expect(within(coverage).getByText('Recorded target achieved')).toBeInTheDocument();
    expect(within(coverage).getByText('Recorded target not achieved')).toBeInTheDocument();
  });
  it('asks only for the officer own coverage as a Cluster Officer', async () => {
    const {service} = setup();
    await screen.findByText(/Standard target/);
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
  it('shows an error and retry when the server fails', async () => {
    setup({role: 'Leadership', fail: true});
    expect((await screen.findAllByText(/statement timeout/)).length).toBeGreaterThan(0);
  });
  it('is read-only for Leadership and offers an officer filter from the summary', async () => {
    const {service} = setup({role: 'Leadership'});
    await screen.findByText(/Standard target/);
    expect(screen.queryByRole('button', {name: 'Record a visit'})).not.toBeInTheDocument();
    expect(screen.queryByRole('table', {name: 'Visit log'})).not.toBeInTheDocument();
    expect(vi.mocked(service.summary).mock.calls[0]![2]).toBeNull();
    expect(screen.getByLabelText('Officer')).toBeInTheDocument();
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
  it('has no automatic accessibility violations', async () => {
    const {container} = setup();
    await screen.findByText(/Standard target/);
    expect(await violations(container)).toEqual([]);
  });
});
