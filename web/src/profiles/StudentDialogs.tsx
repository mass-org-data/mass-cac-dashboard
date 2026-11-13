import {useEffect, useRef, useState} from 'react';
import {Button} from '../components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '../components/ui/dialog';
import {Input} from '../components/ui/input';
import {AsyncState} from '../components/AsyncState';
import {boardValue, buildNewStudent, emptyStudent, newRequest, STATUSES, validateEdit, validateNewStudent, type EditForm, type NewStudentForm} from './editor';
import type {AcademicYear, ProfilesService, StudentRow} from './service';

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'The request could not be completed.');
const selectClass = 'min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink';
const labelClass = 'flex flex-col gap-1 text-xs font-semibold text-muted';
const PENDING = 'Operational activation pending. No record was changed.';

interface CommonProps {service: ProfilesService; onSaved: (message: string) => Promise<void> | void; onClose: () => void; enabled: boolean}

export function AddStudentDialog({service, centres, initialCentre, today, enabled, onSaved, onClose}: CommonProps & {centres: Array<{id: string; label: string}>; initialCentre: string; today: string}) {
  const [form, setForm] = useState<NewStudentForm>(() => emptyStudent(initialCentre));
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'ready' | 'saving' | 'committed'>('ready');
  // One request id per dialog: retrying the same save cannot register the student twice.
  const request = useRef(newRequest());
  const set = (field: keyof NewStudentForm, value: string) => setForm(f => ({...f, [field]: value}));

  const submit = async () => {
    if (status !== 'ready') return;
    const problem = validateNewStudent(form, today, centres.map(c => c.id));
    if (problem) { setError(problem); return; }
    setError(''); setStatus('saving');
    try { await service.register(buildNewStudent(form, request.current)); }
    catch (e) { setError(messageOf(e)); setStatus('ready'); return; }
    setStatus('committed');
    try { await onSaved('Student registered with a permanent generated ID.'); }
    catch { setError('The student was registered, but refreshed data could not be loaded. Reload this page; do not submit again.'); return; }
    onClose();
  };
  const busy = status !== 'ready';
  return (
    <Dialog open onOpenChange={open => { if (!open && status !== 'saving') onClose(); }}>
      <DialogContent aria-describedby="add-student-help" onInteractOutside={event => event.preventDefault()}>
        <div>
          <DialogTitle>Add student</DialogTitle>
          <DialogDescription id="add-student-help">Permanent IDs and historical assignments are preserved. The start date is the observed date the student began.</DialogDescription>
        </div>
        {enabled ? null : <p role="status" className="rounded-md bg-warn-soft p-3 text-sm text-warn">This form is available for review. Saving is switched off until the workspace is activated.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>Full name<Input value={form.name} disabled={busy} onChange={event => set('name', event.target.value)} /></label>
          <label className={labelClass}>Centre / village
            <select value={form.centre} disabled={busy || centres.length === 1} onChange={event => set('centre', event.target.value)} className={selectClass}>{centres.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          </label>
          <label className={labelClass}>Grade
            <select value={form.grade} disabled={busy} onChange={event => set('grade', event.target.value)} className={selectClass}>{Array.from({length: 10}, (_, i) => String(i + 1)).map(g => <option key={g}>{g}</option>)}</select>
          </label>
          <label className={labelClass}>Shift
            <select value={form.shift} disabled={busy} onChange={event => set('shift', event.target.value)} className={selectClass}><option value="">Select observed shift</option><option>Morning</option><option>Evening</option></select>
          </label>
          <label className={labelClass}>Gender
            <select value={form.gender} disabled={busy} onChange={event => set('gender', event.target.value)} className={selectClass}><option value="">Unknown</option><option>Girl</option><option>Boy</option></select>
          </label>
          <label className={labelClass}>Start date<Input type="date" value={form.start} max={today} disabled={busy} onChange={event => set('start', event.target.value)} /></label>
        </div>
        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-bad">{error}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={status === 'saving'}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={!enabled || busy}>{status === 'saving' ? 'Saving…' : 'Save student'}</Button>
        </div>
        {enabled ? null : <p className="text-xs text-muted">{PENDING}</p>}
      </DialogContent>
    </Dialog>
  );
}

export function EditStudentDialog({service, student, centreLabel, enabled, onSaved, onClose}: CommonProps & {student: StudentRow; centreLabel: string}) {
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState<EditForm>({name: student.name ?? '', gender: student.gender ?? '', board: student.board === null ? '' : String(student.board), status: ''});
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'ready' | 'saving' | 'committed'>('ready');

  useEffect(() => {
    let live = true;
    setLoad('loading');
    Promise.all([service.history(student.child).catch(() => [] as AcademicYear[]), service.revision(student.child)]).then(([history, rev]) => {
      if (!live) return;
      setYears(history); setRevision(rev);
      setForm(f => ({...f, status: history.find(y => y.editable)?.status ?? ''}));
      setLoad('ready');
    }).catch(e => { if (live) { setLoadError(messageOf(e)); setLoad('error'); } });
    return () => { live = false; };
  }, [service, student.child, attempt]);

  const current = years.find(y => y.editable);
  const set = (field: keyof EditForm, value: string) => setForm(f => ({...f, [field]: value}));
  const submit = async () => {
    if (status !== 'ready' || load !== 'ready') return;
    const problem = validateEdit(form, current);
    if (problem) { setError(problem); return; }
    setError(''); setStatus('saving');
    try {
      await service.saveProfile({child: student.child, enrolment: current?.enrolment_id ?? student.enrolment, revision, name: form.name, gender: form.gender || null, board: boardValue(form.board), year: current ? {id: current.academic_year_id, status: form.status, version: current.version} : undefined});
    } catch (e) { setError(messageOf(e)); setStatus('ready'); return; }
    setStatus('committed');
    try { await onSaved('Student profile saved.'); }
    catch { setError('The profile was saved, but refreshed data could not be loaded. Reload this page.'); return; }
    onClose();
  };
  const busy = status !== 'ready' || load !== 'ready';
  return (
    <Dialog open onOpenChange={open => { if (!open && status !== 'saving') onClose(); }}>
      <DialogContent aria-describedby="edit-student-help" onInteractOutside={event => event.preventDefault()}>
        <div>
          <DialogTitle>Edit student profile</DialogTitle>
          <DialogDescription id="edit-student-help">Academic-year grades and status are retained separately. Centre, grade and shift changes are transfers: use the standard application for those.</DialogDescription>
        </div>
        {enabled ? null : <p role="status" className="rounded-md bg-warn-soft p-3 text-sm text-warn">This form is available for review. Saving is switched off until the workspace is activated.</p>}
        <AsyncState state={load} loadingLabel="Loading this student…" errorMessage={loadError} onRetry={() => setAttempt(n => n + 1)} rows={3}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Full name<Input value={form.name} disabled={busy} onChange={event => set('name', event.target.value)} /></label>
            <label className={labelClass}>Student ID<Input value={student.studentId} readOnly /></label>
            <label className={labelClass}>Centre<Input value={centreLabel} readOnly /></label>
            <label className={labelClass}>Current grade<Input value={current?.grade ?? student.grade} readOnly /></label>
            <label className={labelClass}>Shift<Input value={student.shift} readOnly /></label>
            <label className={labelClass}>Gender
              <select value={form.gender} disabled={busy} onChange={event => set('gender', event.target.value)} className={selectClass}><option value="">Unknown</option><option>Girl</option><option>Boy</option></select>
            </label>
            <label className={labelClass}>Class 10 board exam passed?
              <select value={form.board} disabled={busy} onChange={event => set('board', event.target.value)} className={selectClass}><option value="">Unknown</option><option value="true">Yes</option><option value="false">No</option></select>
            </label>
            {current ? (
              <label className={labelClass}>Current academic year status ({current.label})
                <select value={form.status} disabled={busy} onChange={event => set('status', event.target.value)} className={selectClass}><option value="">Select status</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
              </label>
            ) : null}
          </div>
          {years.length ? (
            <table aria-label="Academic year history" className="w-full border-collapse text-sm">
              <thead><tr><th scope="col" className="bg-brand-soft px-3 py-2 text-left">Academic year</th><th scope="col" className="bg-brand-soft px-3 py-2 text-left">Grade</th><th scope="col" className="bg-brand-soft px-3 py-2 text-left">Status</th></tr></thead>
              <tbody>{years.map(y => <tr key={y.academic_year_id}><td className="border-b border-line px-3 py-1">{y.label}{y.editable ? ' · current' : ' · read only'}</td><td className="border-b border-line px-3 py-1">{y.grade}</td><td className="border-b border-line px-3 py-1">{y.status ?? 'Not recorded'}</td></tr>)}</tbody>
            </table>
          ) : <p className="text-sm text-muted">No source-backed academic-year assignment is available. A grade history will not be invented.</p>}
        </AsyncState>
        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-bad">{error}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={status === 'saving'}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={!enabled || busy}>{status === 'saving' ? 'Saving…' : 'Save profile'}</Button>
        </div>
        {enabled ? null : <p className="text-xs text-muted">{PENDING}</p>}
      </DialogContent>
    </Dialog>
  );
}
