import {useEffect, useMemo, useRef, useState} from 'react';
import {Button} from '../components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '../components/ui/dialog';
import {Input} from '../components/ui/input';
import {AsyncState} from '../components/AsyncState';
import {buildScores, definitionForQuarter, initialEntries, mapRound, MAX_SCORE, validateStart, type Entered, type Mapped} from './editor';
import type {AssessmentsService, RosterStudent, SavedResult} from './service';
import type {References} from '../session/backend';
import {useI18n} from '../i18n/I18n';
import {english} from '../components/FilterPanel';
import {CentreCombobox} from '../components/CentreCombobox';

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'The request could not be completed.');
type Year = References['academic_years'][number];
/** Opening a saved register: its centre, shift and round are fixed; `date` is its latest observed date (null when unknown). */
export interface EditTarget {centre: string; shift: string; quarter: number; date: string | null}
interface Props {service: AssessmentsService; refs: References; year: Year; centres: Array<{id: string; label: string}>; initialCentre: string; today: string; enabled: boolean; edit?: EditTarget; onDelete?: () => void; onSaved: (message: string) => Promise<void> | void; onClose: () => void}

export function EntryDialog({service, refs, year, centres, initialCentre, today, enabled, edit, onDelete, onSaved, onClose}: Props) {
  const {t} = useI18n();
  const [step, setStep] = useState<'start' | 'roster'>(edit ? 'roster' : 'start');
  const [centre, setCentre] = useState(edit?.centre ?? initialCentre);
  const [shift, setShift] = useState(edit?.shift ?? 'Morning');
  const inYear = year.starts_on <= today && today < year.ends_before;
  const [date, setDate] = useState(edit?.date ?? (inYear ? today : year.starts_on));
  const [mapped, setMapped] = useState<Mapped | null>(null);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [saved, setSaved] = useState<Map<string, SavedResult>>(new Map());
  const [entered, setEntered] = useState<Entered>({});
  const [filter, setFilter] = useState('');
  const [load, setLoad] = useState<'ready' | 'loading' | 'error'>('ready');
  const [status, setStatus] = useState<'ready' | 'saving' | 'committed'>('ready');
  const [error, setError] = useState('');
  const sequence = useRef(0);

  // The date decides the round; show it as soon as it is valid.
  const preview = useMemo(() => { try { return {round: mapRound(date, year, refs).label, problem: ''}; } catch (e) { return {round: '', problem: messageOf(e)}; } }, [date, year, refs]);

  const start = async () => {
    const problem = validateStart(centre, date, today, centres.map(c => c.id));
    if (problem) { setError(problem); return; }
    let found: Mapped;
    try { found = edit ? definitionForQuarter(edit.quarter, year, refs) : mapRound(date, year, refs); } catch (e) { setError(messageOf(e)); return; }
    setError(''); setLoad('loading'); setStep('roster'); setMapped(found);
    const run = ++sequence.current;
    try {
      const rosterDate = date > today ? today : date;
      const [students, existing] = await Promise.all([service.roster(centre, rosterDate), service.saved(centre, found.definitionId, year.starts_on, year.ends_before)]);
      if (run !== sequence.current) return;
      const inShift = students.filter(s => s.shift === shift).sort((a, b) => Number(a.grade) - Number(b.grade) || (a.name ?? '').localeCompare(b.name ?? ''));
      // One register per centre, shift and round: marks already saved for it open pre-filled so this save updates the same register.
      const savedForShift = new Map([...existing].filter(([enrolment]) => inShift.some(s => s.enrolment === enrolment)));
      setRoster(inShift); setSaved(savedForShift); setEntered(initialEntries(inShift, savedForShift)); setLoad('ready');
    } catch (e) { if (run === sequence.current) { setError(messageOf(e)); setLoad('error'); } }
  };
  // Editing opens the roster straight away.
  useEffect(() => { if (edit) void start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (status !== 'ready' || !mapped) return;
    let rows;
    try { rows = buildScores(roster, entered, saved, date, mapped.definitionId); } catch (e) { setError(messageOf(e)); return; }
    setError(''); setStatus('saving');
    try { await service.save(rows); } catch (e) { setError(messageOf(e)); setStatus('ready'); return; }
    setStatus('committed');
    try { await onSaved(t('assessment.savedCount', {count: rows.length, round: mapped.label})); }
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
          <DialogTitle>{step === 'start' ? t('assessment.start') : t(edit ? 'assessment.editMarks' : 'assessment.enterMarks', {round: mapped?.label ?? ''})}</DialogTitle>
          <DialogDescription id="entry-help">{step === 'start' ? t('assessment.startHelp') : t('assessment.rosterHelp', {centre: centreLabel, date: `${shift} · ${date}`})}</DialogDescription>
        </div>
        {enabled ? null : <p role="status" className="rounded-md bg-warn-soft p-3 text-sm text-warn">{t('common.activationPending')}</p>}
        {step === 'start' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <CentreCombobox label={t('assessment.centreVillage')} value={centre} options={centres} disabled={centres.length === 1} onChange={setCentre} />
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">{t('common.shift')}
                <select value={shift} onChange={event => setShift(event.target.value)} className="min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink"><option value="Morning">{english('common.morning')}</option><option value="Evening">{english('common.evening')}</option></select>
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
                    <thead><tr>
                      <th scope="col" className="sticky top-0 bg-brand-soft px-3 py-2 text-left">{t('common.grade')}</th>
                      <th scope="col" className="sticky top-0 bg-brand-soft px-3 py-2 text-left">{t('assessment.studentName')}</th>
                      <th scope="col" className="sticky top-0 bg-brand-soft px-3 py-2 text-left">{t('common.gender')}</th>
                      <th scope="col" className="sticky top-0 bg-brand-soft px-3 py-2 text-left">{t('assessment.marksHeader', {max: MAX_SCORE})}</th>
                    </tr></thead>
                    <tbody>
                      {shown.map(s => (
                        <tr key={s.enrolment} className="odd:bg-white even:bg-paper">
                          <td className="border-b border-line px-3 py-1">{s.grade}</td>
                          <td className="border-b border-line px-3 py-1">{s.name || t('common.nameMissing')}</td>
                          <td className="border-b border-line px-3 py-1">{s.gender ?? t('common.unknown')}</td>
                          <td className="border-b border-line px-3 py-1"><Input type="number" inputMode="decimal" min={0} max={MAX_SCORE} step="any" aria-label={t('assessment.marksFor', {student: s.name || s.studentId})} value={entered[s.enrolment] ?? ''} disabled={busy} onChange={event => setEntered(v => ({...v, [s.enrolment]: event.target.value}))} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted">{t('assessment.blankHelp', {date})}</p>
                {saved.size > 0 ? <p className="mt-1 text-xs text-muted">{t('assessment.existingRegister', {round: mapped?.label ?? ''})}</p> : null}
              </div>
            )}
          </AsyncState>
        )}
        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-bad">{load === 'error' && step === 'roster' ? '' : error}</p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {edit && onDelete ? <Button variant="outline" className="mr-auto border-bad text-bad" onClick={onDelete} disabled={status === 'saving'}>{t('common.delete')}</Button> : null}
          <Button variant="outline" onClick={onClose} disabled={status === 'saving'}>{t('common.cancel')}</Button>
          {step === 'start'
            ? <Button onClick={() => void start()} disabled={!preview.round}>{t('common.continue')}</Button>
            : <Button onClick={() => void submit()} disabled={!enabled || busy || load !== 'ready' || roster.length === 0}>{t(status === 'saving' ? 'common.saving' : 'assessment.save')}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
