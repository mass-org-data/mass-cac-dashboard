import {useEffect, useRef} from 'react';
import {BarChart3, BookOpen, CalendarDays, ExternalLink, Heart, Home, Info, MapPin, PanelLeftClose, PanelLeftOpen, Users, type LucideIcon} from 'lucide-react';
import {cn} from '../lib/utils';
import {ROUTES, type Route} from './route';
import {useI18n} from '../i18n/I18n';
import {en, type MessageKey} from '../i18n/en';
import type {ProgrammeCapabilities} from '../session/controller';

const ICONS: Record<Route, LucideIcon> = {overview: Home, attendance: CalendarDays, profiles: Users, assessments: BookOpen, visits: MapPin, morarji: BarChart3, donors: Heart, about: Info};

/** Every role sees all eight numbered screens so a number always means the same screen. A screen the role cannot use is
 *  shown greyed out and cannot be opened; `unavailableReason` says why (null means the role can open it). */
export const unavailableReasonKey = (_role: string, id: Route, capabilities?: ProgrammeCapabilities): MessageKey | null => {
  if (id === 'profiles' && capabilities?.read_profiles === false) return 'menu.profilesLeadership';
  if (id === 'donors' && capabilities?.export !== true) return 'menu.donorsLeadership';
  if (id === 'visits' && capabilities?.read_visits !== true) return 'menu.visitsTeacher';
  return null;
};
export const unavailableReason = (role: string, id: Route, capabilities?: ProgrammeCapabilities): string | null => { const key = unavailableReasonKey(role, id, capabilities); return key ? en[key] : null; };
export const itemsFor = (_role: string) => ROUTES;

interface Props {
  role: string;
  capabilities?: ProgrammeCapabilities;
  route: Route;
  onNavigate: (route: Route) => void;
  /** Desktop: icons only. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Phone: the menu slides over the page with a scrim. */
  mobileOpen: boolean;
  onCloseMobile: () => void;
  /** Where the original interface, which still holds Activities and monthly meetings, lives. */
  legacyHref: string;
}

export function SideMenu({role, capabilities, route, onNavigate, collapsed, onToggleCollapsed, mobileOpen, onCloseMobile, legacyHref}: Props) {
  const {t} = useI18n();
  const first = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    first.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseMobile(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, onCloseMobile]);

  const label = (text: string) => <span className={cn(collapsed && 'md:sr-only')}>{text}</span>;
  return (
    <>
      {mobileOpen ? <button type="button" aria-label={t('menu.close')} onClick={onCloseMobile} className="fixed inset-0 z-30 bg-ink/50 md:hidden" /> : null}
      <aside id="side-menu" aria-label={t('menu.label')} data-collapsed={collapsed} data-open={mobileOpen}
        className={cn('fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-line bg-white px-3 py-4 shadow-xl transition-transform data-[open=true]:translate-x-0',
          'md:static md:z-auto md:h-full md:translate-x-0 md:shadow-none md:transition-[width]', collapsed ? 'md:w-[4.5rem]' : 'md:w-64')}>
        <p className={cn('mb-3 px-3 text-xs font-bold uppercase tracking-[0.2em] text-muted', collapsed && 'md:sr-only')}>{t('menu.programme')}</p>
        <nav aria-label={t('menu.primary')} className="min-h-0 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {itemsFor(role).map(item => {
              const Icon = ICONS[item.id];
              const active = route === item.id;
              const reasonKey = unavailableReasonKey(role, item.id, capabilities);
              const itemLabel = t(item.labelKey);
              const reason = reasonKey ? t(reasonKey) : null;
              if (reason) return (
                <li key={item.id}>
                  <span aria-disabled="true" title={`${item.number}. ${itemLabel} - ${reason}`}
                    className={cn('flex min-h-11 cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-base font-semibold text-muted/50', collapsed && 'md:justify-center md:px-0')}>
                    <Icon aria-hidden="true" className="size-5 shrink-0" />
                    {label(`${item.number}. ${itemLabel}`)}
                    <span className="sr-only">({t('menu.unavailable', {reason})})</span>
                  </span>
                </li>
              );
              return (
                <li key={item.id}>
                  <a ref={item.id === 'overview' ? first : undefined} href={`#/${item.id}`} aria-current={active ? 'page' : undefined} title={collapsed ? `${item.number}. ${itemLabel}` : undefined}
                    onClick={event => { event.preventDefault(); onNavigate(item.id); onCloseMobile(); }}
                    className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-base font-semibold', collapsed && 'md:justify-center md:px-0', active ? 'bg-brand-soft text-brand-dark' : 'text-muted hover:bg-brand-soft hover:text-ink')}>
                    <Icon aria-hidden="true" className="size-5 shrink-0" />
                    {label(`${item.number}. ${itemLabel}`)}
                  </a>
                </li>
              );
            })}
          </ul>
          <ul className="mt-4 space-y-1 border-t border-line pt-4">
            <li>
              <a href={legacyHref} title={collapsed ? t('menu.activities') : undefined}
                className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-brand-soft hover:text-ink', collapsed && 'md:justify-center md:px-0')}>
                <ExternalLink aria-hidden="true" className="size-5 shrink-0" />
                {label(t('menu.activities'))}
              </a>
            </li>
          </ul>
        </nav>
        <button type="button" onClick={onToggleCollapsed} aria-expanded={!collapsed} aria-controls="side-menu"
          className={cn('mt-2 hidden shrink-0 min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-brand-soft hover:text-ink md:flex', collapsed && 'md:justify-center md:px-0')}>
          {collapsed ? <PanelLeftOpen aria-hidden="true" className="size-5 shrink-0" /> : <PanelLeftClose aria-hidden="true" className="size-5 shrink-0" />}
          <span className={cn(collapsed && 'sr-only')}>{t(collapsed ? 'menu.expand' : 'menu.collapse')}</span>
        </button>
      </aside>
    </>
  );
}
