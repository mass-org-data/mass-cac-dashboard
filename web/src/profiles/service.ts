// Student profile data service for the new interface. Same server functions as the current Profiles page:
// student_profile_page_v2 (ten enrolment ids per page, sorted and filtered on the server for the active
// operational role's centres), read_students (details for those centres), student_academic_history,
// read_profile_revision and the protected writes register_student_once, save_student_profile_year and
// correct_profile. The server enforces scope, versions, activation gates and audit; nothing here weakens them.
import {createLimiter} from '../../../src/live/limiter.js';
import {CACHE_TTL_MS, memoise, type Rpc} from '../session/backend';

export interface ProfileCapabilities {version: number; profile_pages?: boolean; profile_sort_v2?: boolean; academic_history?: boolean}
export type ProfileSort = 'name' | 'id' | 'centre' | 'grade' | 'gender' | 'shift' | 'newest';
export interface ProfileFilters {centres: string[]; query: string; idQuery: string; grade: string | null; shift: string | null; gender: string | null}
export interface ProfilePageRequest {offset: number; sort: ProfileSort; reverse: boolean}
export interface ProfileIds {ids: string[]; total: number}

export interface StudentRow {
  enrolment: string; child: string; studentId: string; name: string | null; centre: string; grade: string; shift: string;
  gender: string | null; enrolled: string; status: string; board: boolean | null; version: number;
}
interface ReadStudent {
  child_id: string; student_id: string; enrolment_id: string; grade_label: string; shift_code: string; starts_on: string;
  status_code: string; row_version: number; full_name: string | null; gender_code: string | null; class10_board_passed: boolean | null;
}
export interface AcademicYear {academic_year_id: string; enrolment_id: string; label: string; grade: string; status: string | null; version: number; editable: boolean}

export const PROFILE_PAGE_SIZE = 10;
export const isProfileSupported = (c: ProfileCapabilities | null): c is ProfileCapabilities => Boolean(c && c.profile_pages && c.profile_sort_v2);

export interface NewStudent {request: string; centre: string; grade: string; shift: string; start: string; name: string; gender: string | null}
export interface ProfileEdit {child: string; enrolment: string; revision: number; name: string; gender: string | null; board: boolean | null; year?: {id: string; status: string; version: number}}

export function createProfilesService(rpc: Rpc, limit: (job: () => Promise<unknown>) => Promise<unknown> = createLimiter(6), now: () => number = Date.now) {
  // Rosters are kept for five minutes (and until a save calls clear()), then read again.
  const cache = new Map<string, {at: number; value: Promise<Map<string, StudentRow>>}>();
  async function readCentre(centre: string): Promise<Map<string, StudentRow>> {
    const rows = new Map<string, StudentRow>();
    for (let page = 0; page < 100; page++) {
      const batch = await rpc<ReadStudent[]>('read_students', {p_centre: centre, p_on: null, p_limit: 100, p_offset: page * 100});
      if (!Array.isArray(batch)) throw new Error('Unexpected programme response.');
      for (const s of batch) rows.set(s.enrolment_id, {enrolment: s.enrolment_id, child: s.child_id, studentId: s.student_id, name: s.full_name, centre, grade: s.grade_label, shift: s.shift_code, gender: s.gender_code, enrolled: s.starts_on, status: s.status_code, board: s.class10_board_passed, version: s.row_version});
      if (batch.length < 100) return rows;
    }
    throw new Error('This centre contains too many records.');
  }
  return {
    async capabilities(): Promise<ProfileCapabilities> {
      try { return await rpc<ProfileCapabilities>('get_attendance_register_capabilities'); }
      catch (error) {
        const e = error as {status?: number; code?: string};
        if (e.status === 404 && e.code === 'PGRST202') return {version: 0};
        throw error;
      }
    },
    async page(filters: ProfileFilters, page: ProfilePageRequest, on: string): Promise<ProfileIds> {
      if (!filters.centres.length) return {ids: [], total: 0};
      return rpc<ProfileIds>('student_profile_page_v2', {
        p_centres: filters.centres, p_on: on, p_query: filters.query, p_id_query: filters.idQuery, p_sort: page.sort, p_reverse: page.reverse,
        p_grade: filters.grade, p_shift: filters.shift, p_gender: filters.gender, p_offset: page.offset, p_limit: PROFILE_PAGE_SIZE,
      });
    },
    /** Details for the ids on one page. Each centre is read once and kept until `clear()`. */
    async students(centres: string[], ids: string[]): Promise<StudentRow[]> {
      const maps = await Promise.all(centres.map(centre => {
        return memoise(cache, centre, () => limit(() => readCentre(centre)) as Promise<Map<string, StudentRow>>, now, CACHE_TTL_MS);
      }));
      return ids.map(id => maps.map(map => map.get(id)).find(Boolean)).filter((row): row is StudentRow => Boolean(row));
    },
    clear() { cache.clear(); },
    history: (child: string) => rpc<AcademicYear[]>('student_academic_history', {p_child: child}),
    revision: (child: string) => rpc<number>('read_profile_revision', {p_child: child}),
    register: (s: NewStudent) => rpc<unknown>('register_student_once', {p_request: s.request, p_centre: s.centre, p_grade: s.grade, p_shift: s.shift, p_start: s.start, p_name: s.name.trim(), p_gender: s.gender}),
    saveProfile(edit: ProfileEdit) {
      const base = {p_child: edit.child, p_name: edit.name.trim(), p_gender: edit.gender, p_board: edit.board};
      return edit.year
        ? rpc<unknown>('save_student_profile_year', {...base, p_enrolment: edit.enrolment, p_profile_expected: edit.revision, p_year: edit.year.id, p_status: edit.year.status, p_year_expected: edit.year.version})
        : rpc<unknown>('correct_profile', {...base, p_expected: edit.revision});
    },
  };
}
export type ProfilesService = ReturnType<typeof createProfilesService>;
