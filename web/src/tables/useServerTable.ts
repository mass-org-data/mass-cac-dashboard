import {useCallback, useEffect, useMemo, useState} from 'react';
import {PAGE_SIZE, type DataTableProps} from '../components/DataTable';
import type {TablePage, TableRequest} from './service';

type Slice<T> = {status: 'loading'} | {status: 'ready'; value: TablePage<T>} | {status: 'error'; message: string};
const messageOf = (error: unknown) => error instanceof Error && error.message ? error.message : 'This table could not be loaded.';

export function useServerTable<T>(options: {
  key: string;
  load: (request: TableRequest) => Promise<TablePage<T>>;
  initialSort: string;
  initialReverse?: boolean;
  refreshKey?: number;
  searchable?: boolean;
}) {
  const {key, load, initialSort, initialReverse = false, refreshKey = 0, searchable = true} = options;
  const [request, setRequest] = useState(() => ({offset: 0, sort: initialSort, reverse: initialReverse}));
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [result, setResult] = useState<Slice<T>>({status: 'loading'});
  const [busy, setBusy] = useState(false);

  useEffect(() => { const timer = window.setTimeout(() => setDebounced(query.trim()), 300); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => {
    setRequest({offset: 0, sort: initialSort, reverse: initialReverse});
    setQuery(''); setDebounced('');
  }, [key, initialSort, initialReverse]);
  useEffect(() => { setRequest(r => ({...r, offset: 0})); }, [debounced]);
  useEffect(() => {
    let live = true;
    setBusy(true);
    setResult(previous => previous.status === 'ready' ? previous : {status: 'loading'});
    load({...request, query: debounced, limit: PAGE_SIZE}).then(value => { if (live) { setResult({status: 'ready', value}); setBusy(false); } })
      .catch(error => { if (live) { setResult({status: 'error', message: messageOf(error)}); setBusy(false); } });
    return () => { live = false; };
  }, [load, request.offset, request.sort, request.reverse, debounced, refreshKey]);

  const exportRows = useCallback(async () => {
    const rows: T[] = [];
    for (let offset = 0; offset <= 1000000; offset += 500) {
      const page = await load({...request, query: debounced, offset, limit: 500});
      rows.push(...page.rows);
      if (rows.length >= page.total || page.rows.length < 500) return rows;
    }
    throw new Error('The export is too large. Narrow the filters and try again.');
  }, [load, request.sort, request.reverse, debounced]);

  const server = useMemo<DataTableProps<T>['server']>(() => result.status === 'ready' ? {
    note: 'Searched, sorted and paged by the server, ten rows per page.',
    total: result.value.total,
    pageIndex: request.offset / PAGE_SIZE,
    onPageChange: pageIndex => setRequest(r => ({...r, offset: pageIndex * PAGE_SIZE})),
    sort: {id: request.sort, desc: request.reverse},
    onSortChange: id => setRequest(r => r.sort === id ? {...r, offset: 0, reverse: !r.reverse} : {offset: 0, sort: id, reverse: false}),
    query: searchable ? query : undefined,
    onQueryChange: searchable ? setQuery : undefined,
    exportRows,
  } : undefined, [result, request, query, searchable, exportRows]);

  return {result, rows: result.status === 'ready' ? result.value.rows : [], busy, server, retry: () => setRequest(r => ({...r})), error: result.status === 'error' ? result.message : undefined};
}
