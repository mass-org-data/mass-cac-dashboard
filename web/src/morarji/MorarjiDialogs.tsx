import {useEffect, useState} from 'react';
import {Button} from '../components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '../components/ui/dialog';
import {Input} from '../components/ui/input';
import {AsyncState} from '../components/AsyncState';
import type {Grade5Student, MorarjiService} from './service';
import {useI18n} from '../i18n/I18n';
import {english} from '../components/FilterPanel';

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'The request could not be completed.');
const selectClass = 'min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink';
const labelClass = 'flex flex-col gap-1 text-xs font-semibold text-muted';

/** Yes / No / not recorded. Blank never means No. */
export type Tri = '' | 'yes' | 'no';
export const toBool = (v: Tri): boolean | null => (v === 'yes' ? true : v === 'no' ? false : null);
export const fromBool = (v: boolean | null): Tri => (v === true ? 'yes' : v === false ? 'no' : '');

interface Outcome {applied: Tri; attended: Tri; passed: Tri; school: string}
const emptyOutcome: Outcome = {applied: '', attended: '', passed: '', school: ''};

function OutcomeFields({value, onChange, busy}: {value: Outcome; onChange: (next: Outcome) => void; busy: boolean}) {
  const {t} = useI18n();
  const tri = (label: string, field: 'applied' | 'attended' | 'passed') => (
    <label className={labelClass}>{label}
      <select value={value[field]} disabled={busy} onChange={event => onChange({...value, [field]: event.target.value as Tri})} className={selectClass}>
        <option value="">{t('common.notRecorded')}</option><option value="yes">{english('common.yes')}</option><option value="no">{english('common.no')}</option>
      </select>
    </label>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tri(t('morarji.application'), 'applied')}
      {tri(t('morarji.tookExam'), 'attended')}
      {tri(t('morarji.passed'), 'passed')}
      <label className={labelClass}>{t('morarji.school')}<Input value={value.school} maxLength={200} disabled={busy} onChange={event => onChange({...value, school: event.target.value})} /></label>
    </div>
  );
}

interface CommonProps {service: MorarjiService; enabled: boolean; onSaved: (message: string) => Promise<void> | void; onClose: () => void}

/** Adds one Grade 5 student of an authorized centre to the selected cohort, with an optional first outcome. */
export function AddMorarjiDialog({service, enabled, centres, initialCentre, cohortId, cohortLabel, onSaved, onClose}: CommonProps & {centres: Array<{id: string; label: string}>; initialCentre: string; cohortId: string; cohortLabel: string}) {
  const {t} = useI18n();
  const [centre, setCentre] = useState(initialCentre);
  const [students, setStudents] = useState<Grade5Student[]>([]);
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [enrolment, setEnrolment] = useState('');
  const [outcome, setOutcome] = useState<Outcome>(emptyOutcome);
  const [status, setStatus] = useState<'ready' | 'saving'>('ready');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true; setLoad('loading'); setEnrolment('');
    service.grade5(centre).then(rows => { if (live) { setStudents(rows.sort((a, b) => (a.name ?? a.studentId).localeCompare(b.name ?? b.studentId))); setLoad('ready'); } }).catch(e => { if (live) { setLoadError(messageOf(e)); setLoad('error'); } });
    return () => { live = false; };
  }, [service, centre, attempt]);
  const busy = status === 'saving';
  const submit = async () => {
    if (!enrolment) { setError(t('morarji.chooseStudent')); return; }
    setError(''); setStatus('saving');
    let member = '';
    try { member = await service.addMember(enrolment, cohortId); }
    catch (e) { setError(messageOf(e)); setStatus('ready'); return; }
    const hasOutcome = outcome.applied || outcome.attended || outcome.passed || outcome.school.trim();
    if (hasOutcome) {
      try { await service.recordOutcome({member, applied: toBool(outcome.applied), attended: toBool(outcome.attended), passed: toBool(outcome.passed), school: outcome.school, expected: 0}); }
      catch (e) { setError(`${t('morarji.addedNoOutcome')} ${messageOf(e)}`); setStatus('ready'); try { await onSaved(t('morarji.addedNoOutcome')); } catch { /* list refresh failed */ } return; }
    }
    try { await onSaved(t('morarji.added', {cohort: cohortLabel})); } catch { /* the record is saved; the list refresh failed */ }
    onClose();
  };
  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent aria-describedby="morarji-add-help" onInteractOutside={event => event.preventDefault()}>
        <div><DialogTitle>{t('morarji.addRecord')}</DialogTitle><DialogDescription id="morarji-add-help">{t('morarji.addHelp', {cohort: cohortLabel})}</DialogDescription></div>
        {enabled ? null : <p role="status" className="rounded-md bg-warn-soft p-3 text-sm text-warn">{t('common.activationPending')}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>{t('common.centre')}<select value={centre} disabled={busy || centres.length === 1} onChange={event => setCentre(event.target.value)} className={selectClass}>{centres.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
          <label className={labelClass}>{t('common.student')}
            <select value={enrolment} disabled={busy || load !== 'ready'} onChange={event => setEnrolment(event.target.value)} className={selectClass}>
              <option value="">{t('morarji.selectStudent')}</option>{students.map(s => <option key={s.enrolment} value={s.enrolment}>{s.name ?? t('common.nameMissing')} · {s.studentId}</option>)}
            </select>
          </label>
        </div>
        <AsyncState state={load} loadingLabel={t('register.loadingStudents')} errorMessage={loadError} onRetry={() => setAttempt(n => n + 1)} rows={2}>
          {students.length === 0 ? <p role="note" className="rounded-md bg-brand-soft p-3 text-sm">{t('morarji.noGrade5')}</p> : <OutcomeFields value={outcome} onChange={setOutcome} busy={busy} />}
        </AsyncState>
        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-bad">{error}</p>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button><Button onClick={() => void submit()} disabled={!enabled || busy || load !== 'ready' || !enrolment}>{t(busy ? 'common.saving' : 'morarji.saveRecord')}</Button></div>
      </DialogContent>
    </Dialog>
  );
}

