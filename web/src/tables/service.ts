import type {Rpc} from '../session/backend';

export interface TableRequest {offset: number; limit: number; sort: string; reverse: boolean; query: string}
export interface TablePage<T> {rows: T[]; total: number}

export function createTableService(rpc: Rpc) {
  return {
    async page<T>(source: string, centres: string[], context: Record<string, unknown>, request: TableRequest): Promise<TablePage<T>> {
      if (!centres.length) return {rows: [], total: 0};
      const value = await rpc<TablePage<T>>('dashboard_table_page', {
        p_source: source, p_centres: centres, p_context: context, p_query: request.query,
        p_sort: request.sort, p_reverse: request.reverse, p_offset: request.offset, p_limit: request.limit,
      });
      if (!value || !Array.isArray(value.rows) || !Number.isFinite(Number(value.total))) throw new Error('Unexpected table response.');
      return {rows: value.rows, total: Number(value.total)};
    },
  };
}
export type TableService = ReturnType<typeof createTableService>;
