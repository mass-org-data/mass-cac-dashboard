import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {RegisterDialog} from './RegisterDialog';
import type {AttendanceService, RegisterCapabilities, RegisterRead} from './service';
import {violations} from '../test/axe';

const caps: RegisterCapabilities = {version: 6, enabled: true, session_entry: true, register_paging: true, holiday_code: true};
const centres = [{id: 'c1', label: 'Centre 01'}, {id: 'c2', label: 'Centre 02'}];
const roster = [{id: 'e1', name: 'Asha', grade: '4'}, {id: 'e2', name: 'Ravi', grade: '5'}, {id: 'e3', name: null, grade: '5'}];
const empty: RegisterRead = {roster, marks: [], token: 'tok-new', recorded: 0, notes: ''};
const recorded: RegisterRead = {roster, marks: [{enrolment: 'e1', code: 'P'}, {enrolment: 'e2', code: 'P'}, {enrolment: 'e3', code: 'A'}], token: 'tok-saved', recorded: 3, notes: 'Saved note'};

function setup(read: RegisterRead = empty, overrides: Partial<AttendanceService> = {}, props: Partial<React.ComponentProps<typeof RegisterDialog>> = {}) {
  const service = {
    capabilities: vi.fn(), page: vi.fn(), distribution: vi.fn(),
    readRegister: vi.fn(async () => read),
    saveClassroom: vi.fn(async () => ({})), saveHoliday: vi.fn(async () => ({})), deleteRegister: vi.fn(async () => ({})),
    ...overrides,
  } as unknown as AttendanceService;
  const onSaved = vi.fn(async () => undefined), onClose = vi.fn(), confirm = vi.fn(() => true);
  const view = render(<RegisterDialog service={service} capabilities={caps} centres={centres} initial={{centre: 'c1', shift: 'Morning', date: '2026-11-12'}} today="2026-11-14" onSaved={onSaved} onClose={onClose} confirm={confirm} {...props} />);
  return {service, onSaved, onClose, confirm, ...view};
}
const saveButton = () => screen.getByRole('button', {name: /^Save Attendance$|^Saving…$/});
const markAs = async (user: ReturnType<typeof userEvent.setup>, code: 'P' | 'A', name: string) => user.click(screen.getByRole('button', {name: `${code === 'P' ? 'Present' : 'Absent'}: ${name}`}));

