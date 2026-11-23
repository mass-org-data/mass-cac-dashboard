import type {TableRequest, TableService} from '../tables/service';

type Sources = Record<string, unknown[] | ((context: Record<string, unknown>) => unknown[])>;

export function testTableService(sources: Sources = {}): TableService {
  return {
    async page<T>(source: string, centres: string[], context: Record<string, unknown>, request: TableRequest) {
      const configured = sources[source];
      let rows = (typeof configured === 'function' ? configured(context) : configured ?? []) as T[];
      rows = rows.filter(row => { const value = row as Record<string, unknown>; const id = value.centre_id ?? (source === 'annual_centres' || source === 'morarji_centres' ? value.id : undefined); return typeof id !== 'string' || centres.includes(id); });
      const query = request.query.toLocaleLowerCase();
      if (query) rows = rows.filter(row => Object.values(row as Record<string, unknown>).some(value => String(value ?? '').toLocaleLowerCase().includes(query)));
      const total = rows.length;
      return {rows: rows.slice(request.offset, request.offset + request.limit), total};
    },
  } as TableService;
}
