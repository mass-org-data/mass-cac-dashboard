import {useEffect, useMemo, useRef, useState} from 'react';
import {Button} from '../components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '../components/ui/dialog';
import {Input} from '../components/ui/input';
import {assignmentFor, emptyVisit, newId, validateVisit, type VisitForm} from './editor';
import type {Assignment, Conductor, VisitsService} from './service';
import {useI18n} from '../i18n/I18n';
import {english} from '../components/FilterPanel';
import {CentreCombobox} from '../components/CentreCombobox';

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'The request could not be completed.');
const selectClass = 'min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink';
const labelClass = 'flex flex-col gap-1 text-xs font-semibold text-muted';

interface Props {service: VisitsService; assignments: Assignment[]; centres: Array<{id: string; label: string}>; initialCentre: string; initialShift: string; today: string; enabled: boolean; onSaved: (message: string) => Promise<void> | void; onClose: () => void}

export function VisitDialog({service, assignments, centres, initialCentre, initialShift, today, enabled, onSaved, onClose}: Props) {
  const {t} = useI18n();
  const [form, setForm] = useState<VisitForm>(() => emptyVisit(initialCentre, initialShift, today));
  const [error, setError] = useState('');
  const [conductors, setConductors] = useState<Conductor[] | null>(null);
  const [conductedBy, setConductedBy] = useState('');
  const [status, setStatus] = useState<'ready' | 'saving' | 'committed'>('ready');
  const id = useRef(newId());
  const set = (field: keyof VisitForm, value: string) => setForm(f => ({...f, [field]: value}));
  const busy = status !== 'ready';
  useEffect(() => { let live = true; service.conductors(centres.map(c => c.id)).then(rows => { if (live) setConductors(rows); }).catch(() => { if (live) setConductors(null); }); return () => { live = false; }; }, [service, centres]);
  // Every Leadership user, plus the Cluster Officer assigned to the chosen centre.
  const choices = useMemo(() => (conductors ?? []).filter(c => c.centre_id === null || c.centre_id === form.centre), [conductors, form.centre]);
  useEffect(() => { if (conductedBy && !choices.some(c => c.user_id === conductedBy)) setConductedBy(''); }, [choices, conductedBy]);

  const submit = async () => {
    if (busy) return;
    const problem = validateVisit(form, today, assignments);
    if (problem) { setError(problem); return; }
    setError(''); setStatus('saving');
    const assignment = assignmentFor(assignments, form.centre, form.date)[0]!;
    try { await service.record({id: id.current, assignment: assignment.id, shift: form.shift, date: form.date, status: form.status, feedback: form.feedback, nextAction: form.nextAction, conductedBy: conductedBy || null}); }
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
          <DialogTitle>{t('visit.record')}</DialogTitle>
          <DialogDescription id="visit-help">{t('visit.help')}</DialogDescription>
        </div>
        {enabled ? null : <p role="status" className="rounded-md bg-warn-soft p-3 text-sm text-warn">{t('common.activationPending')}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <CentreCombobox label={t('common.centre')} value={form.centre} options={centres} disabled={busy || centres.length === 1} onChange={value => set('centre', value)} />
          <label className={labelClass}>{t('common.shift')}
            <select value={form.shift} disabled={busy} onChange={event => set('shift', event.target.value)} className={selectClass}><option value="Morning">{english('common.morning')}</option><option value="Evening">{english('common.evening')}</option></select>
          </label>
          <label className={labelClass}>{t('visit.date')}<Input type="date" value={form.date} disabled={busy} onChange={event => set('date', event.target.value)} /></label>
          {conductors !== null ? (
            <label className={labelClass}>{t('visit.conductedBy')}
              <select value={conductedBy} disabled={busy} onChange={event => setConductedBy(event.target.value)} className={selectClass}><option value="">{t('visit.conductedByMe')}</option>{choices.map(c => <option key={`${c.user_id}|${c.centre_id}`} value={c.user_id}>{c.label} ({c.role_code === 'Leadership' ? t('visit.roleLeadership') : t('visit.roleClusterOfficer')})</option>)}</select>
            </label>
          ) : null}
          <label className={labelClass}>{t('visit.status')}
            <select value={form.status} disabled={busy} onChange={event => set('status', event.target.value)} className={selectClass}><option value="Planned">{t('visit.planned')}</option><option value="Completed">{t('visit.completed')}</option></select>
          </label>
        </div>
        <label className={labelClass}>{t('visit.feedback')}<textarea rows={3} maxLength={2000} value={form.feedback} disabled={busy} onChange={event => set('feedback', event.target.value)} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-normal text-ink" /></label>
        <label className={labelClass}>{t('visit.nextAction')}<textarea rows={2} maxLength={2000} value={form.nextAction} disabled={busy} onChange={event => set('nextAction', event.target.value)} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-normal text-ink" /></label>
        <p role="alert" aria-live="polite" className="min-h-5 text-sm text-bad">{error}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={status === 'saving'}>{t('common.cancel')}</Button>
          <Button onClick={() => void submit()} disabled={!enabled || busy}>{t(status === 'saving' ? 'common.saving' : 'visit.save')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
