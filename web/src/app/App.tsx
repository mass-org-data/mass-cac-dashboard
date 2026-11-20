import {useCallback, useEffect, useMemo, useState} from 'react';
import {Menu} from 'lucide-react';
import {SessionProvider, useSession} from '../session/SessionProvider';
import {createSessionController} from '../session/controller';
import {createLiveBackend, type LiveBackend, type RuntimeConfig} from '../session/backend';
import {AsyncState} from '../components/AsyncState';
import {SignIn} from '../pages/SignIn';
import {Overview} from '../pages/Overview';
import {Attendance} from '../pages/Attendance';
import {Profiles} from '../pages/Profiles';
import {Assessments} from '../pages/Assessments';
import {Visits} from '../pages/Visits';
import {Morarji} from '../pages/Morarji';
import {AnnualDonor} from '../pages/AnnualDonor';
import {About} from '../pages/About';
import {ROUTES, useRoute} from './route';
import {SideMenu} from './SideMenu';
import {I18nProvider, LanguageToggle, useI18n, type Language} from '../i18n/I18n';
import {UserMenu} from './UserMenu';

const MENU_KEY = 'mass-menu-collapsed';
// Only a convenience: the menu works the same when browser storage is blocked.
const readCollapsed = () => { try { return window.localStorage.getItem(MENU_KEY) === '1'; } catch { return false; } };
const writeCollapsed = (value: boolean) => { try { window.localStorage.setItem(MENU_KEY, value ? '1' : '0'); } catch { /* ignore */ } };

function Shell({backend}: {backend: LiveBackend}) {
  const {state, controller} = useSession();
  const {setLanguage, t} = useI18n();
  const [route, go] = useRoute();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleCollapsed = useCallback(() => setCollapsed(value => { writeCollapsed(!value); return !value; }), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  useEffect(() => { if (state.status === 'ready') setLanguage(state.defaultLanguage); }, [setLanguage, state.status, state.status === 'ready' ? state.userId : '', state.status === 'ready' ? state.defaultLanguage : '']);
  useEffect(() => { const item = ROUTES.find(r => r.id === route); document.title = `${item ? t(item.labelKey) : ''} · ${t('app.centres')}`; }, [route, t]);
  if (state.status === 'loading') return <main className="mx-auto max-w-3xl p-6"><AsyncState state="loading" loadingLabel={t('session.checking')} /></main>;
  if (state.status === 'error') return <main className="mx-auto max-w-3xl p-6"><AsyncState state="error" errorMessage={t(state.messageKey)} onRetry={() => void controller.start()} /></main>;
  if (state.status === 'signed-out') return <SignIn message={state.messageKey ? t(state.messageKey) : state.message} onSignIn={(email, password) => controller.signIn(email, password)} />;
  const currentRoute = ROUTES.find(r => r.id === route)!;
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <button type="button" aria-label={t('menu.open')} aria-expanded={mobileOpen} aria-controls="side-menu" onClick={() => setMobileOpen(true)} className="inline-flex size-11 items-center justify-center rounded-md border border-line md:hidden"><Menu aria-hidden="true" className="size-5" /></button>
          <img src="./mass-logo.jpg" alt="MASS" className="h-14 w-auto sm:h-[4.5rem]" />
          <strong className="text-brand-dark">{t('app.centres')}</strong>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{state.role}</span>
          <LanguageToggle compact />
          <UserMenu email={state.email} defaultLanguage={state.defaultLanguage} onSaveLanguage={controller.setDefaultLanguage} onSignOut={controller.signOut} />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <SideMenu role={state.role} capabilities={state.context.capabilities} route={route} onNavigate={go} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} mobileOpen={mobileOpen} onCloseMobile={closeMobile} legacyHref="./vanilla/" />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="w-full space-y-6 p-4 md:p-6">
          <h1 className="text-2xl font-bold text-ink">{currentRoute.number}. {t(currentRoute.labelKey)}</h1>
        {route === 'attendance'
          ? <Attendance backend={backend} context={state.context} role={state.role} key={`a-${state.role}`} />
          : route === 'profiles'
          ? <Profiles backend={backend} context={state.context} role={state.role} key={`p-${state.role}`} />
          : route === 'about'
          ? <About context={state.context} role={state.role} />
          : route === 'donors'
          ? <AnnualDonor backend={backend} context={state.context} role={state.role} key={`d-${state.role}`} />
          : route === 'morarji'
          ? <Morarji backend={backend} context={state.context} role={state.role} key={`m-${state.role}`} />
          : route === 'visits'
          ? <Visits backend={backend} context={state.context} role={state.role} key={`v-${state.role}`} />
          : route === 'assessments'
          ? <Assessments backend={backend} context={state.context} role={state.role} key={`s-${state.role}`} />
          : <Overview backend={backend} context={state.context} role={state.role} key={`o-${state.role}`} />}
          </div>
        </main>
      </div>
    </div>
  );
}

export function App({config}: {config: RuntimeConfig}) {
  const [language, setLanguage] = useState<Language>('en');
  const {backend, controller} = useMemo(() => {
    const live = createLiveBackend(config);
    const session = createSessionController(live);
    live.onAuthorizationFailure?.(() => { void session.signOut(); });
    return {backend: live, controller: session};
  }, [config]);
  return <I18nProvider language={language} setLanguage={setLanguage}><SessionProvider controller={controller}><Shell backend={backend} /></SessionProvider></I18nProvider>;
}
