import {useEffect, useRef, useState} from 'react';
import {Button} from '../components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '../components/ui/dialog';
import {Input} from '../components/ui/input';
import {AsyncState} from '../components/AsyncState';
import {boardValue, buildNewStudent, emptyStudent, newRequest, STATUSES, validateEdit, validateNewStudent, type EditForm, type NewStudentForm} from './editor';
import type {AcademicYear, ProfilesService, StudentDeletionPreview, StudentRow} from './service';
import {useI18n} from '../i18n/I18n';
import {english} from '../components/FilterPanel';
import {CentreCombobox} from '../components/CentreCombobox';

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'The request could not be completed.');
const selectClass = 'min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink';
const labelClass = 'flex flex-col gap-1 text-xs font-semibold text-muted';

interface CommonProps {service: ProfilesService; onSaved: (message: string) => Promise<void> | void; onClose: () => void; enabled: boolean}

export function AddStudentDialog({service, centres, initialCentre, today, enabled, onSaved, onClose}: CommonProps & {centres: Array<{id: string; label: string}>; initialCentre: string; today: string}) {
  const {t} = useI18n();
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
          <DialogTitle>{t('profile.add')}</DialogTitle>
          <DialogDescription id="add-student-help">{t('profile.addHelp')}</DialogDescription>
        </div>
        {enabled ? null : <p role="status" className="rounded-md bg-warn-soft p-3 text-sm text-warn">{t('profile.reviewOnly')}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>{t('profile.fullName')}<Input value={form.name} disabled={busy} onChange={event => set('name', event.target.value)} /></label>
          <CentreCombobox label={t('profile.centreVillage')} value={form.centre} options={centres} disabled={busy || centres.length === 1} onChange={value => set('centre', value)} />
          <label className={labelClass}>{t('common.grade')}
            <select value={form.grade} disabled={busy} onChange={event => set('grade', event.target.value)} className={selectClass}>{Array.from({length: 10}, (_, i) => String(i + 1)).map(g => <option key={g}>{g}</option>)}</select>
          </label>
          <label className={labelClass}>{t('common.shift')}
            <select value={form.shift} disabled={busy} onChange={event => set('shift', event.target.value)} className={selectClass}><option value="">{t('profile.selectShift')}</option><option value="Morning">{english('common.morning')}</option><option value="Evening">{english('common.evening')}</option></select>
          </label>
          <label className={labelClass}>{t('common.gender')}
            <select value={form.gender} disabled={busy} onChange={event => set('gender', event.target.value)} className={selectClass}><option value="">{english('common.unknown')}</option><option value="Girl">{english('common.girls')}</option><option value="Boy">{english('common.boys')}</option></select>
          </label>
          <label className={labelClass}>{t('profile.startDate')}<Input type="date" value={form.start} max={today} disabled={busy} onChange={event => set('start', event.target.value)} /></label>
        </div>
        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-bad">{error}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={status === 'saving'}>{t('common.cancel')}</Button>
          <Button onClick={() => void submit()} disabled={!enabled || busy}>{t(status === 'saving' ? 'common.saving' : 'profile.saveStudent')}</Button>
        </div>
        {enabled ? null : <p className="text-xs text-muted">{t('profile.activationPending')}</p>}
      </DialogContent>
    </Dialog>
  );
}

