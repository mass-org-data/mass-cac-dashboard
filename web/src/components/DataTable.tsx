import {useId, useMemo, useState, type ReactNode} from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingFn,
  type SortingState,
} from '@tanstack/react-table';
import {ArrowDown, ArrowUp, ArrowUpDown, Download, Search} from 'lucide-react';
import {AsyncState, type LoadState} from './AsyncState';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {buildCsv, downloadCsv, type CsvValue} from '../lib/csv';
import {cn} from '../lib/utils';

/** The one page size for every table in the application. */
export const PAGE_SIZE = 10;

export interface Column<T> {
  id: string;
  header: string;
  /** Plain value used for sorting, searching and the CSV export. Unknown values are null. */
  value: (row: T) => string | number | null | undefined;
  /** Optional custom cell. Defaults to the plain value, or an em dash when unknown. */
  cell?: (row: T) => ReactNode;
  /** Right-align and sort numerically. */
  numeric?: boolean;
  /** Exclude from the search box (default: searchable). */
  searchable?: boolean;
  /** Set false for columns that cannot be sorted (the header is plain text). */
  sortable?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Accessible table name, also the title shown above the table. */
  caption: string;
  getRowId: (row: T) => string;
  /** Base name of the exported file, without extension. */
  exportName: string;
  state?: LoadState;
  errorMessage?: string;
  emptyMessage?: string;
  onRetry?: () => void;
  /** Page-numbered reference such as 1.13, shown before the title. */
  reference?: string;
  /** Server-side paging and sorting (for example the saved attendance register). The server returns one page; no search box. */
  server?: {note?: string; total: number; pageIndex: number; onPageChange: (pageIndex: number) => void; sort: {id: string; desc: boolean}; onSortChange: (columnId: string) => void};
}

const collator = new Intl.Collator('en', {numeric: true, sensitivity: 'base'});

// Text sorts alphabetically (numbers inside text sort naturally); numbers sort numerically; unknown always last.
const sortValues: SortingFn<unknown> = (a, b, columnId) => {
  const left = a.getValue(columnId) as string | number | null | undefined;
  const right = b.getValue(columnId) as string | number | null | undefined;
  const leftMissing = left === null || left === undefined || left === '';
  const rightMissing = right === null || right === undefined || right === '';
  if (leftMissing || rightMissing) return leftMissing === rightMissing ? 0 : leftMissing ? 1 : -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return collator.compare(String(left), String(right));
};

const asCsv = (value: string | number | null | undefined): CsvValue => (value === undefined ? null : value);

