// Attendance data service for the new interface. Same server functions as the current register:
// attendance_register_page (10 saved rows per page, newest first), attendance_present_distribution,
// read_attendance_register_v3, save_classroom_register, save_centre_holiday and delete_attendance_register_v3.
// The server enforces scope, versions, request tokens and audit; nothing here weakens them.
import type {Rpc} from '../session/backend';

export interface RegisterCapabilities {
  version: number; enabled: boolean; session_entry?: boolean; register_paging?: boolean; present_distribution?: boolean; holiday_code?: boolean; register_timestamps?: boolean;
}
export interface Filters {month: string; centres: string[]; shift: string | null; grade: string | null; gender: string | null}
export interface RegisterRow {
  centre_id: string; shift_code: string; attendance_date: string; session_type?: string; present: number; total: number | null; eligible: number; recorded?: number; percentage: number | string | null;
  created_by?: string | null; last_edited_by?: string | null; last_edited_at?: string | null;
}
export interface RegisterPage {rows: RegisterRow[]; total: number}
export type SortKey = 'centre' | 'shift' | 'date' | 'present' | 'percentage';
export interface PageRequest {offset: number; sort: SortKey; reverse: boolean}
export interface Distribution {days: Array<{days: number; students: number}>; recorded_students?: number}
export interface RosterStudent {id: string; name: string | null; grade: string; student_id?: string}
export interface RegisterRead {roster: RosterStudent[]; marks: Array<{enrolment: string; code: string; version?: number}>; token: string; marks_token?: string; recorded: number; notes?: string}

export const PAGE_SIZE = 10;
/** The new interface supports the current register API (version 3 or later with paging and classroom sessions). */
export const isSupported = (c: RegisterCapabilities | null): c is RegisterCapabilities => Boolean(c && c.version >= 3 && c.register_paging && c.session_entry);

const monthEnd = (month: string) => { const d = new Date(`${month}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); };
const scope = (f: Filters) => ({p_centres: f.centres, p_from: `${f.month}-01`, p_until: monthEnd(f.month), p_shift: f.shift, p_grade: f.grade, p_gender: f.gender});

export function createAttendanceService(rpc: Rpc) {
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
      const value = await rpc<RegisterPage | RegisterRow[]>('attendance_register_page', {...scope(filters), p_offset: page.offset, p_sort: page.sort, p_reverse: page.reverse});
      return Array.isArray(value) ? {rows: value, total: value.length} : value;
    },
    async distribution(filters: Filters): Promise<Distribution> {
      if (!filters.centres.length) return {days: [], recorded_students: 0};
      return rpc<Distribution>('attendance_present_distribution', scope(filters));
    },
    readRegister: (centre: string, shift: string, date: string) => rpc<RegisterRead>('read_attendance_register_v3', {p_centre: centre, p_shift: shift, p_date: date}),
    saveClassroom: (args: Record<string, unknown>) => rpc<unknown>('save_classroom_register', args),
    saveHoliday: (args: Record<string, unknown>) => rpc<unknown>('save_centre_holiday', args),
    deleteRegister: (args: Record<string, unknown>) => rpc<unknown>('delete_attendance_register_v3', args),
  };
}
export type AttendanceService = ReturnType<typeof createAttendanceService>;
