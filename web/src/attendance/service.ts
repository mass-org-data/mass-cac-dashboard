// Attendance data service for the new interface. Same server functions as the current register:
// attendance_register_page (10 saved rows per page, newest first), attendance_present_distribution,
// read_attendance_register_v3, save_classroom_register, save_centre_holiday and delete_attendance_register_v3.
// The server enforces scope, versions, request tokens and audit; nothing here weakens them.
import type {Rpc} from '../session/backend';

export interface RegisterCapabilities {
  version: number; enabled: boolean; session_entry?: boolean; student_sessions?: boolean; register_paging?: boolean; present_distribution?: boolean; holiday_code?: boolean; register_timestamps?: boolean; all_session_registers?: boolean; session_conversion?: boolean;
}
export interface Filters {month: string; centres: string[]; shift: string | null; grade: string | null; gender: string | null}
export interface RegisterRow {
  centre_id: string; shift_code: string; attendance_date: string; session_type?: string; session_subtype?: string | null; present: number; total: number | null; eligible: number; recorded?: number; percentage: number | string | null;
  created_by?: string | null; last_edited_by?: string | null; last_edited_at?: string | null;
}
export interface RegisterPage {rows: RegisterRow[]; total: number}
export type SortKey = 'centre' | 'shift' | 'date' | 'session' | 'present' | 'percentage' | 'last_edited_at';
export interface PageRequest {offset: number; sort: SortKey; reverse: boolean; limit?: number; query?: string}
export interface Distribution {days: Array<{days: number; students: number}>; recorded_students?: number}
export interface RosterStudent {id: string; name: string | null; grade: string; student_id?: string}
export interface RegisterRead {roster: RosterStudent[]; marks: Array<{id?: string; enrolment: string; code: string; version?: number}>; token: string; marks_token?: string; recorded: number; notes?: string}

export const PAGE_SIZE = 10;
/** The new interface supports the current register API (version 3 or later with paging and classroom sessions). */
export const isSupported = (c: RegisterCapabilities | null): c is RegisterCapabilities => Boolean(c && c.version >= 3 && c.register_paging && c.session_entry);

const monthEnd = (month: string) => { const d = new Date(`${month}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); };
const scope = (f: Filters) => ({p_centres: f.centres, p_from: `${f.month}-01`, p_until: monthEnd(f.month), p_shift: f.shift, p_grade: f.grade, p_gender: f.gender});

export function createAttendanceService(rpc: Rpc) {
  let pageVersion = 3;
  return {
    async capabilities(): Promise<RegisterCapabilities> {
      try { return await rpc<RegisterCapabilities>('get_attendance_register_capabilities'); }
      catch (error) {
        const e = error as {status?: number; code?: string};
        if (e.status === 404 && e.code === 'PGRST202') return {version: 0, enabled: false};
        throw error;
      }
    },
    async page(filters: Filters, page: PageRequest): Promise<RegisterPage> {
      if (!filters.centres.length) return {rows: [], total: 0};
      if (pageVersion === 3) {
        try {
          return await rpc<RegisterPage>('attendance_register_page_v3', {...scope(filters), p_offset: page.offset, p_limit: page.limit ?? PAGE_SIZE, p_sort: page.sort, p_reverse: page.reverse, p_query: page.query ?? ''});
        } catch (error) {
          const e = error as {status?: number; code?: string};
          if (!(e.status === 404 && e.code === 'PGRST202')) throw error;
          pageVersion = 2;
        }
      }
      if (pageVersion === 2) {
        try {
          return await rpc<RegisterPage>('attendance_register_page_v2', {...scope(filters), p_offset: page.offset, p_limit: page.limit ?? PAGE_SIZE, p_sort: page.sort === 'session' ? 'date' : page.sort, p_reverse: page.reverse, p_query: page.query ?? ''});
        } catch (error) {
          const e = error as {status?: number; code?: string};
          if (!(e.status === 404 && e.code === 'PGRST202')) throw error;
          pageVersion = 1;
        }
      }
      const sort = page.sort === 'last_edited_at' || page.sort === 'session' ? 'date' : page.sort;
      const legacyReverse = sort === 'date' ? !page.reverse : page.reverse;
      const value = await rpc<RegisterPage | RegisterRow[]>('attendance_register_page', {...scope(filters), p_offset: page.offset, p_sort: sort, p_reverse: legacyReverse});
      return Array.isArray(value) ? {rows: value, total: value.length} : value;
    },
    async distribution(filters: Filters): Promise<Distribution> {
      if (!filters.centres.length) return {days: [], recorded_students: 0};
      return rpc<Distribution>('attendance_present_distribution', scope(filters));
    },
    readRegister: (centre: string, shift: string, date: string) => rpc<RegisterRead>('read_attendance_register_v3', {p_centre: centre, p_shift: shift, p_date: date}),
    readStudentSession: (centre: string, shift: string, date: string, type: string, subtype: string | null) => rpc<RegisterRead>('read_student_session_register', {p_centre: centre, p_shift: shift, p_date: date, p_type: type, p_subtype: subtype}),
    saveClassroom: (args: Record<string, unknown>) => rpc<unknown>('save_classroom_register', args),
    saveHoliday: (args: Record<string, unknown>) => rpc<unknown>('save_centre_holiday', args),
    saveStudentSession: (args: Record<string, unknown>) => rpc<unknown>('save_student_session_register', args),
    convertSession: (args: Record<string, unknown>) => rpc<unknown>('convert_attendance_session_register', args),
    deleteRegister: (args: Record<string, unknown>) => rpc<unknown>('delete_attendance_register_v3', args),
    deleteRecord: (request: string, record: string, expected: number, reason: string) => rpc<unknown>('delete_attendance_record', {p_request: request, p_record: record, p_expected: expected, p_reason: reason.trim()}),
  };
}
export type AttendanceService = ReturnType<typeof createAttendanceService>;