export function DataTable<T>({columns, data, caption, getRowId, exportName, state = 'ready', errorMessage, emptyMessage = 'No records.', onRetry, reference, server}: DataTableProps<T>) {
  const searchId = useId();
  const captionId = useId();
  const firstColumn = columns[0]?.id;
  // Default order: ascending alphabetical on the first column. Clicking a header sorts that column
  // ascending, then descending; sorting never goes "off", so the order is always explicit.
  const [sorting, setSorting] = useState<SortingState>(firstColumn ? [{id: firstColumn, desc: false}] : []);
  const [search, setSearch] = useState('');

  const defs = useMemo<ColumnDef<T>[]>(
    () => columns.map(column => ({
      id: column.id,
      header: column.header,
      // Unknown values are undefined so they sort last in both directions.
      accessorFn: row => { const value = column.value(row); return value === null || value === undefined || value === '' ? undefined : value; },
      sortingFn: sortValues as SortingFn<T>,
      enableSorting: column.sortable !== false,
      sortDescFirst: false, // every column starts ascending, including numeric ones
      sortUndefined: 'last' as const,
      cell: ({row}) => (column.cell ? column.cell(row.original) : (() => {
        const value = column.value(row.original);
        return value === null || value === undefined || value === '' ? '—' : String(value);
      })()),
      meta: {numeric: Boolean(column.numeric), searchable: column.searchable !== false, sortable: column.sortable !== false},
    })),
    [columns],
  );

  const table = useReactTable<T>({
    data,
    columns: defs,
    getRowId,
    state: server ? {sorting: [{id: server.sort.id, desc: server.sort.desc}], globalFilter: '', pagination: {pageIndex: server.pageIndex, pageSize: PAGE_SIZE}} : {sorting, globalFilter: search},
    manualSorting: Boolean(server), manualPagination: Boolean(server), manualFiltering: Boolean(server),
    pageCount: server ? Math.max(1, Math.ceil(server.total / PAGE_SIZE)) : undefined,
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    enableSortingRemoval: false,
    globalFilterFn: (row, _columnId, filter: string) => {
      const needle = String(filter).trim().toLowerCase();
      if (!needle) return true;
      return columns.some(column => column.searchable !== false && String(column.value(row.original) ?? '').toLowerCase().includes(needle));
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {pagination: {pageIndex: 0, pageSize: PAGE_SIZE}},
    autoResetPageIndex: true,
  });

  const filteredCount = server ? server.total : table.getFilteredRowModel().rows.length;
  const pageIndex = server ? server.pageIndex : table.getState().pagination.pageIndex;
  const pageCount = server ? Math.max(1, Math.ceil(server.total / PAGE_SIZE)) : table.getPageCount();
  const first = filteredCount === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const last = Math.min(filteredCount, (pageIndex + 1) * PAGE_SIZE);

  const exportCsv = () => {
    const rows = (server ? table.getRowModel() : table.getSortedRowModel()).rows.map(row => columns.map(column => asCsv(column.value(row.original))));
    downloadCsv(exportName, buildCsv(columns.map(column => column.header), rows));
  };

  const body = (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        {server ? <p className="text-sm text-muted">{server.note ?? 'Sorted and paged by the server, newest first by default.'}</p> : <div className="relative w-full max-w-sm">
          <label htmlFor={searchId} className="mb-1 block text-xs font-semibold text-muted">Search this table</label>
          <Search aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 size-4 text-muted" />
          <Input id={searchId} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Type to filter rows" className="pl-9" autoComplete="off" />
        </div>}
        <Button variant="outline" onClick={exportCsv} disabled={filteredCount === 0}><Download aria-hidden="true" className="size-4" />{server ? 'Export this page (CSV)' : 'Export CSV'}</Button>
      </div>
      <div className="max-h-[62vh] overflow-auto rounded-md border border-line">
        <table aria-labelledby={captionId} className="w-full border-collapse text-sm">
          <caption id={captionId} className="sr-only">{caption}</caption>
          <thead>
            {table.getHeaderGroups().map(group => (
              <tr key={group.id}>
                {group.headers.map(header => {
                  const sorted = header.column.getIsSorted();
                  const numeric = Boolean((header.column.columnDef.meta as {numeric?: boolean} | undefined)?.numeric);
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
                      className={cn('sticky top-0 z-10 border-b border-line bg-brand-soft px-3 py-2 text-left font-semibold text-ink', numeric && 'text-right')}
                    >
                      {(header.column.columnDef.meta as {sortable?: boolean} | undefined)?.sortable === false ? <span className="inline-flex min-h-11 items-center font-semibold">{flexRender(header.column.columnDef.header, header.getContext())}</span> : <button type="button" onClick={server ? () => server.onSortChange(header.column.id) : header.column.getToggleSortingHandler()} className={cn('inline-flex min-h-11 items-center gap-1 font-semibold', numeric && 'flex-row-reverse')}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === 'asc' ? <ArrowUp aria-hidden="true" className="size-4" /> : sorted === 'desc' ? <ArrowDown aria-hidden="true" className="size-4" /> : <ArrowUpDown aria-hidden="true" className="size-4 text-muted" />}
                        <span className="sr-only">{sorted === 'asc' ? ', sorted ascending. Activate to sort descending' : sorted === 'desc' ? ', sorted descending. Activate to sort ascending' : ', activate to sort ascending'}</span>
                      </button>}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="odd:bg-white even:bg-paper">
                {row.getVisibleCells().map(cell => {
                  const numeric = Boolean((cell.column.columnDef.meta as {numeric?: boolean} | undefined)?.numeric);
                  return <td key={cell.id} className={cn('border-b border-line px-3 py-2', numeric && 'text-right tabular-nums')}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {filteredCount === 0 ? <p role="note" className="p-4 text-sm text-muted">No rows match “{search}”.</p> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p role="status" aria-live="polite">{filteredCount === 0 ? '0 rows' : `Showing ${first}–${last} of ${filteredCount}`}</p>
        {pageCount > 1 ? (
          <nav aria-label={`${caption} pages`} className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => server ? server.onPageChange(pageIndex - 1) : table.previousPage()} disabled={server ? pageIndex <= 0 : !table.getCanPreviousPage()} aria-label="Previous page">Previous</Button>
            <span aria-current="page">Page {pageIndex + 1} of {pageCount}</span>
            <Button variant="outline" size="sm" onClick={() => server ? server.onPageChange(pageIndex + 1) : table.nextPage()} disabled={server ? pageIndex + 1 >= pageCount : !table.getCanNextPage()} aria-label="Next page">Next</Button>
          </nav>
        ) : null}
      </div>
    </>
  );

  return (
    <section aria-labelledby={`${captionId}-title`} className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <h2 id={`${captionId}-title`} className="mb-3 text-lg font-semibold text-ink">{reference ? <span className="mr-1 text-xs font-bold text-brand-dark">{reference}</span> : null}{caption}</h2>
      <AsyncState state={state === 'ready' && data.length === 0 ? 'empty' : state} errorMessage={errorMessage} emptyMessage={emptyMessage} onRetry={onRetry}>{body}</AsyncState>
    </section>
  );
}
