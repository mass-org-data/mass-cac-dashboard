// Pure rules of the attendance register editor, ported from the current interface
// (src/live/attendance-register.js) so behaviour is identical and testable without a browser:
// marks stay drafts until an explicit save; every eligible student must be Present or Absent;
// corrections and deletions need a reason; deletion needs a confirmation; the request id is kept for
// retries of the same save (idempotency) and renewed only when the register is loaded again.
import {changedAttendance} from '../../../src/live/attendance-register.js';
import type {RegisterCapabilities, RegisterRead, RosterStudent} from './service';

export type Code = 'P' | 'A';
export const CODES: Code[] = ['P', 'A'];
export type SessionType = 'Classroom' | 'Holiday' | 'Monthly Meeting' | 'Activity Day';
export type ActivitySubtype = 'Cultural Activity 1' | 'Cultural Activity 2' | 'Sports Activity 1' | 'Sports Activity 2';
export const ACTIVITY_SUBTYPES: ActivitySubtype[] = ['Cultural Activity 1', 'Cultural Activity 2', 'Sports Activity 1', 'Sports Activity 2'];

export interface EditorState {
  centre: string; shift: string; date: string; sessionType: SessionType; activitySubtype: ActivitySubtype;
  roster: RosterStudent[]; saved: Record<string, string>; draft: Record<string, string>;
  savedRecords: Record<string, {id: string; version: number}>;
  notes: string; savedNotes: string; token: string; recorded: number; loaded: boolean;
  request: string; deleting: boolean; reason: string; confirmDelete: boolean;
}

export const newRequest = () => globalThis.crypto.randomUUID();

export function initialEditor(selection: {centre: string; shift: string; date: string}): EditorState {
  return {...selection, sessionType: 'Classroom', activitySubtype: ACTIVITY_SUBTYPES[0], roster: [], saved: {}, draft: {}, savedRecords: {}, notes: '', savedNotes: '', token: '', recorded: 0, loaded: false, request: newRequest(), deleting: false, reason: '', confirmDelete: false};
}

/** Result of reading the server's register for the selected centre, shift and date. */
export function applyRead(state: EditorState, read: RegisterRead): EditorState {
  const saved = Object.fromEntries(read.marks.map(mark => [mark.enrolment, mark.code]));
  const savedRecords = Object.fromEntries(read.marks.filter(mark => mark.id && mark.version != null).map(mark => [mark.enrolment, {id: mark.id!, version: mark.version!}]));
  return {...state, roster: read.roster, saved, draft: {...saved}, savedRecords, notes: read.notes ?? '', savedNotes: read.notes ?? '', token: read.token, recorded: read.recorded, loaded: true, request: newRequest(), deleting: false, reason: '', confirmDelete: false};
}

export const changes = (state: EditorState) => changedAttendance(state.roster, state.saved, state.draft) as Array<{enrolment: string; code: string | null}>;
export const notesChanged = (state: EditorState, caps: RegisterCapabilities) => caps.version >= 3 && state.notes !== state.savedNotes;
export const isDirty = (state: EditorState, caps: RegisterCapabilities) => state.loaded && (changes(state).length > 0 || notesChanged(state, caps));
export const unmarked = (state: EditorState) => state.roster.filter(student => !CODES.includes(state.draft[student.id] as Code));
export const markedCount = (state: EditorState) => Object.values(state.draft).filter(Boolean).length;
export const isStudentSession = (type: SessionType) => type === 'Monthly Meeting' || type === 'Activity Day';

/** Can the Save button be used? Holidays need no roster; classroom sessions need every student marked. */
export function canSubmit(state: EditorState): boolean {
  if (!state.loaded) return false;
  if (state.sessionType === 'Holiday') return true;
  if (state.deleting) return true;
  return state.roster.length > 0 && unmarked(state).length === 0;
}

/** The first rule the save breaks, in the same order and wording as the current interface; null when valid. */
export function validate(state: EditorState, caps: RegisterCapabilities): string | null {
  if (!state.loaded) return 'Wait for the selected roster to load.';
  if (state.sessionType === 'Holiday') return null;
  if (!state.deleting && (!state.roster.length || unmarked(state).length > 0)) return 'Mark every eligible student Present or Absent.';
  const rows = changes(state);
  const correcting = rows.some(row => state.saved[row.enrolment]);
  if ((state.deleting || correcting) && !state.reason.trim()) return 'Enter a reason for this correction or deletion.';
  if (state.deleting && !state.confirmDelete) return 'Tick the confirmation to delete this entire centre, shift and date register.';
  const notes = notesChanged(state, caps);
  if (!state.deleting && !rows.length && !notes) return 'No attendance changes selected.';
  if (notes && state.recorded && !state.reason.trim()) return 'Enter a reason for updating saved notes.';
  return null;
}

export type SavePlan =
  | {kind: 'holiday'; args: Record<string, unknown>}
  | {kind: 'delete'; args: Record<string, unknown>}
  | {kind: 'studentSession'; args: Record<string, unknown>}
  | {kind: 'classroom'; args: Record<string, unknown>};

export function buildSave(state: EditorState, caps: RegisterCapabilities): SavePlan {
  if (state.sessionType === 'Holiday') {
    return {kind: 'holiday', args: {p_request: state.request, p_centre: state.centre, p_shift: state.shift, p_date: state.date, p_reason: state.notes.trim() || 'Holiday'}};
  }
  if (isStudentSession(state.sessionType)) {
    return {kind: 'studentSession', args: {
      p_request: state.request, p_centre: state.centre, p_shift: state.shift, p_date: state.date,
      p_type: state.sessionType, p_subtype: state.sessionType === 'Activity Day' ? state.activitySubtype : null,
      p_token: state.token,
      p_rows: state.roster.map(student => ({enrolment: student.id, code: state.draft[student.id]})),
      p_reason: state.reason.trim() || state.notes.trim() || `${state.sessionType} attendance entered`,
    }};
  }
  const args: Record<string, unknown> = {p_request: state.request, p_centre: state.centre, p_shift: state.shift, p_date: state.date, p_token: state.token, p_reason: state.reason.trim() || 'Attendance entered'};
  if (state.deleting) return {kind: 'delete', args};
  // The full roster is sent, so the server compares every mark against the token it issued.
  args.p_rows = caps.session_entry ? state.roster.map(student => ({enrolment: student.id, code: state.draft[student.id]})) : changes(state);
  if (caps.version >= 3) args.p_notes = state.notes;
  return {kind: 'classroom', args};
}
