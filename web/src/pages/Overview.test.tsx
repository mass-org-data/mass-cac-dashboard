import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {Overview} from './Overview';
import {createOverviewService, type OverviewService, type Report} from '../data/overview';
import type {LiveBackend} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';
import {violations} from '../test/axe';

vi.mock('../lib/dates', async importOriginal => ({...(await importOriginal<typeof import('../lib/dates')>()), todayIst: () => '2026-11-14'}));

const centres = Array.from({length: 12}, (_, i) => ({id: `c${i + 1}`, label: `Centre ${String(i + 1).padStart(2, '0')}`, roles: ['Leadership']}));
const context: ProgrammeContext = {user_id: 'u1', centres};
const refs = {academic_years: [{id: 'y1', starts_on: '2026-04-01', ends_before: '2027-04-01'}], assessment_periods: [1, 2].map(q => ({id: `p${q}`, academic_year_id: 'y1', quarter: q})), assessment_definitions: [{id: 'd1', period_id: 'p1'}, {id: 'd2', period_id: 'p2'}]};
const report: Report = {
  children: 1470, grades: {1: 120, 2: 150}, genders: {Girl: 802, Boy: 668}, attendance: {p: 10, a: 1, l: 1, excluded: 0, percentage: 85.9},
  quarters: [{quarter: 2, n: 1000, mean: 16.2, above20: 438}],
  centres: centres.map((c, i) => ({id: c.id, children: 10 + i, attendance: {p: 1, a: 0, l: 0, excluded: 0, percentage: i === 3 ? null : 80 + i}, quarters: [{quarter: 2, n: i === 2 ? 0 : 5, mean: 15 + i}]})),
};

function setup(options: {capabilities?: {reviewedCharts: boolean; reviewedAttendanceSeries: boolean}; service?: Partial<OverviewService>; role?: string; roles?: string[]} = {}) {
  const rpc = vi.fn();
  const backend = {
    rpc,
    readReferences: vi.fn(async () => refs),
    readCapabilities: vi.fn(async () => options.capabilities ?? {reviewedCharts: true, reviewedAttendanceSeries: true}),
    readDirectory: vi.fn(async () => centres.map((c, i) => ({centre_id: c.id, donor_label: i % 2 ? 'Donor B' : 'Donor A'}))),
  } as unknown as LiveBackend;
  const service: OverviewService = {
    report: vi.fn(async (selection) => ({...report, children: selection.shift === 'Morning' ? 700 : selection.shift === 'Evening' ? 770 : report.children})),
    shifts: vi.fn(async () => ({Morning: 700, Evening: 770})),
    series: vi.fn(async () => ({'2026-07': 86, '2026-08': 85, '2026-11': null})),
    clear: vi.fn(),
    ...options.service,
  } as OverviewService;
  const ctx = options.roles ? {...context, centres: centres.map(c => ({...c, roles: options.roles!}))} : context;
  return {backend, service, ...render(<Overview backend={backend} context={ctx} role={options.role ?? 'Leadership'} service={service} />)};
}

