import {useState, type FormEvent} from 'react';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';
import {Card} from '../components/ui/card';

export function SignIn({message, onSignIn}: {message?: string; onSignIn: (email: string, password: string) => Promise<void>}) {
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
        <h1 className="text-2xl font-bold">MASS CAC Dashboard</h1>
        <p className="text-sm text-muted">Sign in to your authorised programme workspace.</p>
        <form onSubmit={submit} className="space-y-4">
          <div><label htmlFor="email" className="mb-1 block text-sm font-semibold">Email</label><Input id="email" name="email" type="email" autoComplete="username" required /></div>
          <div><label htmlFor="password" className="mb-1 block text-sm font-semibold">Password</label><Input id="password" name="password" type="password" autoComplete="current-password" required /></div>
          <p role="alert" aria-live="polite" className="min-h-5 text-sm text-bad">{message ?? ''}</p>
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
        <p className="text-xs text-muted">Access is limited to verified staff assignments. Contact the administrator if you need an account or centre access.</p>
      </Card>
    </main>
  );
}
