export function createSessionController(client, {onState, onReset, clearStoredSession = () => {}}) {
  let generation = 0, stopped = false, subscription;
  async function verify(session) {
    const epoch = ++generation;
    onReset();
    if (!session) { clearStoredSession(); onState({status: 'signed-out'}); return; }
    onState({status: 'checking'});
    try {
      // getSession alone trusts browser storage. Verify the identity with Auth.
      const {data, error} = await client.auth.getUser();
      if (epoch !== generation || stopped) return;
      if (error || !data?.user || data.user.id !== session.user?.id) {
        await client.auth.signOut({scope: 'local'});
        clearStoredSession();
        if (epoch === generation) onState({status: 'signed-out', message: 'Your session has ended. Sign in again.'});
        return;
      }
      onState({status: 'signed-in', user: {id: data.user.id}});
    } catch {
      if (epoch === generation && !stopped) {
        clearStoredSession();
        onState({status: 'signed-out', message: 'Unable to verify your session. Sign in again.'});
      }
    }
  }
  return {
    async start() {
      subscription = client.auth.onAuthStateChange((event, session) => {
        // Never await Supabase work inside its auth callback lock.
        queueMicrotask(() => { if (!stopped) void verify(session); });
      }).data.subscription;
      const {data, error} = await client.auth.getSession();
      if (error) return verify(null);
      return verify(data.session);
    },
    async signIn(email, password) {
      const {data, error} = await client.auth.signInWithPassword({email: email.trim(), password});
      if (error) throw new Error('Unable to sign in. Check your credentials and account access.');
      await verify(data.session);
    },
    async signOut() {
      ++generation; onReset(); onState({status: 'checking', message: 'Signing out…'});
      // Clear this shared-browser tab even if provider logout is unavailable.
      let error;
      try { ({error} = await client.auth.signOut({scope: 'local'})); }
      catch { error = true; }
      clearStoredSession();
      onState({status: 'signed-out', ...(error?{message: 'Signed out locally. Contact the administrator if you need other sessions revoked.'}:{})});
    },
    stop() { stopped = true; ++generation; onReset(); subscription?.unsubscribe(); },
  };
}
