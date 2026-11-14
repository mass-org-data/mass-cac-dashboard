import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {Attendance} from './Attendance';
import type {AttendanceService, RegisterCapabilities, RegisterRow} from '../attendance/service';
import type {OverviewService, Report} from '../data/overview';
import type {LiveBackend} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';
import {violations} from '../test/axe';

vi.mock('../lib/dates', async importOriginal => ({...(await importOriginal<typeof import('../lib/dates')>()), todayIst: () => '2026-11-14'}));

const caps: RegisterCapabilities = {version: 6, enabled: true, session_entry: true, register_paging: true, present_distribution: true, holiday_code: true};
const mk = (roles: string[], write = true): ProgrammeContext => ({user_id: 'u1', operational_roles_enabled: true, centres: [{id: 'c1', label: 'Centre 01', roles, can_write: write}, {id: 'c2', label: 'Centre 02', roles, can_write: write}]});
const refs = {academic_years: [{id: 'y1', starts_on: '2026-04-01', ends_before: '2027-04-01'}], assessment_periods: [], assessment_definitions: []};
const row = (n: number): RegisterRow => ({centre_id: n % 2 ? 'c1' : 'c2', shift_code: 'Morning', attendance_date: `2026-11-${String(30 - n).padStart(2, '0')}`, present: 10 - (n % 3), total: 12, eligible: 12, recorded: 12, percentage: 80 + n, created_by: 'Teacher A', last_edited_by: 'Teacher A', last_edited_at: '2026-11-13 10:00'});
const allRows = Array.from({length: 23}, (_, i) => row(i + 1));
const report: Report = {children: 30, grades: {}, genders: {}, attendance: {p: 900, a: 80, l: 20, excluded: 10, percentage: 90}, quarters: [], centres: [{id: 'c1', children: 15, attendance: {p: 500, a: 40, l: 10, excluded: 5, percentage: 91}, quarters: []}, {id: 'c2', children: 15, attendance: {p: 400, a: 40, l: 10, excluded: 5, percentage: null}, quarters: []}]};

function setup(options: {caps?: RegisterCapabilities; context?: ProgrammeContext; role?: string; page?: AttendanceService['page']} = {}) {
  const service = {
    capabilities: vi.fn(async () => options.caps ?? caps),
    page: vi.fn(options.page ?? (async (_f, p) => ({rows: allRows.slice(p.offset, p.offset + 10), total: allRows.length}))),
    distribution: vi.fn(async () => ({days: [{days: 3, students: 2}, {days: 15, students: 4}, {days: 18, students: 6}, {days: 22, students: 3}], recorded_students: 15})),
    readRegister: vi.fn(async () => ({roster: [{id: 'e1', name: 'Asha', grade: '4'}], marks: [], token: 't', recorded: 0, notes: ''})),
    saveClassroom: vi.fn(async () => ({})), saveHoliday: vi.fn(), deleteRegister: vi.fn(),
  } as unknown as AttendanceService;
  const overview = {report: vi.fn(async () => report), shifts: vi.fn(), series: vi.fn(async () => ({'2026-07': 86, '2026-11': 90})), clear: vi.fn()} as unknown as OverviewService;
  const backend = {rpc: vi.fn(), readReferences: vi.fn(async () => refs), readCapabilities: vi.fn(async () => ({reviewedCharts: true, reviewedAttendanceSeries: true}))} as unknown as LiveBackend;
  const role = options.role ?? 'Teacher';
  const view = render(<Attendance backend={backend} context={options.context ?? mk([role])} role={role} service={service} overview={overview} />);
  return {service, overview, ...view};
}
const register = async () => screen.findByRole('table', {name: 'Attendance register'});
const bodyRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);

