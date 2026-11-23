import {useState, type FormEvent} from 'react';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';
import {Card} from '../components/ui/card';
import {LanguageToggle, useI18n} from '../i18n/I18n';

export function SignIn({message, onSignIn}: {message?: string; onSignIn: (email: string, password: string) => Promise<void>}) {
  const {t} = useI18n();
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try { await onSignIn(String(form.get('email') ?? ''), String(form.get('password') ?? '')); } finally { setBusy(false); }
  };
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full space-y-4 p-6">
        <div className="flex justify-end"><LanguageToggle /></div>
        <h1 className="text-2xl font-bold">{t('app.name')}</h1>
        <p className="text-sm text-muted">{t('signin.intro')}</p>
        <form onSubmit={submit} className="space-y-4">
          <div><label htmlFor="email" className="mb-1 block text-sm font-semibold">{t('signin.email')}</label><Input id="email" name="email" type="email" autoComplete="username" required /></div>
          <div><label htmlFor="password" className="mb-1 block text-sm font-semibold">{t('signin.password')}</label><Input id="password" name="password" type="password" autoComplete="current-password" required /></div>
          <p role="alert" aria-live="polite" className="min-h-5 text-sm text-bad">{message ?? ''}</p>
          <Button type="submit" disabled={busy} className="w-full">{t(busy ? 'signin.submitting' : 'signin.submit')}</Button>
        </form>
        <p className="text-xs text-muted">{t('signin.access')}</p>
      </Card>
    </main>
  );
}
