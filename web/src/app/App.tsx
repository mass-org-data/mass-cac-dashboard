import {useMemo} from 'react';
import {SessionProvider, useSession} from '../session/SessionProvider';
import {createSessionController} from '../session/controller';
import {createLiveBackend, type LiveBackend, type RuntimeConfig} from '../session/backend';
import {AsyncState} from '../components/AsyncState';
import {Button} from '../components/ui/button';
import {SignIn} from '../pages/SignIn';
import {Overview} from '../pages/Overview';
import {Attendance} from '../pages/Attendance';
import {Profiles} from '../pages/Profiles';
import {Assessments} from '../pages/Assessments';
import {Visits} from '../pages/Visits';
import {ROUTES, useRoute} from './route';

function Shell({backend}: {backend: LiveBackend}) {
  const {state, controller} = useSession();
  const [route, go] = useRoute();
  if (state.status === 'loading') return <main className="mx-auto max-w-3xl p-6"><AsyncState state="loading" loadingLabel="Checking your session" /></main>;
  if (state.status === 'error') return <main className="mx-auto max-w-3xl p-6"><AsyncState state="error" errorMessage={state.message} onRetry={() => void controller.start()} /></main>;
  if (state.status === 'signed-out') return <SignIn message={state.message} onSignIn={(email, password) => controller.signIn(email, password)} />;
  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <img src="../mass-logo.jpg" alt="MASS" className="h-10 w-auto" />
          <strong className="text-brand-dark">Children’s Activity Centres</strong>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state.roles.length > 1 ? (
            <label className="flex items-center gap-2 text-sm">
              <span className="font-semibold">Role</span>
              <select className="min-h-11 rounded-md border border-line bg-white px-2" value={state.activeRole} onChange={event => controller.selectRole(event.target.value)}>
                {state.roles.map(role => <option key={role}>{role}</option>)}
              </select>
            </label>
          ) : <span className="text-sm font-semibold">{state.activeRole}</span>}
          <Button variant="outline" onClick={() => void controller.signOut()}>Sign out</Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 p-4">
        <div role="note" className="rounded-md bg-warn-soft p-4 text-sm text-warn">
          Preview of the new interface: only the Overview, Attendance, Student profiles, Assessments and Visits are built so far. <a className="font-semibold underline" href="../">Use the standard application for everything else</a>.
        </div>
        <nav aria-label="Primary" className="flex flex-wrap gap-2">
          {ROUTES.map(item => <a key={item.id} href={`#/${item.id}`} aria-current={route === item.id ? 'page' : undefined} onClick={event => { event.preventDefault(); go(item.id); }} className={`inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold ${route === item.id ? 'bg-brand-dark text-white' : 'border border-line bg-white text-ink hover:bg-brand-soft'}`}>{item.number} {item.label}</a>)}
        </nav>
        <h1 className="text-2xl font-bold"><span className="mr-1 text-base font-bold text-brand-dark">{ROUTES.find(r => r.id === route)!.number}</span>{ROUTES.find(r => r.id === route)!.label}</h1>
        {route === 'attendance'
          ? <Attendance backend={backend} context={state.context} role={state.activeRole} key={`a-${state.activeRole}`} />
          : route === 'profiles'
          ? <Profiles backend={backend} context={state.context} role={state.activeRole} key={`p-${state.activeRole}`} />
          : route === 'visits'
          ? <Visits backend={backend} context={state.context} role={state.activeRole} key={`v-${state.activeRole}`} />
          : route === 'assessments'
          ? <Assessments backend={backend} context={state.context} role={state.activeRole} key={`s-${state.activeRole}`} />
          : <Overview backend={backend} context={state.context} role={state.activeRole} key={`o-${state.activeRole}`} />}
      </main>
    </div>
  );
}

export function App({config}: {config: RuntimeConfig}) {
  const {backend, controller} = useMemo(() => {
    const live = createLiveBackend(config);
    return {backend: live, controller: createSessionController(live)};
  }, [config]);
  return <SessionProvider controller={controller}><Shell backend={backend} /></SessionProvider>;
}
