import {useRef, useState} from 'react';
import {Button} from '../components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '../components/ui/dialog';
import {Input} from '../components/ui/input';
import {assignmentFor, emptyVisit, newId, validateVisit, type VisitForm} from './editor';
import type {Assignment, VisitsService} from './service';

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'The request could not be completed.');
const selectClass = 'min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink';
const labelClass = 'flex flex-col gap-1 text-xs font-semibold text-muted';

interface Props {service: VisitsService; assignments: Assignment[]; centres: Array<{id: string; label: string}>; initialCentre: string; initialShift: string; today: string; enabled: boolean; onSaved: (message: string) => Promise<void> | void; onClose: () => void}

export function VisitDialog({service, assignments, centres, initialCentre, initialShift, today, enabled, onSaved, onClose}: Props) {
  const [form, setForm] = useState<VisitForm>(() => emptyVisit(initialCentre, initialShift, today));
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'ready' | 'saving' | 'committed'>('ready');
  const id = useRef(newId());
  const set = (field: keyof VisitForm, value: string) => setForm(f => ({...f, [field]: value}));
  const busy = status !== 'ready';

  const submit = async () => {
    if (busy) return;
    const problem = validateVisit(form, today, assignments);
    if (problem) { setError(problem); return; }
    setError(''); setStatus('saving');
    const assignment = assignmentFor(assignments, form.centre, form.date)[0]!;
    try { await service.record({id: id.current, assignment: assignment.id, shift: form.shift, date: form.date, status: form.status, feedback: form.feedback, nextAction: form.nextAction}); }
    catch (e) { setError(messageOf(e)); setStatus('ready'); return; }
    setStatus('committed');
    try { await onSaved('Visit saved. The visit list has been refreshed.'); }
    catch { setError('The visit was saved, but refreshed data could not be loaded. Reload this page; do not submit again.'); return; }
    onClose();
  };
  return (
    <Dialog open onOpenChange={open => { if (!open && status !== 'saving') onClose(); }}>
      <DialogContent aria-describedby="visit-help" onInteractOutside={event => event.preventDefault()}>
        <div>
          <DialogTitle>Record a centre visit</DialogTitle>
          <DialogDescription id="visit-help">Two Morning and two Evening completed visits per assigned centre each calendar month. Do not include child names or household details in feedback.</DialogDescription>
        </div>
        {enabled ? null : <p role="status" className="rounded-md bg-warn-soft p-3 text-sm text-warn">This form is available for review. Saving is switched off until the workspace is activated. Operational activation pending. No record was changed.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>Centre
            <select value={form.centre} disabled={busy || centres.length === 1} onChange={event => set('centre', event.target.value)} className={selectClass}>{centres.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          </label>
          <label className={labelClass}>Shift
            <select value={form.shift} disabled={busy} onChange={event => set('shift', event.target.value)} className={selectClass}><option>Morning</option><option>Evening</option></select>
          </label>
          <label className={labelClass}>Visit date<Input type="date" value={form.date} disabled={busy} onChange={event => set('date', event.target.value)} /></label>
          <label className={labelClass}>Visit status
            <select value={form.status} disabled={busy} onChange={event => set('status', event.target.value)} className={selectClass}><option>Planned</option><option>Completed</option></select>
          </label>
        </div>
        <label className={labelClass}>Centre feedback<textarea rows={3} maxLength={2000} value={form.feedback} disabled={busy} onChange={event => set('feedback', event.target.value)} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-normal text-ink" /></label>
        <label className={labelClass}>Next action<textarea rows={2} maxLength={2000} value={form.nextAction} disabled={busy} onChange={event => set('nextAction', event.target.value)} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-normal text-ink" /></label>
        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-bad">{error}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={status === 'saving'}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={!enabled || busy}>{status === 'saving' ? 'Saving…' : 'Save visit'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