export function EditStudentDialog({service, student, centreLabel, today, enabled, enrolEnabled, onSaved, onClose, onDelete}: CommonProps & {student: StudentRow; centreLabel: string; today: string; /** Shows Add enrollment when the server's enrolments switch is on. */ enrolEnabled?: boolean; /** When given, a Delete button appears inside this dialog (never in the table row). */ onDelete?: () => void}) {
  const {t} = useI18n();
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState<EditForm>({name: student.name ?? '', gender: student.gender ?? '', board: student.board === null ? '' : String(student.board), status: '', grade: student.grade});
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'ready' | 'saving' | 'committed'>('ready');
  const [enrolling, setEnrolling] = useState<{start: string; grade: string; shift: string} | null>(null);
  const [enrolError, setEnrolError] = useState('');
  const [enrolSaving, setEnrolSaving] = useState(false);

  useEffect(() => {
    let live = true;
    setLoad('loading');
    Promise.all([service.history(student.child).catch(() => [] as AcademicYear[]), service.revision(student.child)]).then(([history, rev]) => {
      if (!live) return;
      setYears(history); setRevision(rev);
      const editable = history.find(y => y.editable);
      setForm(f => ({...f, status: editable?.status ?? '', grade: editable?.grade ?? student.grade}));
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
      await service.saveProfile({child: student.child, enrolment: current?.enrolment_id ?? student.enrolment, revision, name: form.name, gender: form.gender || null, board: boardValue(form.board), year: current ? {id: current.academic_year_id, status: form.status, grade: form.grade, version: current.version, enrolmentVersion: current.enrolment_version ?? student.version} : undefined});
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
          <DialogTitle>{t('profile.editTitle')}</DialogTitle>
          <DialogDescription id="edit-student-help">{t('profile.editHelp')}</DialogDescription>
        </div>
        {enabled ? null : <p role="status" className="rounded-md bg-warn-soft p-3 text-sm text-warn">{t('profile.reviewOnly')}</p>}
        <AsyncState state={load} loadingLabel={t('profile.loadingStudent')} errorMessage={loadError} onRetry={() => setAttempt(n => n + 1)} rows={3}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>{t('profile.fullName')}<Input value={form.name} disabled={busy} onChange={event => set('name', event.target.value)} /></label>
            <label className={labelClass}>{t('profile.studentId')}<Input value={student.studentId} readOnly /></label>
            <label className={labelClass}>{t('common.centre')}<Input value={centreLabel} readOnly /></label>
            <label className={labelClass}>{t('profile.currentGrade')}<select value={form.grade} disabled={busy} onChange={event => set('grade', event.target.value)} className={selectClass}>{Array.from({length: 10}, (_, i) => String(i + 1)).map(grade => <option key={grade}>{grade}</option>)}</select></label>
            <label className={labelClass}>{t('common.shift')}<Input value={student.shift} readOnly /></label>
            <label className={labelClass}>{t('common.gender')}
              <select value={form.gender} disabled={busy} onChange={event => set('gender', event.target.value)} className={selectClass}><option value="">{english('common.unknown')}</option><option value="Girl">{english('common.girls')}</option><option value="Boy">{english('common.boys')}</option></select>
            </label>
            <label className={labelClass}>{t('profile.boardPassed')}
              <select value={form.board} disabled={busy} onChange={event => set('board', event.target.value)} className={selectClass}><option value="">{english('common.unknown')}</option><option value="true">{english('common.yes')}</option><option value="false">{english('common.no')}</option></select>
            </label>
            {current ? (
              <label className={labelClass}>{t('profile.currentYearStatus', {year: current.label})}
                <select value={form.status} disabled={busy} onChange={event => set('status', event.target.value)} className={selectClass}><option value="">{t('profile.selectStatus')}</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
              </label>
            ) : null}
          </div>
          {years.length || enrolling ? (
            <table aria-label={t('profile.history')} className="w-full border-collapse text-sm">
              <thead><tr><th scope="col" className="bg-brand-soft px-3 py-2 text-left">{t('profile.academicYear')}</th><th scope="col" className="bg-brand-soft px-3 py-2 text-left">{t('common.grade')}</th><th scope="col" className="bg-brand-soft px-3 py-2 text-left">{t('common.status')}</th><th scope="col" className="bg-brand-soft px-3 py-2 text-left">{t('common.action')}</th></tr></thead>
              <tbody>
                {years.map(y => <tr key={y.academic_year_id}><td className="border-b border-line px-3 py-1">{y.label} · {t(y.editable ? 'profile.current' : 'profile.readOnly')}</td><td className="border-b border-line px-3 py-1">{y.editable ? form.grade : y.grade}</td><td className="border-b border-line px-3 py-1">{y.status ?? t('common.notRecorded')}</td><td className="border-b border-line px-3 py-1">—</td></tr>)}
                {enrolling ? <>
                  <tr className={enrolError ? 'bg-bad-soft' : 'bg-brand-soft'}>
                    <td className="border-b border-line px-3 py-2"><select aria-label={t('profile.newYearStart')} value={enrolling.start} disabled={enrolSaving} onChange={event => setEnrolling(value => value && ({...value, start: event.target.value}))} className={selectClass}>{actualYearStarts(today).map(date => <option key={date}>{date}</option>)}</select></td>
                    <td className="border-b border-line px-3 py-2"><select aria-label={t('common.grade')} value={enrolling.grade} disabled={enrolSaving} onChange={event => setEnrolling(value => value && ({...value, grade: event.target.value}))} className={selectClass}>{Array.from({length: 10}, (_, i) => String(i + 1)).map(grade => <option key={grade}>{grade}</option>)}</select></td>
                    <td className="border-b border-line px-3 py-2">Active · <select aria-label={t('common.shift')} value={enrolling.shift} disabled={enrolSaving} onChange={event => setEnrolling(value => value && ({...value, shift: event.target.value}))} className={selectClass}><option value="Morning">{english('common.morning')}</option><option value="Evening">{english('common.evening')}</option></select></td>
                    <td className="border-b border-line px-3 py-2"><div className="flex gap-2"><Button size="sm" disabled={enrolSaving} onClick={() => {
                      if (!actualYearStarts(today).includes(enrolling.start) || enrolling.start <= student.enrolled) { setEnrolError(t('profile.enrolmentStartInvalid')); return; }
                      setEnrolError(''); setEnrolSaving(true);
                      service.promote({enrolment: student.enrolment, version: student.version, grade: enrolling.grade, start: enrolling.start, shift: enrolling.shift}).then(async () => { await onSaved(t('profile.enrolmentSaved')); onClose(); }).catch(error => { setEnrolError(messageOf(error)); setEnrolSaving(false); });
                    }}>{t(enrolSaving ? 'common.saving' : 'profile.saveEnrolment')}</Button><Button size="sm" variant="outline" disabled={enrolSaving} onClick={() => { setEnrolling(null); setEnrolError(''); }}>{t('common.cancel')}</Button></div></td>
                  </tr>
                  {enrolError ? <tr className="bg-bad-soft"><td colSpan={4} className="px-3 py-2 text-sm text-bad" role="alert">{enrolError}</td></tr> : null}
                </> : null}
              </tbody>
            </table>
          ) : <p className="text-sm text-muted">{t('profile.noHistory')}</p>}
          {enrolEnabled && !enrolling ? <div><Button variant="outline" onClick={() => { const starts = actualYearStarts(today); const start = starts.find(date => date > student.enrolled) ?? starts[1]!; setEnrolling({start, grade: String(Math.min(10, Number(form.grade) + 1)), shift: student.shift}); }} disabled={busy}>{t('profile.addEnrolment')}</Button></div> : null}
        </AsyncState>
        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-bad">{error}</p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onDelete ? <Button variant="outline" className="mr-auto border-bad text-bad" onClick={onDelete} disabled={status === 'saving'}>{t('common.delete')}</Button> : null}
          <Button variant="outline" onClick={onClose} disabled={status === 'saving'}>{t('common.cancel')}</Button>
          <Button onClick={() => void submit()} disabled={!enabled || busy}>{t(status === 'saving' ? 'common.saving' : 'profile.saveProfile')}</Button>
        </div>
        {enabled ? null : <p className="text-xs text-muted">{t('profile.activationPending')}</p>}
      </DialogContent>
    </Dialog>
  );
}

/** First 1 April after the academic year the enrolment started in. */
export function nextYearStart(enrolledOn: string): string {
  const [y, m] = enrolledOn.split('-').map(Number);
  return `${(m! >= 4 ? y! : y! - 1) + 1}-04-01`;
}

/** 1 April of the current and next actual calendar years. */
export function actualYearStarts(today: string): [string, string] {
  const year = Number(today.slice(0, 4));
  return [`${year}-04-01`, `${year + 1}-04-01`];
}

export function DeleteStudentDialog({service, student, enabled, onSaved, onClose}: CommonProps & {student: StudentRow}) {
  const {t} = useI18n();
  const [preview, setPreview] = useState<StudentDeletionPreview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'deleting'>('loading');
  const request = useRef(newRequest());
  const load = () => { setStatus('loading'); setLoadError(''); service.previewDeletion(student.child).then(value => { setPreview(value); setStatus('ready'); }).catch(error => { setLoadError(messageOf(error)); setStatus('ready'); }); };
  useEffect(load, [service, student.child]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async () => {
    if (!enabled || !preview || status !== 'ready' || !reason.trim()) return;
    setStatus('deleting'); setLoadError('');
    try { await service.deleteStudent(request.current, student.child, preview.token, reason); }
    catch (error) { setLoadError(messageOf(error)); setStatus('ready'); return; }
    await onSaved(t('profile.deleteSuccess'));
    onClose();
  };
  return <Dialog open onOpenChange={open => { if (!open && status !== 'deleting') onClose(); }}>
    <DialogContent role="alertdialog" aria-describedby="delete-student-help" onInteractOutside={event => event.preventDefault()}>
      <div><DialogTitle>{t('profile.deleteTitle')}</DialogTitle><DialogDescription id="delete-student-help">{t('profile.deleteHelp', {student: student.name ?? student.studentId})}</DialogDescription></div>
      {!enabled ? <p className="rounded-md bg-warn-soft p-3 text-sm text-warn">{t('profile.deleteDisabled')}</p> : null}
      {status === 'loading' ? <AsyncState state="loading" rows={4} /> : preview ? <ul className="max-h-52 overflow-auto rounded-md border border-line p-3 text-sm">
        {Object.entries(preview.counts).filter(([key]) => !key.endsWith('_retained')).map(([key, count]) => <li key={key} className="flex justify-between gap-3"><span>{key.replaceAll('_', ' ')}</span><strong>{count}</strong></li>)}
      </ul> : null}
      <p className="text-sm font-semibold text-bad">{t('profile.deleteCascadeWarning')}</p>
      <label className={labelClass}>{t('profile.deleteReason')}<Input value={reason} maxLength={300} disabled={status === 'deleting'} onChange={event => setReason(event.target.value)} /></label>
      <p role="alert" className="min-h-5 text-sm text-bad">{loadError}</p>
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={status === 'deleting'}>{t('common.cancel')}</Button><Button className="bg-bad hover:bg-bad" onClick={() => void submit()} disabled={!enabled || !preview || status !== 'ready' || !reason.trim()}>{t(status === 'deleting' ? 'common.deleting' : 'common.delete')}</Button></div>
    </DialogContent>
  </Dialog>;
}
