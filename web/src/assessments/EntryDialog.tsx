import {useMemo, useRef, useState} from 'react';
import {Button} from '../components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '../components/ui/dialog';
import {Input} from '../components/ui/input';
import {AsyncState} from '../components/AsyncState';
import {buildScores, mapRound, MAX_SCORE, validateStart, type Entered, type Mapped} from './editor';
import type {AssessmentsService, RosterStudent, SavedResult} from './service';
import type {References} from '../session/backend';
import {useI18n} from '../i18n/I18n';

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'The request could not be completed.');
type Year = References['academic_years'][number];
interface Props {service: AssessmentsService; refs: References; year: Year; centres: Array<{id: string; label: string}>; initialCentre: string; today: string; enabled: boolean; onSaved: (message: string) => Promise<void> | void; onClose: () => void}

export function EntryDialog({service, refs, year, centres, initialCentre, today, enabled, onSaved, onClose}: Props) {
  const {t} = useI18n();
  const [step, setStep] = useState<'start' | 'roster'>('start');
  const [centre, setCentre] = useState(initialCentre);
  const [date, setDate] = useState(year.starts_on <= today && today < year.ends_before ? today : year.starts_on);
  const [mapped, setMapped] = useState<Mapped | null>(null);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [saved, setSaved] = useState<Map<string, SavedResult>>(new Map());
  const [entered, setEntered] = useState<Entered>({});
  const [filter, setFilter] = useState('');
  const [load, setLoad] = useState<'ready' | 'loading' | 'error'>('ready');
  const [status, setStatus] = useState<'ready' | 'saving' | 'committed'>('ready');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<(SavedResult & {request: string}) | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const sequence = useRef(0);

  // The date decides the round; show it as soon as it is valid.
  const preview = useMemo(() => { try { return {round: mapRound(date, year, refs).label, problem: ''}; } catch (e) { return {round: '', problem: messageOf(e)}; } }, [date, year, refs]);

  const start = async () => {
    const problem = validateStart(centre, date, today, centres.map(c => c.id));
    if (problem) { setError(problem); return; }
    let found: Mapped;
    try { found = mapRound(date, year, refs); } catch (e) { setError(messageOf(e)); return; }
    setError(''); setLoad('loading'); setStep('roster'); setMapped(found);
    const run = ++sequence.current;
    try {
      const [students, existing] = await Promise.all([service.roster(centre, date), service.saved(centre, found.definitionId, year.starts_on, year.ends_before)]);
      if (run !== sequence.current) return;
      setRoster(students); setSaved(existing); setEntered({}); setLoad('ready');
    } catch (e) { if (run === sequence.current) { setError(messageOf(e)); setLoad('error'); } }
  };

  const submit = async () => {
    if (status !== 'ready' || !mapped) return;
    let rows;
    try { rows = buildScores(roster, entered, saved, date, mapped.definitionId); } catch (e) { setError(messageOf(e)); return; }
    setError(''); setStatus('saving');
    try { await service.save(rows); } catch (e) { setError(messageOf(e)); setStatus('ready'); return; }
    setStatus('committed');
    try { await onSaved(`${rows.length} ${mapped.label} marks saved.`); }
    catch { setError('The marks were saved, but refreshed data could not be loaded. Reload this page; do not submit again.'); return; }
    onClose();
  };

  const shown = roster.filter(s => !filter.trim() || `${s.name ?? ''} ${s.studentId}`.toLowerCase().includes(filter.trim().toLowerCase()));
  const busy = status !== 'ready';
  const centreLabel = centres.find(c => c.id === centre)?.label ?? '';
  return (
    <Dialog open onOpenChange={open => { if (!open && status !== 'saving') onClose(); }}>
      <DialogContent aria-describedby="entry-help" onInteractOutside={event => event.preventDefault()}>
        <div>
          <DialogTitle>{step === 'start' ? t('assessment.start') : t('assessment.enterMarks', {round: mapped?.label ?? ''})}</DialogTitle>
          <DialogDescription id="entry-help">{step === 'start' ? t('assessment.startHelp') : t('assessment.rosterHelp', {centre: centreLabel, date})}</DialogDescription>
        </div>
        {enabled ? null : <p role="status" className="rounded-md bg-warn-soft p-3 text-sm text-warn">{t('common.activationPending')}</p>}
        {step === 'start' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">{t('assessment.centreVillage')}
                <select value={centre} disabled={centres.length === 1} onChange={event => setCentre(event.target.value)} className="min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink">{centres.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">{t('assessment.date')}<Input type="date" value={date} min={year.starts_on} max={today} required onChange={event => setDate(event.target.value)} /></label>
            </div>
            <p role="status" aria-live="polite" className="text-sm">{preview.round ? t('assessment.roundStatus', {round: preview.round}) : preview.problem}</p>
            <p className="text-xs text-muted">{t('assessment.retestHelp')}</p>
          </>
        ) : (
          <AsyncState state={load} loadingLabel={t('register.loadingStudents')} errorMessage={error} onRetry={() => void start()} rows={4}>
            {roster.length === 0 ? <p role="note" className="rounded-md bg-brand-soft p-3 text-sm">{t('assessment.noStudents')}</p> : (
              <div>
                <label className="mb-2 flex max-w-sm flex-col gap-1 text-xs font-semibold text-muted">{t('assessment.findStudent')}<Input type="search" value={filter} onChange={event => setFilter(event.target.value)} /></label>
                <div className="max-h-[40vh] overflow-auto rounded-md border border-line">
                  <table aria-label={t('assessment.studentsToScore')} className="w-full border-collapse text-sm">
                    <thead><tr><th scope="col" className="sticky top-0 bg-brand-soft px-3 py-2 text-left">{t('common.student')}</th><th scope="col" className="sticky top-0 bg-brand-soft px-3 py-2 text-left">{t('assessment.marksHeader', {max: MAX_SCORE})}</th></tr></thead>
                    <tbody>
                      {shown.map(s => {
                        const old = saved.get(s.enrolment);
                        return (
                          <tr key={s.enrolment} className="odd:bg-white even:bg-paper">
                            <td className="border-b border-line px-3 py-1">{s.name || t('common.nameMissing')}<span className="block text-xs text-muted">{t('assessment.studentMeta', {id: s.studentId, grade: s.grade, shift: s.shift})}{old ? ` · ${t('assessment.savedDate', {date: old.date ?? t('common.unknown')})}` : ''}</span></td>
                            <td className="border-b border-line px-3 py-1">
                              {old ? <span className="flex flex-wrap items-center gap-2">{old.score} <span className="text-xs text-muted">({t('assessment.savedCorrection')})</span>{old.id ? <Button variant="ghost" size="sm" className="text-bad" onClick={() => { setDeleting({...old, request: crypto.randomUUID()}); setDeleteReason(''); setError(''); }}>{t('common.delete')}</Button> : null}</span>
                                : <Input type="number" inputMode="decimal" min={0} max={MAX_SCORE} step="any" aria-label={t('assessment.marksFor', {student: s.name || s.studentId})} value={entered[s.enrolment] ?? ''} disabled={busy} onChange={event => setEntered(v => ({...v, [s.enrolment]: event.target.value}))} />}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted">{t('assessment.blankHelp', {date})}</p>
              </div>
            )}
          </AsyncState>
        )}
        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-bad">{load === 'error' && step === 'roster' ? '' : error}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={status === 'saving'}>{t('common.cancel')}</Button>
          {step === 'start'
            ? <Button onClick={() => void start()} disabled={!preview.round}>{t('common.continue')}</Button>
            : <Button onClick={() => void submit()} disabled={!enabled || busy || load !== 'ready' || roster.length === 0}>{t(status === 'saving' ? 'common.saving' : 'assessment.save')}</Button>}
        </div>
      </DialogContent>
      <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open && status !== 'saving') setDeleting(null); }}><DialogContent role="alertdialog" className="z-[70] max-w-lg" overlayClassName="z-[60]" aria-describedby="delete-assessment-help"><div><DialogTitle>{t('assessment.deleteResultTitle')}</DialogTitle><DialogDescription id="delete-assessment-help">{t('assessment.deleteResultHelp')}</DialogDescription></div><label className="flex flex-col gap-1 text-xs font-semibold text-muted">{t('assessment.deleteReason')}<Input value={deleteReason} maxLength={300} onChange={event => setDeleteReason(event.target.value)} /></label><p role="alert" className="min-h-5 text-sm text-bad">{error}</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button><Button className="bg-bad hover:bg-bad" disabled={!enabled || !deleting?.id || !deleteReason.trim()} onClick={() => { if (!deleting?.id) return; setStatus('saving'); service.deleteRecord(deleting.request, deleting.id, deleting.version, deleteReason).then(async () => { setDeleting(null); await onSaved(t('assessment.deleteResultSuccess')); onClose(); }).catch(e => { setError(messageOf(e)); setStatus('ready'); }); }}>{t(status === 'saving' ? 'common.deleting' : 'common.delete')}</Button></div></DialogContent></Dialog>
    </Dialog>
  );
}
