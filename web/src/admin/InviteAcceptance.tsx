import {useState, type FormEvent} from 'react';
import {createClient} from '@supabase/supabase-js';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';
import {LanguageToggle, useI18n} from '../i18n/I18n';
import type {RuntimeConfig} from '../session/backend';

export function takeInviteToken(location: Location, history: History) {
  if (!location.hash.startsWith('#invite?')) return;
  const token = new URLSearchParams(location.hash.slice('#invite?'.length)).get('token_hash') ?? '';
  history.replaceState(null, '', location.pathname);
  return token.length <= 256 ? token : '';
}

export function InviteAcceptance({config, token, onExit}: {config: RuntimeConfig; token: string; onExit: (saved: boolean) => void}) {
  const {t} = useI18n();
  const [client] = useState(() => createClient(config.url!, config.publishableKey!, {
    auth: {persistSession:false, autoRefreshToken:false, detectSessionInUrl:false},
  }));
  const [password, setPassword] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(!token);
  async function accept(event: FormEvent) {
    event.preventDefault();
    if (busy || !token) return;
    setBusy(true);
    setError(false);
    try {
      if (!verified) {
        const {data, error} = await client.auth.verifyOtp({type:'invite', token_hash:token});
        if (error || !data.session) throw new Error('Invalid invite.');
        setVerified(true);
      }
      const {error} = await client.auth.updateUser({password});
      if (error) throw error;
      await client.auth.signOut({scope:'local'}).catch(() => {});
      onExit(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return <main className="mx-auto max-w-md space-y-4 p-6">
    <LanguageToggle />
    <h1 className="text-xl font-bold">{t('invite.title')}</h1>
    {error && <p role="alert">{t('invite.failed')}</p>}
    <form onSubmit={event => void accept(event)} className="grid gap-3">
      <label className="grid gap-1">{t('invite.password')}
        <Input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={event => setPassword(event.currentTarget.value)} />
      </label>
      <Button type="submit" disabled={busy || !token}>{t(busy ? 'admin.working' : 'invite.save')}</Button>
      <Button variant="outline" disabled={busy} onClick={() => onExit(false)}>{t('invite.back')}</Button>
    </form>
  </main>;
}
