import {useEffect, useRef, useState, type FormEvent} from 'react';
import {AsyncState} from '../components/AsyncState';
import {Button} from '../components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '../components/ui/dialog';
import {Input} from '../components/ui/input';
import {useI18n} from '../i18n/I18n';
import type {MessageKey} from '../i18n/en';
import {CentreCombobox} from '../components/CentreCombobox';
import {
  AdministrationError, applicationRoles, type AdministrationCall, type AdministrationDirectory,
  type AdministrationResult, type AdministrationUser, type ApplicationRole,
} from './contracts';

const pageSize = 20;
const selectClass = 'min-h-11 rounded-md border border-line bg-white px-3';
const formatDate = (value: string) => new Intl.DateTimeFormat('en-IN', {dateStyle: 'medium', timeZone: 'Asia/Kolkata'}).format(new Date(value));
const roleLabels = {'Teacher': 'admin.teacher', 'Cluster Officer': 'admin.officer', 'Leadership': 'admin.leadership'} as const;
type Message = {key: MessageKey; error?: boolean};
type Change = {body: Record<string, string | number>; description: MessageKey; detail?: string};
type Centre = {id: string; label: string};

function RoleSelect({role, setRole}: {role: ApplicationRole; setRole: (role: ApplicationRole) => void}) {
  const {t} = useI18n();
  return <label className="grid gap-1 text-sm">{t('role.label')}
    <select className={selectClass} value={role} onChange={event => setRole(event.currentTarget.value as ApplicationRole)}>
      {applicationRoles.map(value => <option value={value} key={value}>{t(roleLabels[value])}</option>)}
    </select>
  </label>;
}

function AccountAccess({user, own, centres, selectChange}: {
  user: AdministrationUser; own: boolean; centres: Centre[]; selectChange: (change: Change) => void;
}) {
  const {t} = useI18n();
  const [role, setRole] = useState(user.role);
  const [centre, setCentre] = useState('');
  const subject = {subject: user.id, version: user.version};
  const active = user.assignments.filter(item => item.status === 'Active');
  const available = centres.filter(item => !active.some(assignment => assignment.centre === item.id));
  const roleConflict = (role === 'Leadership' && active.length > 0) || (role === 'Teacher' && active.length > 1);
  const canAssign = user.status === 'Active' && user.role !== 'Leadership' && (user.role !== 'Teacher' || active.length === 0);
  const ask = (action: string, description: MessageKey, fields: Record<string, string | number> = {}) =>
    selectChange({
      body: {action, id: crypto.randomUUID(), ...subject, ...fields}, description,
      detail: [
        user.email ?? t('admin.noEmail'),
        action === 'role' ? t(roleLabels[user.role]) + ' → ' + t(roleLabels[role]) : undefined,
        action === 'assign' ? available.find(item => item.id === centre)?.label : undefined,
        action === 'unassign' ? active.find(item => item.id === fields.assignment)?.label : undefined,
      ].filter(Boolean).join(' · '),
    });
  return <section className="space-y-4 rounded-lg border border-line bg-white p-4">
    <div>
      <h2 className="text-lg font-semibold">{user.email ?? t('admin.noEmail')}</h2>
      <p>{t(roleLabels[user.role])} · {t(user.status === 'Active' ? 'admin.active' : 'admin.inactive')}</p>
    </div>
    {user.pending ? <div className="space-y-2">
      <p role="status">{t(user.pending.action === 'deactivate' ? 'admin.pendingDeactivation' : 'admin.pendingReactivation')}</p>
      <Button onClick={() => selectChange({body: {action: 'retry', id: user.pending!.id}, description: 'admin.confirmRetry'})}>{t('admin.retryAuth')}</Button>
    </div> : !own && <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <RoleSelect role={role} setRole={setRole} />
        <Button variant="outline" disabled={role === user.role || roleConflict} onClick={() => ask('role', 'admin.confirmRole', {role})}>{t('admin.changeRole')}</Button>
        <Button variant="outline"
          onClick={() => user.status === 'Active' ? ask('deactivate', 'admin.confirmDeactivate') : ask('reactivate', 'admin.confirmReactivate')}>
          {t(user.status === 'Active' ? 'admin.deactivate' : 'admin.reactivate')}
        </Button>
      </div>
      {roleConflict && <p>{t('admin.assignmentsConflict')}</p>}
    </div>}
    <div className="space-y-2">
      <h3 className="font-semibold">{t('admin.assignments')}</h3>
      {user.assignments.length === 0 && <p>{t('admin.noAssignments')}</p>}
      {user.assignments.length > 0 && <ul className="divide-y divide-line">
        {user.assignments.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span><strong>{item.label}</strong> · {t(item.status === 'Active' ? 'admin.active' : 'admin.inactive')} · {formatDate(item.startsAt)}{item.endsAt ? ' – ' + formatDate(item.endsAt) : ''}</span>
          {!user.pending && item.status === 'Active' && <Button variant="outline" onClick={() => ask('unassign', 'admin.confirmUnassign', {assignment: item.id, assignmentVersion: item.version})}>{t('admin.endAssignment')}</Button>}
        </li>)}
      </ul>}
      {!user.pending && canAssign && available.length > 0 && <div className="flex flex-wrap items-end gap-2">
        <CentreCombobox label={t('admin.centre')} value={centre} options={available} allLabel={t('admin.chooseCentre')} onChange={setCentre} />
        <Button disabled={!centre} onClick={() => ask('assign', 'admin.confirmAssign', {centre})}>{t('admin.addAssignment')}</Button>
      </div>}
    </div>
  </section>;
}