describe('Attendance register dialog', () => {
  it('loads the roster for the chosen centre, shift and date and shows names, grades and an unnamed student safely', async () => {
    const {service} = setup();
    expect(await screen.findByRole('dialog', {name: 'Add attendance'})).toBeInTheDocument();
    await screen.findByText('Asha');
    expect(service.readRegister).toHaveBeenCalledWith('c1', 'Morning', '2026-11-12');
    expect(screen.getByText('Name not recorded')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('3 students · 0 marked · Saved marks loaded');
  });

  it('keeps marks as drafts: Save stays disabled until every student is marked and nothing is sent before Save', async () => {
    const user = userEvent.setup();
    const {service} = setup();
    await screen.findByText('Asha');
    expect(saveButton()).toBeDisabled();
    await markAs(user, 'P', 'Asha'); await markAs(user, 'A', 'Ravi');
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('2 marked · Unsaved changes');
    expect(service.saveClassroom).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', {name: 'Mark all present'}));
    expect(saveButton()).toBeEnabled();
    expect(service.saveClassroom).not.toHaveBeenCalled();
  });

  it('offers only Present and Absent for classroom marks and exposes pressed state', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Asha');
    expect(screen.queryByRole('button', {name: /Holiday: |Leave|Monthly/})).not.toBeInTheDocument();
    await markAs(user, 'P', 'Asha');
    expect(screen.getByRole('button', {name: 'Present: Asha'})).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', {name: 'Absent: Asha'})).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', {name: 'Clear mark: Asha'}));
    expect(screen.getByRole('button', {name: 'Present: Asha'})).toHaveAttribute('aria-pressed', 'false');
  });

  it('saves the whole roster with the server token, a request id and the notes, then refreshes and closes', async () => {
    const user = userEvent.setup();
    const {service, onSaved, onClose} = setup();
    await screen.findByText('Asha');
    await user.click(screen.getByRole('button', {name: 'Mark all present'}));
    await markAs(user, 'A', 'Ravi');
    await user.type(screen.getByLabelText('Notes'), 'Sports day');
    await user.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const args = vi.mocked(service.saveClassroom).mock.calls[0][0] as Record<string, unknown>;
    expect(args).toMatchObject({p_centre: 'c1', p_shift: 'Morning', p_date: '2026-11-12', p_token: 'tok-new', p_reason: 'Attendance entered', p_notes: 'Sports day', p_rows: [{enrolment: 'e1', code: 'P'}, {enrolment: 'e2', code: 'A'}, {enrolment: 'e3', code: 'P'}]});
    expect(args.p_request).toMatch(/^[0-9a-f-]{36}$/);
    expect(onSaved).toHaveBeenCalledWith('Attendance saved and charts refreshed.');
  });

  it('keeps the same request id when a failed save is retried, and never closes on failure', async () => {
    const user = userEvent.setup();
    const saveClassroom = vi.fn().mockRejectedValueOnce(new Error('Unable to reach the service. Check your connection and retry.')).mockResolvedValue({});
    const {service, onClose} = setup(empty, {saveClassroom});
    await screen.findByText('Asha');
    await user.click(screen.getByRole('button', {name: 'Mark all present'}));
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the service');
    expect(onClose).not.toHaveBeenCalled();
    await user.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [first, second] = vi.mocked(service.saveClassroom).mock.calls.map(call => (call[0] as {p_request: string}).p_request);
    expect(second).toBe(first);
  });

  it('shows the conflict message from the server and keeps the drafts', async () => {
    const user = userEvent.setup();
    setup(recorded, {saveClassroom: vi.fn().mockRejectedValue(new Error('This record changed. Reload it and review the latest value before saving again.'))});
    await screen.findByText('Asha');
    await markAs(user, 'A', 'Asha');
    await user.type(screen.getByLabelText(/Reason for correction/), 'Marked in error');
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('This record changed');
    expect(screen.getByRole('button', {name: 'Absent: Asha'})).toHaveAttribute('aria-pressed', 'true');
  });

  it('saved registers open as Edit, explain they are logged, and a correction needs a reason', async () => {
    const user = userEvent.setup();
    const {service} = setup(recorded);
    expect(await screen.findByRole('dialog', {name: 'Edit attendance'})).toBeInTheDocument();
    await screen.findByText('Asha');
    expect(screen.getByRole('note')).toHaveTextContent('Already logged');
    expect(screen.getByLabelText('Notes')).toHaveValue('Saved note');
    await markAs(user, 'A', 'Asha');
    await user.click(saveButton());
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a reason for this correction or deletion.');
    expect(service.saveClassroom).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Reason for correction/), 'Wrong child marked');
    await user.click(saveButton());
    await waitFor(() => expect(service.saveClassroom).toHaveBeenCalled());
    expect(vi.mocked(service.saveClassroom).mock.calls[0][0]).toMatchObject({p_reason: 'Wrong child marked', p_token: 'tok-saved'});
  });

  it('deletes a whole register only with a reason and an explicit confirmation, without sending rows', async () => {
    const user = userEvent.setup();
    const {service, onSaved} = setup(recorded);
    await screen.findByText('Asha');
    await user.click(screen.getByRole('button', {name: 'Delete Attendance'}));
    const del = screen.getByRole('button', {name: 'Delete attendance'});
    await user.click(del);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a reason for this correction or deletion.');
    await user.type(screen.getByLabelText(/Reason for correction/), 'Entered on the wrong date');
    await user.click(del);
    expect(screen.getByRole('alert')).toHaveTextContent('Tick the confirmation');
    await user.click(screen.getByRole('checkbox', {name: /deletes the entire register/}));
    await user.click(del);
    await waitFor(() => expect(service.deleteRegister).toHaveBeenCalled());
    const args = vi.mocked(service.deleteRegister).mock.calls[0][0] as Record<string, unknown>;
    expect(args).toMatchObject({p_reason: 'Entered on the wrong date', p_token: 'tok-saved'});
    expect('p_rows' in args).toBe(false);
    expect(service.saveClassroom).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith('Attendance deleted. History retained.');
  });

  it('records a holiday without a roster and with the notes as the reason', async () => {
    const user = userEvent.setup();
    const {service, onSaved} = setup();
    await screen.findByText('Asha');
    await user.selectOptions(screen.getByLabelText('Session Type'), 'Holiday');
    expect(screen.queryByRole('table', {name: 'Students to mark'})).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Notes'), 'Local festival');
    await user.click(screen.getByRole('button', {name: 'Save Holiday'}));
    await waitFor(() => expect(service.saveHoliday).toHaveBeenCalled());
    expect(vi.mocked(service.saveHoliday).mock.calls[0][0]).toMatchObject({p_centre: 'c1', p_shift: 'Morning', p_date: '2026-11-12', p_reason: 'Local festival'});
    expect(onSaved).toHaveBeenCalledWith('Holiday saved.');
  });

  it('does not offer Monthly Meeting here and sends people to the standard application', async () => {
    setup();
    await screen.findByText('Asha');
    expect(screen.getByRole('option', {name: /Monthly Meeting/})).toBeDisabled();
  });

  it('asks before discarding unsaved changes when the selection or the dialog changes', async () => {
    const user = userEvent.setup();
    const {service, confirm, onClose} = setup();
    await screen.findByText('Asha');
    await markAs(user, 'P', 'Asha');
    confirm.mockReturnValueOnce(false);
    await user.selectOptions(screen.getByLabelText('Shift'), 'Evening');
    expect(confirm).toHaveBeenCalledWith('Discard unsaved attendance changes and change the selection?');
    expect(service.readRegister).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Shift')).toHaveValue('Morning');
    confirm.mockReturnValueOnce(false);
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(onClose).toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText('Shift'), 'Evening');
    await waitFor(() => expect(service.readRegister).toHaveBeenLastCalledWith('c1', 'Evening', '2026-11-12'));
  });

  it('shows a retryable error if the roster cannot be loaded', async () => {
    const user = userEvent.setup();
    const readRegister = vi.fn().mockRejectedValueOnce(new Error('Unable to reach the service. Check your connection and retry.')).mockResolvedValue(empty);
    setup(empty, {readRegister});
    expect(await screen.findByText(/Unable to reach the service/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Retry'}));
    await screen.findByText('Asha');
  });

  it('after a save whose refresh fails, says the save is done and never lets it be submitted again', async () => {
    const user = userEvent.setup();
    const {service, onClose} = setup(empty, {}, {onSaved: vi.fn(async () => { throw new Error('refresh failed'); })});
    await screen.findByText('Asha');
    await user.click(screen.getByRole('button', {name: 'Mark all present'}));
    await user.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Attendance was saved, but refreshed data could not be loaded. Reload this page; do not submit again.');
    expect(onClose).not.toHaveBeenCalled();
    expect(saveButton()).toBeDisabled();
    expect(service.saveClassroom).toHaveBeenCalledTimes(1);
  });

  it('fixes the centre for a one-centre Teacher', async () => {
    setup(empty, {}, {centres: [{id: 'c1', label: 'Centre 01'}]});
    await screen.findByText('Asha');
    expect(screen.getByLabelText('Centre')).toBeDisabled();
  });

  it('has no automatically detectable accessibility violations', async () => {
    setup(recorded);
    await screen.findByText('Asha');
    const dialog = screen.getByRole('dialog');
    expect(await violations(dialog)).toEqual([]);
    expect(within(dialog).getAllByRole('group').length).toBeGreaterThan(2);
  });
});
