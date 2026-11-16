import {createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode} from 'react';
import type {SessionController, SessionState} from './controller';

const Ctx = createContext<SessionController | null>(null);

export function SessionProvider({controller, children}: {controller: SessionController; children: ReactNode}) {
  useEffect(() => {
    void controller.start();
    const onVisible = () => { if (document.visibilityState === 'visible') void controller.verify(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); controller.dispose(); };
  }, [controller]);
  return <Ctx.Provider value={controller}>{children}</Ctx.Provider>;
}

export function useSession(): {state: SessionState; controller: SessionController} {
  const controller = useContext(Ctx);
  if (!controller) throw new Error('useSession must be used inside SessionProvider.');
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  return useMemo(() => ({state, controller}), [state, controller]);
}