describe('Overview', () => {
  it('shows the eight numbered scorecards with the report values', async () => {
    setup();
    await screen.findByRole('group', {name: 'Students enrolled'});
    await waitFor(() => expect(screen.getByRole('group', {name: 'Students enrolled'})).toHaveTextContent('1,470'));
    expect(screen.getByRole('group', {name: 'Girls'})).toHaveTextContent('802');
    expect(screen.getByRole('group', {name: 'Boys'})).toHaveTextContent('668');
    expect(screen.getByRole('group', {name: 'Centres in this selection'})).toHaveTextContent('12');
    expect(screen.getByRole('group', {name: 'Donors represented'})).toHaveTextContent('2');
    expect(screen.getByRole('group', {name: 'Students scoring above 20'})).toHaveTextContent('438');
    expect(screen.getByRole('group', {name: 'Students with good engagement'})).toHaveTextContent('—');
    for (const reference of ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9', '1.10', '1.11', '1.12', '1.13']) expect(screen.getAllByText(reference).length).toBeGreaterThan(0);
  });

  it('renders the grade, gender and shift charts and the monthly line', async () => {
    setup();
    expect(await screen.findByRole('img', {name: /Students by grade/})).toBeInTheDocument();
    expect(await screen.findByRole('img', {name: /Students by gender.*Girls 802, Boys 668/})).toBeInTheDocument();
    expect(await screen.findByRole('img', {name: /Students by shift.*Morning 700, Evening 770/})).toBeInTheDocument();
    const line = await screen.findByRole('img', {name: /Attendance by month/});
    expect(line.getAttribute('aria-label')).toContain('Aug: 85.0%');
    expect(line.getAttribute('aria-label')).toContain('Nov: unknown');
    expect(line.getAttribute('aria-label')).toContain('Apr: unknown');
  });

  it('lists centres in the shared table: ten per page, alphabetical, unknown shown as Unknown', async () => {
    const user = userEvent.setup();
    setup();
    const table = await screen.findByRole('table', {name: 'Centre comparison'});
    await waitFor(() => expect(within(table).getAllByRole('row').length).toBeGreaterThan(1));
    const bodyRows = within(table).getAllByRole('row').slice(1);
    expect(bodyRows).toHaveLength(10);
    expect(within(bodyRows[0]).getAllByRole('cell')[0]).toHaveTextContent('Centre 01');
    expect(within(table).getAllByText('Unknown').length).toBeGreaterThanOrEqual(2);
    expect(within(table).getByText('16.0 / 25')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Next page'}));
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(2);
  });

  it('asks the service for the chosen month and donor scope', async () => {
    const user = userEvent.setup();
    const {service} = setup();
    await screen.findByRole('group', {name: 'Students enrolled'});
    await user.selectOptions(screen.getByLabelText('Donor'), 'Donor B');
    await waitFor(() => {
      const last = vi.mocked(service.report).mock.calls.at(-1)![0];
      expect(last.centres).toEqual(['c2', 'c4', 'c6', 'c8', 'c10', 'c12']);
    });
    await user.selectOptions(screen.getByLabelText('Reporting month'), '2026-08');
    await waitFor(() => expect(vi.mocked(service.report).mock.calls.at(-1)![0].month).toBe('2026-08'));
  });

  it('shows a notice instead of data for a future month', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('group', {name: 'Students enrolled'});
    await user.selectOptions(screen.getByLabelText('Reporting month'), '2026-12');
    expect((await screen.findAllByText(/Future reporting periods/)).length).toBeGreaterThan(0);
    expect(screen.getByRole('group', {name: 'Girls'})).toHaveTextContent('—');
  });

  it('shows the shared error state with retry when the report fails, and recovers', async () => {
    const user = userEvent.setup();
    let fail = true;
    setup({service: {report: vi.fn(async () => { if (fail) throw new Error('Unable to reach the service. Check your connection and retry.'); return report; })}});
    await waitFor(() => expect(screen.getByRole('group', {name: 'Girls'})).toHaveTextContent('Unavailable'));
    expect(screen.getAllByText(/Unable to reach the service/).length).toBeGreaterThan(0);
    fail = false;
    await user.click(screen.getAllByRole('button', {name: 'Retry'})[0]);
    await waitFor(() => expect(screen.getByRole('group', {name: 'Girls'})).toHaveTextContent('802'));
  });

  it('explains when the backend lacks the reviewed reports', async () => {
    setup({capabilities: {reviewedCharts: false, reviewedAttendanceSeries: false}});
    expect(await screen.findByRole('alert')).toHaveTextContent('has not enabled the reviewed reports');
  });

  it('hides the donor filter for non-Leadership roles and offers shift, grade and gender instead', async () => {
    setup({role: 'Teacher', roles: ['Teacher']});
    await screen.findByRole('group', {name: 'Students enrolled'});
    expect(screen.queryByLabelText('Donor')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Shift')).toBeInTheDocument();
    expect(screen.getByLabelText('Grade')).toBeInTheDocument();
    expect(screen.getByLabelText('Gender')).toBeInTheDocument();
  });

  it('labels the Cluster Officer card as assigned centres', async () => {
    setup({role: 'Cluster Officer', roles: ['Cluster Officer']});
    expect(await screen.findByRole('group', {name: 'Centres assigned to you'})).toHaveTextContent('12');
  });

  it('has no automatically detectable accessibility violations', async () => {
    const {container} = setup({service: {report: vi.fn(async () => report)}});
    await waitFor(() => expect(screen.getByRole('group', {name: 'Girls'})).toHaveTextContent('802'));
    await screen.findByRole('img', {name: /Attendance by month/});
    expect(await violations(container)).toEqual([]);
  });

  it('uses the real service with a fake rpc and never makes per-centre calls', async () => {
    const rpc = vi.fn(async (name: string) => name === 'reviewed_attendance_series' ? [] : report);
    const backend = {rpc, readReferences: async () => refs, readCapabilities: async () => ({reviewedCharts: true, reviewedAttendanceSeries: true}), readDirectory: async () => []} as unknown as LiveBackend;
    render(<Overview backend={backend} context={context} role="Leadership" service={createOverviewService(rpc as never)} />);
    await waitFor(() => expect(screen.getByRole('group', {name: 'Girls'})).toHaveTextContent('802'));
    await screen.findByRole('img', {name: /Students by shift/});
    expect(rpc.mock.calls.map(c => c[0])).not.toContain('programme_aggregate');
    expect(rpc.mock.calls.filter(c => c[0] === 'reviewed_chart_metrics')).toHaveLength(3);
  });
});
