import {useMemo, useRef, useState} from 'react';
import {Button} from '../components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '../components/ui/dialog';
import {Input} from '../components/ui/input';
import {AsyncState} from '../components/AsyncState';
import {buildScores, mapRound, MAX_SCORE, validateStart, type Entered, type Mapped} from './editor';
import type {AssessmentsService, RosterStudent, SavedResult} from './service';
import type {References} from '../session/backend';

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'The request could not be completed.');
type Year = References['academic_years'][number];
interface Props {service: AssessmentsService; refs: References; year: Year; centres: Array<{id: string; label: string}>; initialCentre: string; today: string; enabled: boolean; onSaved: (message: string) => Promise<void> | void; onClose: () => void}

export function EntryDialog({service, refs, year, centres, initialCentre, today, enabled, onSaved, onClose}: Props) {
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
          <DialogTitle>{step === 'start' ? 'Start assessment entry' : `Enter ${mapped?.label} marks`}</DialogTitle>
          <DialogDescription id="entry-help">{step === 'start' ? 'Choose one centre and the observed assessment date. The date decides the round F1–F4 in the April–March year.' : `${centreLabel} · ${date} · one combined 25-mark assessment`}</DialogDescription>
        </div>
        {enabled ? null : <p role="status" className="rounded-md bg-warn-soft p-3 text-sm text-warn">This form is available for review. Saving is switched off until the workspace is activated. Operational activation pending. No record was changed.</p>}
        {step === 'start' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Centre / village
                <select value={centre} disabled={centres.length === 1} onChange={event => setCentre(event.target.value)} className="min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink">{centres.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Assessment date<Input type="date" value={date} min={year.starts_on} max={today} required onChange={event => setDate(event.target.value)} /></label>
            </div>
            <p role="status" aria-live="polite" className="text-sm">{preview.round ? `This date is in round ${preview.round}.` : preview.problem}</p>
            <p className="text-xs text-muted">One saved result is supported per child and round; retests need an approved data-model change.</p>
          </>
        ) : (
          <AsyncState state={load} loadingLabel="Loading students…" errorMessage={error} onRetry={() => void start()} rows={4}>
            {roster.length === 0 ? <p role="note" className="rounded-md bg-brand-soft p-3 text-sm">No students were enrolled in this centre on that date.</p> : (
              <div>
                <label className="mb-2 flex max-w-sm flex-col gap-1 text-xs font-semibold text-muted">Find a student by name or ID<Input type="search" value={filter} onChange={event => setFilter(event.target.value)} /></label>
                <div className="max-h-[40vh] overflow-auto rounded-md border border-line">
                  <table aria-label="Students to score" className="w-full border-collapse text-sm">
                    <thead><tr><th scope="col" className="sticky top-0 bg-brand-soft px-3 py-2 text-left">Student</th><th scope="col" className="sticky top-0 bg-brand-soft px-3 py-2 text-left">Marks /{MAX_SCORE} (blank = not recorded)</th></tr></thead>
                    <tbody>
                      {shown.map(s => {
                        const old = saved.get(s.enrolment);
                        return (
                          <tr key={s.enrolment} className="odd:bg-white even:bg-paper">
                            <td className="border-b border-line px-3 py-1">{s.name || 'Name not recorded'}<span className="block text-xs text-muted">{s.studentId} · Grade {s.grade} · {s.shift}{old ? ` · saved date: ${old.date ?? 'Unknown'}` : ''}</span></td>
                            <td className="border-b border-line px-3 py-1">
                              {old ? <span>{old.score} <span className="text-xs text-muted">(saved; corrections use their own approved workflow)</span></span>
                                : <Input type="number" inputMode="decimal" min={0} max={MAX_SCORE} step="any" aria-label={`Marks for ${s.name || s.studentId}`} value={entered[s.enrolment] ?? ''} disabled={busy} onChange={event => setEntered(v => ({...v, [s.enrolment]: event.target.value}))} />}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted">Existing results keep their original date. Blank fields never become zero. New results use {date}.</p>
              </div>
            )}
          </AsyncState>
        )}
        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-bad">{load === 'error' && step === 'roster' ? '' : error}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={status === 'saving'}>Cancel</Button>
          {step === 'start'
            ? <Button onClick={() => void start()} disabled={!preview.round}>Continue</Button>
            : <Button onClick={() => void submit()} disabled={!enabled || busy || load !== 'ready' || roster.length === 0}>{status === 'saving' ? 'Saving…' : 'Save assessment'}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
