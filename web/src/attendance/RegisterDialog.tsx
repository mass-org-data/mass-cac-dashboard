import {useCallback, useEffect, useRef, useState} from 'react';
import {Button} from '../components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '../components/ui/dialog';
import {Input} from '../components/ui/input';
import {AsyncState} from '../components/AsyncState';
import {applyRead, buildSave, canSubmit, initialEditor, isDirty, markedCount, validate, type Code, type EditorState, type SessionType} from './editor';
import type {AttendanceService, RegisterCapabilities} from './service';
import {cn} from '../lib/utils';
import {useI18n} from '../i18n/I18n';

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
  const {t} = useI18n();
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
  const cancelDelete = () => {
    setFormError('');
    setState(s => ({...s, deleting: false, confirmDelete: false}));
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) requestClose(); }}>
      <DialogContent aria-describedby="register-help" onInteractOutside={event => event.preventDefault()}>
        <div>
          <DialogTitle>{t(state.recorded ? 'register.edit' : 'register.add')}</DialogTitle>
          <DialogDescription id="register-help">{t('register.help')}</DialogDescription>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">{t('register.sessionType')}
            <select value={state.sessionType} disabled={busy} onChange={event => setState(s => ({...s, sessionType: event.target.value as SessionType}))} className="min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink">
              <option value="Classroom">{t('register.classroom')}</option>
              <option value="Holiday" disabled={!capabilities.session_entry}>{t('register.holiday')}</option>
              <option value="Monthly meeting" disabled>{t('register.monthlyMeeting')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">{t('common.centre')}
            <select value={state.centre} disabled={busy || single} onChange={event => changeContext('centre', event.target.value)} className="min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink">
              {centres.map(centre => <option key={centre.id} value={centre.id}>{centre.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">{t('common.shift')}
            <select value={state.shift} disabled={busy} onChange={event => changeContext('shift', event.target.value)} className="min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink">
              <option value="Morning">{t('common.morning')}</option><option value="Evening">{t('common.evening')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">{t('common.date')}
            <Input type="date" value={state.date} max={today} disabled={busy} required onChange={event => event.target.value && changeContext('date', event.target.value)} />
          </label>
        </div>

        {state.recorded > 0 && !holiday ? <p role="note" className="rounded-md bg-brand-soft p-3 text-sm">{t('register.savedRecord', {count: state.recorded})}</p> : null}

        {holiday ? (
          <p role="note" className="rounded-md bg-warn-soft p-3 text-sm text-warn">{t('register.holidayHelp')}</p>
        ) : (
          <AsyncState state={status === 'loading' ? 'loading' : status === 'error' ? 'error' : 'ready'} loadingLabel={t('register.loadingStudents')} errorMessage={loadError} onRetry={() => load(state.centre, state.shift, state.date)} rows={4}>
            {state.roster.length === 0 ? <p role="note" className="rounded-md bg-brand-soft p-3 text-sm">{t('register.noStudents')}</p> : (
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p role="status" aria-live="polite" className="text-sm">{t('register.rosterStatus', {students: state.roster.length, marked: markedCount(state), state: t(dirty ? 'register.unsaved' : 'register.savedLoaded')})}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => markAll('P')}>{t('register.markPresent')}</Button>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => markAll('A')}>{t('register.markAbsent')}</Button>
                  </div>
                </div>
                <div className="max-h-[40vh] overflow-auto rounded-md border border-line">
                  <table aria-label={t('register.studentsToMark')} className="w-full border-collapse text-sm">
                    <thead><tr><th scope="col" className="sticky top-0 bg-brand-soft px-3 py-2 text-left">{t('common.student')}</th><th scope="col" className="sticky top-0 bg-brand-soft px-3 py-2 text-left">{t('common.grade')}</th><th scope="col" className="sticky top-0 bg-brand-soft px-3 py-2 text-left">{t('register.attendance')}</th></tr></thead>
                    <tbody>
                      {state.roster.map(student => (
                        <tr key={student.id} className="odd:bg-white even:bg-paper">
                          <td className="border-b border-line px-3 py-1">{student.name || t('common.nameMissing')}</td>
                          <td className="border-b border-line px-3 py-1">{student.grade}</td>
                          <td className="border-b border-line px-3 py-1">
                            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('register.attendanceFor', {student: student.name || t('common.student')})}>
                              {(['P', 'A'] as Code[]).map(code => (
                                <button key={code} type="button" disabled={busy} aria-pressed={state.draft[student.id] === code} aria-label={`${t(code === 'P' ? 'register.present' : 'register.absent')}: ${student.name || t('common.student')}`} onClick={() => mark(student.id, code)}
                                  className={cn('min-h-11 min-w-11 rounded-md border px-3 font-semibold', code === 'P' ? 'border-ok bg-ok-soft text-ok' : 'border-bad bg-bad-soft text-bad', state.draft[student.id] === code && (code === 'P' ? 'bg-ok text-white' : 'bg-bad text-white'))}>{code}</button>
                              ))}
                              {state.draft[student.id] ? <button type="button" disabled={busy} onClick={() => clear(student.id)} className="min-h-11 px-2 text-xs font-semibold text-muted underline" aria-label={t('register.clearMark', {student: student.name || t('common.student')})}>{t('register.clear')}</button> : null}
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

        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">{t('common.notes')}
          <textarea value={state.notes} disabled={busy} onChange={event => setState(s => ({...s, notes: event.target.value}))} rows={2} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-normal text-ink" />
        </label>

        {state.recorded > 0 && !holiday ? (
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">{t('register.reasonCorrection')}
            <Input value={state.reason} disabled={busy} onChange={event => setState(s => ({...s, reason: event.target.value}))} placeholder={t('register.reasonCorrectionPlaceholder')} />
          </label>
        ) : null}

        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-bad">{state.deleting ? '' : formError}</p>
        <div className="flex flex-wrap justify-end gap-2">
          {state.recorded > 0 && !holiday ? <Button variant="outline" className="mr-auto border-bad text-bad" disabled={busy} onClick={() => { setFormError(''); setState(s => ({...s, deleting: true, confirmDelete: false})); }}>{t('common.delete')}</Button> : null}
          <Button variant="outline" onClick={requestClose} disabled={status === 'saving'}>{t('common.cancel')}</Button>
          <Button onClick={() => void submit()} disabled={!canSubmit({...state, deleting: false, confirmDelete: false}) || busy || status === 'committed'}>
            {t(status === 'saving' ? 'common.saving' : holiday ? 'register.saveHoliday' : 'register.saveAttendance')}
          </Button>
        </div>
      </DialogContent>

      <Dialog open={state.deleting} onOpenChange={open => { if (!open && status !== 'saving') cancelDelete(); }}>
        <DialogContent role="alertdialog" className="z-[70] max-w-lg" overlayClassName="z-[60]" aria-describedby="delete-register-description" onInteractOutside={event => event.preventDefault()}>
          <div>
            <DialogTitle>{t('register.deleteTitle')}</DialogTitle>
            <DialogDescription id="delete-register-description">{t('register.deleteHelp', {count: state.recorded})}</DialogDescription>
          </div>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">{t('register.reasonDeletion')}
            <Input value={state.reason} disabled={busy} onChange={event => setState(s => ({...s, reason: event.target.value}))} placeholder={t('register.reasonDeletionPlaceholder')} />
          </label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={state.confirmDelete} disabled={busy} onChange={event => setState(s => ({...s, confirmDelete: event.target.checked}))} />{t('register.confirmDelete')}</label>
          <p role="alert" aria-live="polite" className="min-h-5 text-sm text-bad">{formError}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={cancelDelete} disabled={busy}>{t('register.keep')}</Button>
            <Button className="bg-bad hover:bg-bad" onClick={() => void submit()} disabled={busy || status === 'committed'}>{t(status === 'saving' ? 'common.deleting' : 'common.delete')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