describe('Attendance page', () => {
  it('shows the saved register newest first, ten rows per page, with server paging', async () => {
    const user = userEvent.setup();
    const {service} = setup();
    const table = await register();
    await waitFor(() => expect(bodyRows(table)).toHaveLength(10));
    expect(vi.mocked(service.page).mock.calls[0]).toEqual([expect.objectContaining({month: '2026-11', centres: ['c1', 'c2']}), {offset: 0, sort: 'date', reverse: false}]);
    expect(within(bodyRows(table)[0]).getAllByRole('cell')[2]).toHaveTextContent('2026-11-29');
    expect(screen.getAllByRole('status').some(el => /Showing 1–10 of 23/.test(el.textContent ?? ''))).toBe(true);
    await user.click(within(screen.getByRole('region', {name: /Attendance register/})).getByRole('button', {name: 'Next page'}));
    await waitFor(() => expect(vi.mocked(service.page).mock.calls.at(-1)![1]).toEqual({offset: 10, sort: 'date', reverse: false}));
    await waitFor(() => expect(bodyRows(table)).toHaveLength(10));
    await user.click(within(screen.getByRole('region', {name: /Attendance register/})).getByRole('button', {name: 'Next page'}));
    await waitFor(() => expect(bodyRows(table)).toHaveLength(3));
  });

  it('sorts on the server: a new column ascending, the same column again reversed, back to page one', async () => {
    const user = userEvent.setup();
    const {service} = setup();
    const table = await register();
    await waitFor(() => expect(bodyRows(table)).toHaveLength(10));
    await user.click(within(within(table).getByRole('columnheader', {name: /Centre/})).getByRole('button'));
    await waitFor(() => expect(vi.mocked(service.page).mock.calls.at(-1)![1]).toEqual({offset: 0, sort: 'centre', reverse: false}));
    await user.click(within(within(table).getByRole('columnheader', {name: /Centre/})).getByRole('button'));
    await waitFor(() => expect(vi.mocked(service.page).mock.calls.at(-1)![1]).toEqual({offset: 0, sort: 'centre', reverse: true}));
    expect(within(table).getByRole('columnheader', {name: /Centre/})).toHaveAttribute('aria-sort', 'descending');
  });

  it('shows holiday rows as recorded holidays and the audit columns', async () => {
    setup({page: async () => ({rows: [{...row(1), session_type: 'Holiday', total: null, present: 0, percentage: null}, row(2)], total: 2})});
    const table = await register();
    await waitFor(() => expect(bodyRows(table)).toHaveLength(2));
    expect(within(bodyRows(table)[0]).getByText('Recorded holiday', {selector: 'td'})).toBeInTheDocument();
    expect(within(bodyRows(table)[1]).getAllByRole('cell')[5]).toHaveTextContent('Teacher A');
    expect(within(table).getAllByText('Excluded').length).toBe(1);
  });

  it('lets a Teacher add attendance and edit a saved register, with the register opened for that row', async () => {
    const user = userEvent.setup();
    const {service} = setup();
    const table = await register();
    await waitFor(() => expect(bodyRows(table)).toHaveLength(10));
    await user.click(screen.getByRole('button', {name: 'Add Attendance'}));
    expect(await screen.findByRole('dialog', {name: 'Add attendance'})).toBeInTheDocument();
    expect(service.readRegister).toHaveBeenLastCalledWith('c1', 'Morning', '2026-11-14');
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    await user.click(within(table).getAllByRole('button', {name: /^Edit attendance:/})[0]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(service.readRegister).toHaveBeenLastCalledWith('c1', 'Morning', '2026-11-29');
  });

  it('is read only for Leadership: no add button, no edit buttons', async () => {
    setup({role: 'Leadership', context: mk(['Leadership'], false)});
    const table = await register();
    await waitFor(() => expect(bodyRows(table)).toHaveLength(10));
    expect(screen.queryByRole('button', {name: 'Add Attendance'})).not.toBeInTheDocument();
    expect(screen.getByText('Leadership views attendance only.')).toBeInTheDocument();
    expect(within(table).queryByRole('button', {name: /Edit attendance/})).not.toBeInTheDocument();
    expect(within(table).getAllByText('View only').length).toBe(10);
  });

  it('hides entry and explains why when the register is not enabled for entry', async () => {
    setup({caps: {...caps, enabled: false}});
    await register();
    expect(screen.queryByRole('button', {name: 'Add Attendance'})).not.toBeInTheDocument();
    expect(screen.getByText('Attendance entry is not enabled for this workspace.')).toBeInTheDocument();
  });

  it('tells the user to use the standard application when the register API is too old', async () => {
    setup({caps: {version: 2, enabled: true}});
    expect(await screen.findByRole('alert')).toHaveTextContent('older than the new interface supports');
  });

  it('shows the scorecards, the attendance bands and the centre table from the same reports', async () => {
    setup();
    await waitFor(() => expect(screen.getByRole('group', {name: 'Student attendance rate'})).toHaveTextContent('90.0%'));
    expect(screen.getByRole('group', {name: 'Present student-days'})).toHaveTextContent('900');
    expect(screen.getByRole('group', {name: 'Students with low attendance'})).toHaveTextContent('—');
    const bands = await screen.findByRole('img', {name: /Students by days present.*Below 15 2, 15 days 4, 16–20 6, 21 or more 3/});
    expect(bands).toBeInTheDocument();
    const centreTable = await screen.findByRole('table', {name: 'Attendance by centre'});
    expect(within(centreTable).getByText('91.0%')).toBeInTheDocument();
    expect(within(centreTable).getByText('Unknown')).toBeInTheDocument();
  });

  it('returns to page one and newest first when a filter changes', async () => {
    const user = userEvent.setup();
    const {service} = setup();
    const table = await register();
    await waitFor(() => expect(bodyRows(table)).toHaveLength(10));
    await user.click(within(screen.getByRole('region', {name: /Attendance register/})).getByRole('button', {name: 'Next page'}));
    await waitFor(() => expect(vi.mocked(service.page).mock.calls.at(-1)![1].offset).toBe(10));
    await user.selectOptions(screen.getByLabelText('Shift'), 'Evening');
    await waitFor(() => expect(vi.mocked(service.page).mock.calls.at(-1)).toEqual([expect.objectContaining({shift: 'Evening'}), {offset: 0, sort: 'date', reverse: false}]));
  });

  it('shows a retryable error when the register cannot be read', async () => {
    const user = userEvent.setup();
    let fail = true;
    const {service} = setup({page: async () => { if (fail) throw new Error('Unable to reach the service. Check your connection and retry.'); return {rows: [row(1)], total: 1}; }});
    expect(await screen.findByText(/Unable to reach the service/)).toBeInTheDocument();
    fail = false;
    await user.click(screen.getAllByRole('button', {name: 'Retry'})[0]);
    await waitFor(() => expect(vi.mocked(service.page).mock.calls.length).toBeGreaterThan(1));
    expect(await register()).toBeInTheDocument();
  });

  it('refreshes the register after a save and announces it', async () => {
    const user = userEvent.setup();
    const {service, overview} = setup();
    const table = await register();
    await waitFor(() => expect(bodyRows(table)).toHaveLength(10));
    const before = vi.mocked(service.page).mock.calls.length;
    await user.click(screen.getByRole('button', {name: 'Add Attendance'}));
    await screen.findByText('Asha');
    await user.click(screen.getByRole('button', {name: 'Mark all present'}));
    await user.click(screen.getByRole('button', {name: 'Save Attendance'}));
    await waitFor(() => expect(vi.mocked(service.page).mock.calls.length).toBeGreaterThan(before));
    expect(overview.clear).toHaveBeenCalled();
    expect(await screen.findByText('Attendance saved and charts refreshed.')).toBeInTheDocument();
  });

  it('has no automatically detectable accessibility violations', async () => {
    const {container} = setup();
    const table = await register();
    await waitFor(() => expect(bodyRows(table)).toHaveLength(10));
    await screen.findByRole('img', {name: /Students by days present/});
    await screen.findByRole('img', {name: /Attendance by month/});
    expect(await violations(container)).toEqual([]);
  });
});
