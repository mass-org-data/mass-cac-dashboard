// Pure rules of the student forms, ported from the current interface (src/live/original-actions.js) so behaviour
// is identical: a verified name is required; a new student needs an observed start date (not in the future) and
// shift; the one-time request id keeps a retried registration from creating a duplicate student.
import type {AcademicYear, NewStudent} from './service';

export const STATUSES = ['Active', 'Graduated', 'Dropped Out'] as const;
export const newRequest = () => globalThis.crypto.randomUUID();

export interface NewStudentForm {name: string; centre: string; grade: string; shift: string; start: string; gender: string}
export const emptyStudent = (centre: string, grade = '1', shift = ''): NewStudentForm => ({name: '', centre, grade, shift, start: '', gender: ''});

export function validateNewStudent(form: NewStudentForm, today: string, allowedCentres: string[]): string | null {
  if (!form.name.trim()) return 'Enter the verified name.';
  if (!allowedCentres.includes(form.centre)) return 'Choose one of your centres.';
  if (!form.start || form.start > today || !form.shift) return 'An observed start date and shift are required.';
  return null;
}
export const buildNewStudent = (form: NewStudentForm, request: string): NewStudent => ({request, centre: form.centre, grade: form.grade, shift: form.shift, start: form.start, name: form.name, gender: form.gender || null});

export interface EditForm {name: string; gender: string; board: string; status: string}
export function validateEdit(form: EditForm, year: AcademicYear | undefined): string | null {
  if (!form.name.trim()) return 'Enter the verified name.';
  if (year?.editable && !(STATUSES as readonly string[]).includes(form.status)) return 'Select the current academic year status.';
  return null;
}
export const boardValue = (board: string): boolean | null => (board === '' ? null : board === 'true');
