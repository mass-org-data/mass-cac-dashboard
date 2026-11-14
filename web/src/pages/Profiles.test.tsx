import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {Profiles} from './Profiles';
import type {ProfilesService, StudentRow} from '../profiles/service';
import type {LiveBackend} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';
import {violations} from '../test/axe';

vi.mock('../lib/dates', async importOriginal => ({...(await importOriginal<typeof import('../lib/dates')>()), todayIst: () => '2026-11-14'}));

const ctx = (roles: string[], write = true): ProgrammeContext => ({user_id: 'u1', operational_roles_enabled: true, centres: [{id: 'c1', label: 'Centre 01', roles, can_write: write}, {id: 'c2', label: 'Centre 02', roles, can_write: write}]}) as unknown as ProgrammeContext;
const student = (n: number): StudentRow => ({enrolment: `e${n}`, child: `k${n}`, studentId: `S${String(n).padStart(3, '0')}`, name: n === 3 ? null : `Student ${n}`, centre: n % 2 ? 'c1' : 'c2', grade: String(1 + (n % 9)), shift: 'Evening', gender: n % 2 ? 'Girl' : null, enrolled: '2026-06-01', status: 'Active', board: null, version: 1});
const all = Array.from({length: 23}, (_, i) => student(i + 1));
const caps = {version: 6, profile_pages: true, profile_sort_v2: true};

function setup(options: {role?: string; writes?: Record<string, boolean>; caps?: object; write?: boolean} = {}) {
  const service = {
    capabilities: vi.fn(async () => options.caps ?? caps),
    page: vi.fn(async (_f, p) => ({ids: all.slice(p.offset, p.offset + 10).map(s => s.enrolment), total: all.length})),
    students: vi.fn(async (_c, ids: string[]) => ids.map(id => all.find(s => s.enrolment === id)!)),
    clear: vi.fn(), history: vi.fn(async () => []), revision: vi.fn(async () => 7), register: vi.fn(async () => ({})), saveProfile: vi.fn(async () => 8),
  } as unknown as ProfilesService;
  const backend = {rpc: vi.fn(), readCapabilities: vi.fn(async () => ({reviewedCharts: true, reviewedAttendanceSeries: true, writes: options.writes ?? {}}))} as unknown as LiveBackend;
  const role = options.role ?? 'Teacher';
  const view = render(<Profiles backend={backend} context={ctx([role], options.write ?? true)} role={role} service={service} />);
  return {service, ...view};
}
const table = async () => screen.findByRole('table', {name: 'Student profiles'});
const bodyRows = (t: HTMLElement) => within(t).getAllByRole('row').slice(1);