/** Records or corrects the outcome of one existing cohort member. */
export function OutcomeDialog({service, enabled, member, onSaved, onClose}: CommonProps & {member: {id: string; centre: string; name: string; applied: boolean | null; attended: boolean | null; result: string; school: string | null}}) {
  const {t} = useI18n();
  const [outcome, setOutcome] = useState<Outcome>({applied: fromBool(member.applied), attended: fromBool(member.attended), passed: member.result === 'Passed' ? 'yes' : member.result === 'Not passed' ? 'no' : '', school: member.school ?? ''});
  const [version, setVersion] = useState<number | null>(null);
  const [status, setStatus] = useState<'ready' | 'saving'>('ready');
  const [error, setError] = useState('');
  useEffect(() => { let live = true; service.outcomeVersion(member.centre, member.id).then(v => { if (live) setVersion(v); }).catch(e => { if (live) setError(messageOf(e)); }); return () => { live = false; }; }, [service, member.centre, member.id]);
  const busy = status === 'saving' || version === null;
  const submit = async () => {
    if (version === null) return;
    setError(''); setStatus('saving');
    try { await service.recordOutcome({member: member.id, applied: toBool(outcome.applied), attended: toBool(outcome.attended), passed: toBool(outcome.passed), school: outcome.school, expected: version}); }
    catch (e) { setError(messageOf(e)); setStatus('ready'); return; }
    try { await onSaved(t('morarji.outcomeSaved')); } catch { /* the outcome is saved; the list refresh failed */ }
    onClose();
  };
  return (
    <Dialog open onOpenChange={open => { if (!open && status !== 'saving') onClose(); }}>
      <DialogContent aria-describedby="morarji-outcome-help" onInteractOutside={event => event.preventDefault()}>
        <div><DialogTitle>{t('morarji.outcomeTitle')}</DialogTitle><DialogDescription id="morarji-outcome-help">{member.name}</DialogDescription></div>
        {enabled ? null : <p role="status" className="rounded-md bg-warn-soft p-3 text-sm text-warn">{t('common.activationPending')}</p>}
        <OutcomeFields value={outcome} onChange={setOutcome} busy={busy} />
        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-bad">{error}</p>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={status === 'saving'}>{t('common.cancel')}</Button><Button onClick={() => void submit()} disabled={!enabled || busy}>{t(status === 'saving' ? 'common.saving' : 'morarji.saveOutcome')}</Button></div>
      </DialogContent>
    </Dialog>
  );
}