export function UserAdministration({call, actor, centres}: {call?: AdministrationCall; actor: string; centres: Centre[]}) {
  const {t} = useI18n();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [revision, refresh] = useState(0);
  const [directory, setDirectory] = useState<AdministrationDirectory>();
  const [loadFailure, setLoadFailure] = useState<MessageKey>();
  const [selected, setSelected] = useState<string>();
  const [enrol, setEnrol] = useState<'invite' | 'link'>();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ApplicationRole>('Teacher');
  const [change, setChange] = useState<Change>();
  const [message, setMessage] = useState<Message>();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    let current = true;
    setLoadFailure(undefined);
    setDirectory(undefined);
    if (!call) {
      setLoadFailure('admin.unavailable');
      return;
    }
    void call<AdministrationDirectory>({action: 'directory', search: filter, offset}).then(result => {
      if (current) setDirectory(result);
    }).catch(error => {
      if (current) setLoadFailure(error instanceof AdministrationError && error.code === 'forbidden' ? 'admin.forbidden' : 'admin.unavailable');
    });
    return () => { current = false; };
  }, [call, filter, offset, revision]);
  const user = directory?.users.find(item => item.id === selected);
  function searchUsers(event: FormEvent) {
    event.preventDefault();
    setOffset(0);
    setFilter(search.trim());
  }
  function prepareEnrolment(event: FormEvent) {
    event.preventDefault();
    if (enrol) {
      setChange({body: {action: enrol, email, role, id: crypto.randomUUID()},
        description: enrol === 'invite' ? 'admin.confirmInvite' : 'admin.confirmLink', detail: email + ' · ' + t(roleLabels[role])});
    }
  }
  async function confirm() {
    if (!call || !change || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await call<AdministrationResult>(change.body);
      const completed = response.state === 'complete';
      const key = completed ? 'admin.saved' : response.state === 'retry' ? 'admin.authRetry' : 'admin.inviteReview';
      setMessage({key, error: !completed});
      setChange(undefined);
      if (completed) { setEnrol(undefined); setEmail(''); }
      refresh(value => value + 1);
    } catch (error) {
      const code = error instanceof AdministrationError ? error.code : '';
      const key = code === 'assignments_conflict' ? 'admin.assignmentsConflict'
        : code === 'conflict' ? 'admin.conflict'
        : code === 'forbidden' ? 'admin.forbidden'
        : code === 'invalid_request' ? 'admin.invalid' : 'admin.unavailable';
      setMessage({key, error: true});
      if (key !== 'admin.unavailable') { setChange(undefined); refresh(value => value + 1); }
    } finally { inFlight.current = false; setBusy(false); }
  }
  if (loadFailure) return <AsyncState state="error" errorMessage={t(loadFailure)} onRetry={() => refresh(value => value + 1)} />;
  return <div className="max-w-5xl space-y-4">
    {message && !change && <p role={message.error ? 'alert' : 'status'}>{t(message.key)}</p>}
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => { setEnrol('invite'); setEmail(''); setRole('Teacher'); }}>{t('admin.invite')}</Button>
      <Button variant="outline" onClick={() => { setEnrol('link'); setEmail(''); setRole('Teacher'); }}>{t('admin.link')}</Button>
    </div>
    {enrol && <form onSubmit={prepareEnrolment} className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-white p-4">
      <label className="grid gap-1 text-sm">{t('signin.email')}<Input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.currentTarget.value)} /></label>
      <RoleSelect role={role} setRole={setRole} />
      <Button type="submit">{t(enrol === 'invite' ? 'admin.invite' : 'admin.link')}</Button>
      <Button variant="outline" type="button" onClick={() => setEnrol(undefined)}>{t('admin.cancel')}</Button>
    </form>}
    {directory?.pendingInvites.map(item => <div className="flex flex-wrap items-center gap-2" key={item.id}>
      <span>{t('admin.pendingInvite')} · {item.email}</span>
      <Button variant="outline" onClick={() => setChange({body: {action: 'retry', id: item.id}, description: 'admin.confirmRetry'})}>{t('admin.retryAuth')}</Button>
    </div>)}
    <form onSubmit={searchUsers} className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-sm">{t('admin.searchEmail')}<Input type="search" value={search} maxLength={254} onChange={event => setSearch(event.currentTarget.value)} /></label>
      <Button type="submit" variant="outline">{t('admin.search')}</Button>
    </form>
    {!directory ? <AsyncState state="loading" /> : <>
      {!directory.users.length && <p>{t('admin.noUsers')}</p>}
      <ul className="divide-y divide-line rounded-lg border border-line bg-white px-3">
        {directory.users.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span>{item.email ?? t('admin.noEmail')} · {t(roleLabels[item.role])} · {t(item.status === 'Active' ? 'admin.active' : 'admin.inactive')}{item.email && !item.emailConfirmed ? ' · ' + t('admin.invited') : ''}</span>
          <Button variant="outline" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{t('admin.viewAccount')}</Button>
        </li>)}
      </ul>
      {(offset > 0 || directory.more) && <div className="flex gap-2">
        <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(value => value - pageSize)}>{t('admin.previous')}</Button>
        <Button variant="outline" disabled={!directory.more} onClick={() => setOffset(value => value + pageSize)}>{t('admin.next')}</Button>
      </div>}
      {user && <AccountAccess key={user.id + ':' + user.version} user={user} own={user.id === actor} centres={centres} selectChange={setChange} />}
    </>}
    <Dialog open={Boolean(change)} onOpenChange={open => { if (!open && !busy) setChange(undefined); }}>
      {change && <DialogContent onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogTitle>{t('admin.confirm')}</DialogTitle>
        <DialogDescription>{t(change.description)}</DialogDescription>
        {change.detail && <p className="break-words font-medium">{change.detail}</p>}
        {message?.error && <p role="alert">{t(message.key)}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void confirm()}>{t(busy ? 'admin.working' : 'admin.confirm')}</Button>
          <Button variant="outline" disabled={busy} onClick={() => setChange(undefined)}>{t('admin.cancel')}</Button>
        </div>
      </DialogContent>}
    </Dialog>
  </div>;
}