describe('Student profiles page', () => {
  it('shows ten students per page from the server with unknown values explained', async () => {
    const user = userEvent.setup();
    const {service} = setup();
    const t = await table();
    await waitFor(() => expect(bodyRows(t)).toHaveLength(10));
    expect(vi.mocked(service.page).mock.calls[0]![0]).toEqual(expect.objectContaining({centres: ['c1', 'c2'], query: '', grade: null}));
    expect(vi.mocked(service.page).mock.calls[0]![1]).toEqual({offset: 0, sort: 'name', reverse: false});
    expect(within(t).getByText('Name not recorded')).toBeInTheDocument();
    expect(within(t).getAllByText('Unknown').length).toBeGreaterThan(0);
    await user.click(within(screen.getByRole('region', {name: /Student profiles/})).getByRole('button', {name: 'Next page'}));
    await waitFor(() => expect(vi.mocked(service.page).mock.calls.at(-1)![1]).toEqual({offset: 10, sort: 'name', reverse: false}));
  });
  it('sorts on the server: ascending first, then descending, and returns to the first page', async () => {
    const user = userEvent.setup();
    const {service} = setup();
    const t = await table();
    await waitFor(() => expect(bodyRows(t)).toHaveLength(10));
    await user.click(within(t).getByRole('button', {name: /Grade/}));
    await waitFor(() => expect(vi.mocked(service.page).mock.calls.at(-1)![1]).toEqual({offset: 0, sort: 'grade', reverse: false}));
    await user.click(within(t).getByRole('button', {name: /Grade/}));
    await waitFor(() => expect(vi.mocked(service.page).mock.calls.at(-1)![1]).toEqual({offset: 0, sort: 'grade', reverse: true}));
  });
  it('searches on the server and filters by grade', async () => {
    const user = userEvent.setup();
    const {service} = setup();
    await table();
    await user.type(screen.getByLabelText('Search name, ID or centre'), 'asha');
    await waitFor(() => expect(vi.mocked(service.page).mock.calls.at(-1)![0]).toEqual(expect.objectContaining({query: 'asha'})), {timeout: 3000});
    await user.selectOptions(screen.getByLabelText('Grade'), '4');
    await waitFor(() => expect(vi.mocked(service.page).mock.calls.at(-1)![0]).toEqual(expect.objectContaining({grade: '4'})));
  });
  it('does not request any students for Leadership', async () => {
    const {service} = setup({role: 'Leadership'});
    expect(await screen.findByRole('note')).toHaveTextContent(/aggregate reporting only/);
    expect(service.page).not.toHaveBeenCalled();
    expect(service.capabilities).not.toHaveBeenCalled();
  });
  it('explains an older backend instead of failing', async () => {
    setup({caps: {version: 3}});
    expect(await screen.findByRole('alert')).toHaveTextContent(/older than the new interface supports/);
  });
  it('shows a retryable error when the server fails', async () => {
    const user = userEvent.setup();
    const {service} = setup();
    await table();
    vi.mocked(service.page).mockRejectedValueOnce(new Error('statement timeout'));
    await user.type(screen.getByLabelText('Student ID'), 'S0');
    expect(await screen.findByText(/statement timeout/, undefined, {timeout: 3000})).toBeInTheDocument();
  });
  it('opens Add student; saving is switched off until activation, then registers once with a request id', async () => {
    const user = userEvent.setup();
    const {service, unmount} = setup();
    await table();
    await user.click(screen.getByRole('button', {name: 'Add student'}));
    expect(await screen.findByText(/Saving is switched off/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save student'})).toBeDisabled();
    expect(service.register).not.toHaveBeenCalled();
    unmount();
    const live = setup({writes: {registration: true}});
    await table();
    await user.click(screen.getByRole('button', {name: 'Add student'}));
    await user.click(screen.getByRole('button', {name: 'Save student'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the verified name.');
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Full name'), 'Meera');
    await user.selectOptions(dialog.getByLabelText('Shift'), 'Evening');
    await user.type(dialog.getByLabelText('Start date'), '2026-11-01');
    await user.click(screen.getByRole('button', {name: 'Save student'}));
    await waitFor(() => expect(live.service.register).toHaveBeenCalledWith(expect.objectContaining({centre: 'c1', name: 'Meera', shift: 'Evening', start: '2026-11-01', gender: null, request: expect.any(String)})));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(live.service.clear).toHaveBeenCalled();
  });
  it('edits a profile with the loaded revision when profile writes are on', async () => {
    const user = userEvent.setup();
    const {service} = setup({writes: {profiles: true}});
    const t = await table();
    await user.click(within(t).getByRole('button', {name: 'Edit profile: Student 1'}));
    await screen.findByLabelText('Full name');
    await waitFor(() => expect(screen.getByRole('button', {name: 'Save profile'})).toBeEnabled());
    await user.clear(screen.getByLabelText('Full name'));
    await user.type(screen.getByLabelText('Full name'), 'Student One');
    await user.click(screen.getByRole('button', {name: 'Save profile'}));
    await waitFor(() => expect(service.saveProfile).toHaveBeenCalledWith(expect.objectContaining({child: 'k1', revision: 7, name: 'Student One'})));
  });
  it('shows View only when the role cannot write the centres', async () => {
    setup({write: false});
    const t = await table();
    await waitFor(() => expect(within(t).getAllByText('View only').length).toBe(10));
    expect(screen.queryByRole('button', {name: 'Add student'})).not.toBeInTheDocument();
  });
  it('has no automatic accessibility violations', async () => {
    const {container} = setup();
    await table();
    expect(await violations(container)).toEqual([]);
  });
});
