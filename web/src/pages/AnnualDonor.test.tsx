import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {AnnualDonor} from './AnnualDonor';
import type {OverviewService, Report, Selection} from '../data/overview';
import type {LiveBackend} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';
import {violations} from '../test/axe';

vi.mock('../lib/dates', async importOriginal => ({...(await importOriginal<typeof import('../lib/dates')>()), todayIst: () => '2026-09-14'}));

const ctx = (roles: string[]): ProgrammeContext => ({user_id: 'u1', operational_roles_enabled: true, centres: [{id: 'c1', label: 'Centre 01', roles, can_write: false}, {id: 'c2', label: 'Centre 02', roles, can_write: false}]}) as unknown as ProgrammeContext;
const refs = {academic_years: [{id: 'y1', starts_on: '2026-04-01', ends_before: '2027-04-01'}, {id: 'y0', starts_on: '2025-04-01', ends_before: '2026-04-01'}], assessment_periods: [], assessment_definitions: []};
const att = (p: number, a: number, l = 0) => ({p, a, l, excluded: 0, percentage: p + a + l ? 100 * p / (p + a + l) : null});
const month = (n: number): Report => ({children: 30, grades: {}, genders: {}, attendance: att(100 * n, 10 * n), quarters: [], centres: [{id: 'c1', children: 18, attendance: att(60 * n, 5 * n), quarters: []}, {id: 'c2', children: 12, attendance: att(40 * n, 5 * n), quarters: []}]});
const byMonth: Record<string, Report> = {'2026-04': month(1), '2026-05': month(2), '2026-06': month(3), '2026-07': month(4), '2026-08': month(5), '2026-09': month(6)};

function setup(options: {role?: string; failMonth?: string; failAll?: boolean; failOnce?: string} = {}) {
  const seen = new Set<string>();
  const report = vi.fn(async (selection: Selection) => {
    if (options.failOnce === selection.month && !seen.has(selection.month)) { seen.add(selection.month); throw new Error('statement timeout'); }
    if (options.failAll || selection.month === options.failMonth) throw new Error('statement timeout');
    return byMonth[selection.month]!;
  });
  const overview = {report, shifts: vi.fn(), series: vi.fn(), clear: vi.fn()} as unknown as OverviewService;
  const backend = {rpc: vi.fn(), readReferences: vi.fn(async () => refs), readCapabilities: vi.fn(async () => ({reviewedCharts: true, reviewedAttendanceSeries: true, writes: {}})), readDirectory: vi.fn(async () => [{centre_id: 'c1', donor_label: 'Donor A'}, {centre_id: 'c2', donor_label: 'Donor B'}])} as unknown as LiveBackend;
  const role = options.role ?? 'Leadership';
  const view = render(<AnnualDonor backend={backend} context={ctx([role])} role={role} overview={overview} />);
  return {report, ...view};
}
const comparison = async () => screen.findByRole('table', {name: 'Centre comparison'});

describe('Annual donor summary', () => {
  it('adds P, A and L over the loaded months before dividing, not an average of monthly percentages', async () => {
    setup();
    const table = await comparison();
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(3));
    // Centre 01: P = 60*(1+..+6) = 1260, A = 5*21 = 105, annual % = 1260 / 1365 = 92.3
    const row = within(table).getByText('Centre 01').closest('tr')!;
    expect(within(row).getByText('1260')).toBeInTheDocument();
    expect(within(row).getByText('92.3%')).toBeInTheDocument();
    expect(within(row).getByText('6')).toBeInTheDocument();       // six loaded months so far
    expect(within(row).getByText('Donor A')).toBeInTheDocument();
  });
  it('loads one report per elapsed month of the selected year and no future month', async () => {
    const {report} = setup();
    await comparison();
    await waitFor(() => expect(report).toHaveBeenCalledTimes(6));
    expect(report.mock.calls.map(c => c[0].month).sort()).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  });
  it('shows annual scorecards and the cover with the exclusive end date', async () => {
    setup();
    await comparison();
    expect(await screen.findByText('2026-04-01 to 2027-04-01 (exclusive)', {exact: false})).toBeInTheDocument();
    expect(screen.getByText(/across 6 loaded months/)).toBeInTheDocument();
    expect(screen.getAllByText('90.9%').length).toBeGreaterThan(0);  // 2100 / (2100 + 210)
  });
  it('treats a failed month as a gap, says so, and still reports the others', async () => {
    setup({failMonth: '2026-07'});
    await comparison();
    expect(await screen.findByText(/1 of 6 monthly reports could not be loaded/)).toBeInTheDocument();
    expect(screen.getByText(/across 5 loaded months/)).toBeInTheDocument();
  });
  it('retries a month once on a transient failure, so no month is lost', async () => {
    const {report} = setup({failOnce: '2026-07'});
    await comparison();
    await screen.findByText(/across 6 loaded months/);
    expect(screen.queryByText(/monthly reports could not be loaded/)).not.toBeInTheDocument();
    expect(report.mock.calls.filter(c => c[0].month === '2026-07')).toHaveLength(2);
  });
  it('shows an error with retry when every month fails', async () => {
    setup({failAll: true});
    expect((await screen.findAllByText(/statement timeout/)).length).toBeGreaterThan(0);
  });
  it('filters by donor and asks again with only that donor centre', async () => {
    const user = userEvent.setup();
    const {report} = setup();
    await comparison();
    await user.selectOptions(screen.getByLabelText('Donor'), 'Donor B');
    await waitFor(() => expect(report.mock.calls.at(-1)![0].centres).toEqual(['c2']));
    const table = await comparison();
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2));
    expect(within(table).queryByText('Centre 01')).not.toBeInTheDocument();
  });
  it('explains the export and keeps unknown separate from zero', async () => {
    setup();
    await comparison();
    expect(screen.getByText(/It does not average monthly percentages|it does not average monthly percentages/i)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Export CSV/})).toBeInTheDocument();
  });
  it('is Leadership only', async () => {
    const {report} = setup({role: 'Teacher'});
    expect(await screen.findByRole('note')).toHaveTextContent(/part of Leadership reporting/);
    expect(report).not.toHaveBeenCalled();
  });
  it('has no automatic accessibility violations', async () => {
    const {container} = setup();
    await comparison();
    await screen.findByText(/across 6 loaded months/);
    expect(await violations(container)).toEqual([]);
  });
});
