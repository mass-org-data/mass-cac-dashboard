import {describe, expect, it} from 'vitest';
import {applyRead, buildSave, canSubmit, initialEditor, isDirty, validate, changes, type EditorState} from './editor';
import type {RegisterCapabilities, RegisterRead} from './service';

const caps: RegisterCapabilities = {version: 6, enabled: true, session_entry: true, register_paging: true, holiday_code: true};
const read = (marks: Array<[string, string]> = [], notes = ''): RegisterRead => ({
  roster: [{id: 'e1', name: 'Asha', grade: '4'}, {id: 'e2', name: 'Ravi', grade: '5'}, {id: 'e3', name: null, grade: '5'}],
  marks: marks.map(([enrolment, code]) => ({enrolment, code, version: 1})), token: 'tok1', marks_token: 'mt1', recorded: marks.length, notes,
});
const loaded = (marks: Array<[string, string]> = [], notes = ''): EditorState => applyRead(initialEditor({centre: 'c1', shift: 'Morning', date: '2026-11-12'}), read(marks, notes));

describe('attendance editor rules', () => {
  it('keeps marks as drafts and is not dirty until something changes', () => {
    const state = loaded([['e1', 'P']]);
    expect(isDirty(state, caps)).toBe(false);
    expect(isDirty({...state, draft: {...state.draft, e2: 'A'}}, caps)).toBe(true);
  });

  it('needs every eligible student marked Present or Absent before saving', () => {
    const state = loaded();
    expect(canSubmit(state)).toBe(false);
    expect(validate(state, caps)).toBe('Mark every eligible student Present or Absent.');
    expect(canSubmit({...state, draft: {e1: 'P', e2: 'A', e3: 'P'}})).toBe(true);
    expect(validate({...state, draft: {e1: 'P', e2: 'A', e3: 'P'}}, caps)).toBeNull();
  });

  it('never accepts a legacy or unknown code as a classroom mark', () => {
    const state = loaded();
    expect(canSubmit({...state, draft: {e1: 'P', e2: 'A', e3: 'L'}})).toBe(false);
    expect(canSubmit({...state, draft: {e1: 'P', e2: 'A', e3: 'MM'}})).toBe(false);
  });

  it('requires a reason to correct a saved mark but not to add new ones', () => {
    const saved = loaded([['e1', 'P'], ['e2', 'P'], ['e3', 'A']]);
    const corrected = {...saved, draft: {...saved.draft, e1: 'A'}};
    expect(validate(corrected, caps)).toBe('Enter a reason for this correction or deletion.');
    expect(validate({...corrected, reason: '  Marked in error '}, caps)).toBeNull();
    const fresh = loaded();
    expect(validate({...fresh, draft: {e1: 'P', e2: 'P', e3: 'P'}}, caps)).toBeNull();
  });

  it('refuses a save with no changes', () => {
    const saved = loaded([['e1', 'P'], ['e2', 'P'], ['e3', 'A']]);
    expect(validate(saved, caps)).toBe('No attendance changes selected.');
  });

  it('treats a notes change as a change that needs a reason once the register is saved', () => {
    const saved = loaded([['e1', 'P'], ['e2', 'P'], ['e3', 'A']], 'old');
    const edited = {...saved, notes: 'new'};
    expect(isDirty(edited, caps)).toBe(true);
    expect(validate(edited, caps)).toBe('Enter a reason for updating saved notes.');
    expect(validate({...edited, reason: 'Typo'}, caps)).toBeNull();
  });

  it('deleting needs a reason first and then the confirmation', () => {
    const saved = loaded([['e1', 'P'], ['e2', 'P'], ['e3', 'A']]);
    const deleting = {...saved, deleting: true};
    expect(validate(deleting, caps)).toBe('Enter a reason for this correction or deletion.');
    expect(validate({...deleting, reason: 'Entered on wrong date'}, caps)).toBe('Tick the confirmation to delete this entire centre, shift and date register.');
    expect(validate({...deleting, reason: 'Entered on wrong date', confirmDelete: true}, caps)).toBeNull();
    expect(canSubmit(deleting)).toBe(true);
  });

  it('builds the classroom save with the whole roster, the server token, the request id and the notes', () => {
    const state = {...loaded(), draft: {e1: 'P', e2: 'A', e3: 'P'}, notes: ' Sports day ', reason: ''};
    const plan = buildSave(state, caps);
    expect(plan.kind).toBe('classroom');
    expect(plan.args).toEqual({p_request: state.request, p_centre: 'c1', p_shift: 'Morning', p_date: '2026-11-12', p_token: 'tok1', p_reason: 'Attendance entered', p_rows: [{enrolment: 'e1', code: 'P'}, {enrolment: 'e2', code: 'A'}, {enrolment: 'e3', code: 'P'}], p_notes: ' Sports day '});
  });

  it('builds a deletion without rows and a holiday without a roster', () => {
    const saved = {...loaded([['e1', 'P'], ['e2', 'P'], ['e3', 'A']]), deleting: true, reason: 'Wrong day', confirmDelete: true};
    const del = buildSave(saved, caps);
    expect(del.kind).toBe('delete');
    expect(del.args).toEqual({p_request: saved.request, p_centre: 'c1', p_shift: 'Morning', p_date: '2026-11-12', p_token: 'tok1', p_reason: 'Wrong day'});
    const holiday = {...initialEditor({centre: 'c1', shift: 'Evening', date: '2026-08-15'}), sessionType: 'Holiday' as const, loaded: true, notes: ' Independence Day '};
    expect(validate(holiday, caps)).toBeNull();
    expect(canSubmit(holiday)).toBe(true);
    expect(buildSave(holiday, caps)).toEqual({kind: 'holiday', args: {p_request: holiday.request, p_centre: 'c1', p_shift: 'Evening', p_date: '2026-08-15', p_reason: 'Independence Day'}});
    expect(buildSave({...holiday, notes: ''}, caps).args).toMatchObject({p_reason: 'Holiday'});
  });

  it('keeps the same request id for a retry and renews it only when the register is read again', () => {
    const state = loaded();
    const first = buildSave({...state, draft: {e1: 'P', e2: 'P', e3: 'P'}}, caps).args.p_request;
    const retry = buildSave({...state, draft: {e1: 'P', e2: 'P', e3: 'P'}}, caps).args.p_request;
    expect(retry).toBe(first);
    expect(applyRead(state, read()).request).not.toBe(state.request);
  });

  it('only reports real changes and a cleared saved mark as a removal', () => {
    const state = loaded([['e1', 'P'], ['e2', 'A']]);
    const draft = {e1: 'P', e2: 'P'} as Record<string, string>;
    expect(changes({...state, draft})).toEqual([{enrolment: 'e2', code: 'P'}]);
    expect(changes({...state, draft: {e2: 'A'}})).toEqual([{enrolment: 'e1', code: null}]);
  });
});
