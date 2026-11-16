import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi, beforeEach} from 'vitest';
import {DataTable, PAGE_SIZE, type Column} from './DataTable';
import {violations} from '../test/axe';
import * as csv from '../lib/csv';

interface Row {id: string; centre: string; students: number | null; donor: string | null}
const columns: Column<Row>[] = [
  {id: 'centre', header: 'Centre', value: r => r.centre},
  {id: 'students', header: 'Students', value: r => r.students, numeric: true},
  {id: 'donor', header: 'Donor', value: r => r.donor},
];
const make = (n: number): Row[] => Array.from({length: n}, (_, i) => ({id: `c${i}`, centre: `Centre ${String(n - i).padStart(2, '0')}`, students: i % 7 === 0 ? null : (i * 13) % 50, donor: i % 3 === 0 ? 'Donor A' : i % 3 === 1 ? 'Donor B' : null}));
const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
const firstColumn = () => bodyRows().map(r => within(r).getAllByRole('cell')[0].textContent);

function renderTable(data: Row[], props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) {
  return render(<DataTable<Row> caption="Centres" columns={columns} data={data} getRowId={r => r.id} exportName="centres" {...props} />);
}

describe('DataTable', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sorts ascending and alphabetically on the first column by default', () => {
    renderTable(make(12));
    const names = firstColumn();
    expect(names).toEqual([...names].sort((a, b) => a!.localeCompare(b!, 'en', {numeric: true})));
    expect(screen.getByRole('columnheader', {name: /Centre/})).toHaveAttribute('aria-sort', 'ascending');
  });

  it('shows ten rows per page and pages beyond ten', async () => {
    const user = userEvent.setup();
    renderTable(make(23));
    expect(bodyRows()).toHaveLength(PAGE_SIZE);
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–10 of 23');
    await user.click(screen.getByRole('button', {name: 'Next page'}));
    expect(bodyRows()).toHaveLength(PAGE_SIZE);
    expect(screen.getByRole('status')).toHaveTextContent('Showing 11–20 of 23');
    await user.click(screen.getByRole('button', {name: 'Next page'}));
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByRole('button', {name: 'Next page'})).toBeDisabled();
    await user.click(screen.getByRole('button', {name: 'Previous page'}));
    expect(screen.getByRole('status')).toHaveTextContent('Showing 11–20 of 23');
  });

  it('shows no pagination controls for ten rows or fewer', () => {
    renderTable(make(10));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–10 of 10');
  });

  it('sorts by clicking a header: ascending, then descending, never off', async () => {
    const user = userEvent.setup();
    renderTable(make(8));
    const header = () => screen.getByRole('columnheader', {name: /Students/});
    await user.click(within(header()).getByRole('button'));
    expect(header()).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('columnheader', {name: /Centre/})).toHaveAttribute('aria-sort', 'none');
    await user.click(within(header()).getByRole('button'));
    expect(header()).toHaveAttribute('aria-sort', 'descending');
    await user.click(within(header()).getByRole('button'));
    expect(header()).toHaveAttribute('aria-sort', 'ascending');
  });

  it('sorts numbers numerically and keeps unknown values last in both directions', async () => {
    const user = userEvent.setup();
    renderTable([{id: 'a', centre: 'A', students: 100, donor: null}, {id: 'b', centre: 'B', students: 9, donor: null}, {id: 'c', centre: 'C', students: null, donor: null}, {id: 'd', centre: 'D', students: 25, donor: null}]);
    const studentsColumn = () => bodyRows().map(r => within(r).getAllByRole('cell')[1].textContent);
    await user.click(within(screen.getByRole('columnheader', {name: /Students/})).getByRole('button'));
    expect(studentsColumn()).toEqual(['9', '25', '100', '—']);
    await user.click(within(screen.getByRole('columnheader', {name: /Students/})).getByRole('button'));
    expect(studentsColumn()).toEqual(['100', '25', '9', '—']);
  });

  it('searches every searchable column and goes back to page one', async () => {
    const user = userEvent.setup();
    renderTable(make(40));
    await user.click(screen.getByRole('button', {name: 'Next page'}));
    await user.type(screen.getByRole('searchbox', {name: 'Search this table'}), 'donor b');
    expect(screen.getByRole('status')).toHaveTextContent(/^Showing 1–10 of \d+$/);
    for (const row of bodyRows()) expect(within(row).getAllByRole('cell')[2]).toHaveTextContent('Donor B');
    await user.clear(screen.getByRole('searchbox', {name: 'Search this table'}));
    await user.type(screen.getByRole('searchbox', {name: 'Search this table'}), 'no such thing');
    expect(screen.getByText(/No rows match/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Export CSV/})).toBeDisabled();
  });

  it('exports the filtered, sorted rows with the production CSV escaping', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(csv, 'downloadCsv').mockImplementation(() => undefined);
    renderTable([{id: 'a', centre: '=HYPERLINK("x")', students: 3, donor: 'Beta'}, {id: 'b', centre: 'Alpha', students: null, donor: 'Alpha, Inc'}]);
    await user.click(screen.getByRole('button', {name: /Export CSV/}));
    expect(spy).toHaveBeenCalledOnce();
    const [name, text] = spy.mock.calls[0];
    expect(name).toBe('centres');
    const lines = text.split('\r\n');
    expect(lines[0]).toBe('"Centre","Students","Donor"');
    expect(lines.slice(1).sort()).toEqual(['"\'=HYPERLINK(""x"")","3","Beta"', '"Alpha","","Alpha, Inc"'].sort());
  });

  it('exports every page, not only the visible one', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(csv, 'downloadCsv').mockImplementation(() => undefined);
    renderTable(make(23));
    await user.click(screen.getByRole('button', {name: /Export CSV/}));
    expect(spy.mock.calls[0][1].split('\r\n')).toHaveLength(24);
  });

  it('offers no column reordering or column visibility controls', () => {
    renderTable(make(12));
    expect(screen.queryByRole('button', {name: /columns?|reorder|show|hide|toggle|drag/i})).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    for (const header of screen.getAllByRole('columnheader')) expect(header).not.toHaveAttribute('draggable');
  });

  it('shows the shared loading, error (with retry) and empty states', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const {rerender} = renderTable([], {state: 'loading'});
    expect(screen.getByRole('status', {name: ''})).toHaveAttribute('aria-busy', 'true');
    rerender(<DataTable<Row> caption="Centres" columns={columns} data={[]} getRowId={r => r.id} exportName="centres" state="error" errorMessage="Could not load." onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load.');
    await user.click(screen.getByRole('button', {name: 'Retry'}));
    expect(retry).toHaveBeenCalledOnce();
    rerender(<DataTable<Row> caption="Centres" columns={columns} data={[]} getRowId={r => r.id} exportName="centres" emptyMessage="Nothing here." />);
    expect(screen.getByRole('note')).toHaveTextContent('Nothing here.');
  });

  it('has no automatically detectable accessibility violations', async () => {
    const {container} = renderTable(make(25));
    expect(await violations(container)).toEqual([]);
  });
});
