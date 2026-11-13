import {useCallback, useEffect, useRef, useState} from 'react';
import {Button} from '../components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '../components/ui/dialog';
import {Input} from '../components/ui/input';
import {AsyncState} from '../components/AsyncState';
import {applyRead, buildSave, canSubmit, initialEditor, isDirty, markedCount, validate, type Code, type EditorState, type SessionType} from './editor';
import type {AttendanceService, RegisterCapabilities} from './service';
import {cn} from '../lib/utils';

export interface Selection {centre: string; shift: string; date: string}
interface Props {
  service: AttendanceService;
  capabilities: RegisterCapabilities;
  centres: Array<{id: string; label: string}>;
  initial: Selection;
  today: string;
  /** Called after a successful save; may reject when the refresh fails (the save itself stays done). */
  onSaved: (message: string) => Promise<void> | void;
  onClose: () => void;
  confirm?: (message: string) => boolean;
}

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'The request could not be completed.');

export function RegisterDialog({service, capabilities, centres, initial, today, onSaved, onClose, confirm = message => window.confirm(message)}: Props) {
  const [state, setState] = useState<EditorState>(() => initialEditor(initial));
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'saving' | 'committed'>('loading');
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const sequence = useRef(0);
  const dirty = isDirty(state, capabilities);

  const load = useCallback((centre: string, shift: string, date: string) => {
    const run = ++sequence.current;
    setStatus('loading'); setLoadError('');
    service.readRegister(centre, shift, date).then(read => {
      if (run !== sequence.current) return;
      setState(previous => applyRead({...previous, centre, shift, date}, read));
      setStatus('ready');
    }).catch(error => { if (run === sequence.current) { setLoadError(messageOf(error)); setStatus('error'); } });
  }, [service]);

  useEffect(() => { load(initial.centre, initial.shift, initial.date); }, [load, initial.centre, initial.shift, initial.date]);

  const changeContext = (field: 'centre' | 'shift' | 'date', value: string) => {
    if (dirty && !confirm('Discard unsaved attendance changes and change the selection?')) return;
    setFormError('');
    const next = {...state, [field]: value};
    setState({...next, loaded: false, saved: {}, draft: {}, roster: [], deleting: false});
    load(next.centre, next.shift, next.date);
  };

  const requestClose = () => {
    if (status === 'saving') return;
    if (dirty && status !== 'committed' && !confirm('Discard unsaved attendance changes?')) return;
    onClose();
  };

  const mark = (id: string, code: Code) => setState(s => ({...s, draft: {...s.draft, [id]: code}}));
  const clear = (id: string) => setState(s => { const draft = {...s.draft}; delete draft[id]; return {...s, draft}; });
  const markAll = (code: Code) => setState(s => ({...s, draft: Object.fromEntries(s.roster.map(student => [student.id, code]))}));

  const submit = async () => {
    if (status === 'saving' || status === 'committed') return;
    const problem = validate(state, capabilities);
    if (problem) { setFormError(problem); return; }
    setFormError(''); setStatus('saving');
    const plan = buildSave(state, capabilities);
    try {
      if (plan.kind === 'holiday') await service.saveHoliday(plan.args);
      else if (plan.kind === 'delete') await service.deleteRegister(plan.args);
      else await service.saveClassroom(plan.args);
    } catch (error) {
      // The same request id is kept, so retrying the same save cannot create a duplicate.
      setFormError(messageOf(error)); setStatus('ready'); return;
    }
    setStatus('committed');
    const message = plan.kind === 'holiday' ? 'Holiday saved.' : plan.kind === 'delete' ? 'Attendance deleted. History retained.' : 'Attendance saved and charts refreshed.';
    try { await onSaved(message); }
    catch { setFormError('Attendance was saved, but refreshed data could not be loaded. Reload this page; do not submit again.'); return; }
    onClose();
  };

  const single = centres.length === 1;
  const holiday = state.sessionType === 'Holiday';
  const busy = status === 'loading' || status === 'saving';

  return (
    <Dialog open onOpenChange={open => { if (!open) requestClose(); }}>
      <DialogContent aria-describedby="register-help" onInteractOutside={event => event.preventDefault()}>
        <div>
          <DialogTitle>{state.recorded ? 'Edit attendance' : 'Add attendance'}</DialogTitle>
          <DialogDescription id="register-help">Marks stay drafts until you click Save Attendance. A = Absent · P = Present. Holidays and monthly meetings are excluded from the attendance percentage.</DialogDescription>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Session Type
            <select value={state.sessionType} disabled={busy} onChange={event => setState(s => ({...s, sessionType: event.target.value as SessionType}))} className="min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink">
              <option value="Classroom">Classroom Session</option>
              <option value="Holiday" disabled={!capabilities.session_entry}>Holiday</option>
              <option value="Monthly meeting" disabled>Monthly Meeting (use the standard application)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Centre
            <select value={state.centre} disabled={busy || single} onChange={event => changeContext('centre', event.target.value)} className="min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink">
              {centres.map(centre => <option key={centre.id} value={centre.id}>{centre.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Shift
            <select value={state.shift} disabled={busy} onChange={event => changeContext('shift', event.target.value)} className="min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink">
              <option>Morning</option><option>Evening</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Date
            <Input type="date" value={state.date} max={today} disabled={busy} required onChange={event => event.target.value && changeContext('date', event.target.value)} />
          </label>
        </div>

        {state.recorded > 0 && !holiday ? <p role="note" className="rounded-md bg-brand-soft p-3 text-sm">Already logged. This is the saved record: {state.recorded} marks. Changing a saved mark needs a reason.</p> : null}

        {holiday ? (
          <p role="note" className="rounded-md bg-warn-soft p-3 text-sm text-warn">A holiday excludes this centre, shift and date from attendance percentages. Add the reason in Notes.</p>
        ) : (
          <AsyncState state={status === 'loading' ? 'loading' : status === 'error' ? 'error' : 'ready'} loadingLabel="Loading students…" errorMessage={loadError} onRetry={() => load(state.centre, state.shift, state.date)} rows={4}>
            {state.roster.length === 0 ? <p role="note" className="rounded-md bg-brand-soft p-3 text-sm">No eligible students are enrolled for this centre, shift and date.</p> : (
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p role="status" aria-live="polite" className="text-sm"><strong>{state.roster.length} students</strong> · {markedCount(state)} marked · {dirty ? 'Unsaved changes' : 'Saved marks loaded'}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => markAll('P')}>Mark all present</Button>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => markAll('A')}>Mark all absent</Button>
                  </div>
                </div>
                <div className="max-h-[40vh] overflow-auto rounded-md border border-line">
                  <table aria-label="Students to mark" className="w-full border-collapse text-sm">
                    <thead><tr><th scope="col" className="sticky top-0 bg-brand-soft px-3 py-2 text-left">Student</th><th scope="col" className="sticky top-0 bg-brand-soft px-3 py-2 text-left">Grade</th><th scope="col" className="sticky top-0 bg-brand-soft px-3 py-2 text-left">Attendance</th></tr></thead>
                    <tbody>
                      {state.roster.map(student => (
                        <tr key={student.id} className="odd:bg-white even:bg-paper">
                          <td className="border-b border-line px-3 py-1">{student.name || 'Name not recorded'}</td>
                          <td className="border-b border-line px-3 py-1">{student.grade}</td>
                          <td className="border-b border-line px-3 py-1">
                            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Attendance for ${student.name || 'student'}`}>
                              {(['P', 'A'] as Code[]).map(code => (
                                <button key={code} type="button" disabled={busy} aria-pressed={state.draft[student.id] === code} aria-label={`${code === 'P' ? 'Present' : 'Absent'}: ${student.name || 'student'}`} onClick={() => mark(student.id, code)}
                                  className={cn('min-h-11 min-w-11 rounded-md border px-3 font-semibold', code === 'P' ? 'border-ok bg-ok-soft text-ok' : 'border-bad bg-bad-soft text-bad', state.draft[student.id] === code && (code === 'P' ? 'bg-ok text-white' : 'bg-bad text-white'))}>{code}</button>
                              ))}
                              {state.draft[student.id] ? <button type="button" disabled={busy} onClick={() => clear(student.id)} className="min-h-11 px-2 text-xs font-semibold text-muted underline" aria-label={`Clear mark: ${student.name || 'student'}`}>Clear</button> : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </AsyncState>
        )}

        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Notes
          <textarea value={state.notes} disabled={busy} onChange={event => setState(s => ({...s, notes: event.target.value}))} rows={2} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-normal text-ink" />
        </label>

        {state.recorded > 0 && !holiday ? (
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Reason for correction or deletion
            <Input value={state.reason} disabled={busy} onChange={event => setState(s => ({...s, reason: event.target.value}))} placeholder="Required when you change or delete saved attendance" />
          </label>
        ) : null}

        {state.recorded > 0 && !holiday ? (
          <div className="rounded-md border border-bad p-3">
            <h3 className="font-semibold text-bad">Delete attendance</h3>
            <p className="text-sm">Remove all {state.recorded} saved marks for this centre, shift and date. Original records remain in restricted audit history.</p>
            {state.deleting ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm">This removes the whole register, including marks outside chart filters.</p>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5" checked={state.confirmDelete} onChange={event => setState(s => ({...s, confirmDelete: event.target.checked}))} />I understand this deletes the entire register</label>
                <Button variant="outline" onClick={() => setState(s => ({...s, deleting: false, confirmDelete: false}))}>Keep attendance</Button>
              </div>
            ) : <Button variant="outline" className="mt-2 border-bad text-bad" disabled={busy} onClick={() => setState(s => ({...s, deleting: true}))}>Delete Attendance</Button>}
          </div>
        ) : null}

        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-bad">{formError}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={requestClose} disabled={status === 'saving'}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={!canSubmit(state) || busy || status === 'committed'} className={state.deleting ? 'bg-bad hover:bg-bad' : undefined}>
            {status === 'saving' ? 'Saving…' : state.deleting ? 'Delete attendance' : holiday ? 'Save Holiday' : 'Save Attendance'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
