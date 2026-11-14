import {useEffect, useRef} from 'react';
import {BarChart3, BookOpen, CalendarDays, ExternalLink, Heart, Home, Info, MapPin, PanelLeftClose, PanelLeftOpen, Users, type LucideIcon} from 'lucide-react';
import {cn} from '../lib/utils';
import {ROUTES, type Route} from './route';

const ICONS: Record<Route, LucideIcon> = {overview: Home, attendance: CalendarDays, profiles: Users, assessments: BookOpen, visits: MapPin, morarji: BarChart3, donors: Heart, about: Info};

/** Which screens a role sees. Student profiles are private records, so Leadership (aggregate only) does not get that entry;
 *  the annual donor summary is Leadership reporting. Numbers stay fixed so a screen keeps the same number for everyone. */
export const itemsFor = (role: string) => ROUTES.filter(item => (item.id !== 'profiles' || role !== 'Leadership') && (item.id !== 'donors' || role === 'Leadership'));

interface Props {
  role: string;
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

export function SideMenu({role, route, onNavigate, collapsed, onToggleCollapsed, mobileOpen, onCloseMobile, legacyHref}: Props) {
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
      {mobileOpen ? <button type="button" aria-label="Close menu" onClick={onCloseMobile} className="fixed inset-0 z-30 bg-ink/50 md:hidden" /> : null}
      <aside id="side-menu" aria-label="Menu" data-collapsed={collapsed} data-open={mobileOpen}
        className={cn('fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-line bg-white px-3 py-4 shadow-xl transition-transform data-[open=true]:translate-x-0',
          'md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 md:self-start md:overflow-y-auto md:shadow-none md:transition-[width]', collapsed ? 'md:w-[4.5rem]' : 'md:w-64')}>
        <p className={cn('mb-3 px-3 text-xs font-bold uppercase tracking-[0.2em] text-muted', collapsed && 'md:sr-only')}>Programme</p>
        <nav aria-label="Primary" className="flex-1">
          <ul className="space-y-1">
            {itemsFor(role).map((item, index) => {
              const Icon = ICONS[item.id];
              const active = route === item.id;
              return (
                <li key={item.id}>
                  <a ref={index === 0 ? first : undefined} href={`#/${item.id}`} aria-current={active ? 'page' : undefined} title={collapsed ? `${item.number}. ${item.label}` : undefined}
                    onClick={event => { event.preventDefault(); onNavigate(item.id); onCloseMobile(); }}
                    className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-base font-semibold', collapsed && 'md:justify-center md:px-0', active ? 'bg-brand-soft text-brand-dark' : 'text-muted hover:bg-brand-soft hover:text-ink')}>
                    <Icon aria-hidden="true" className="size-5 shrink-0" />
                    {label(`${item.number}. ${item.label}`)}
                  </a>
                </li>
              );
            })}
          </ul>
          <ul className="mt-4 space-y-1 border-t border-line pt-4">
            <li>
              <a href={legacyHref} title={collapsed ? 'Activities and monthly meetings (standard application)' : undefined}
                className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-brand-soft hover:text-ink', collapsed && 'md:justify-center md:px-0')}>
                <ExternalLink aria-hidden="true" className="size-5 shrink-0" />
                {label('Activities and monthly meetings (standard application)')}
              </a>
            </li>
          </ul>
        </nav>
        <button type="button" onClick={onToggleCollapsed} aria-expanded={!collapsed} aria-controls="side-menu"
          className={cn('mt-4 hidden min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-brand-soft hover:text-ink md:flex', collapsed && 'md:justify-center md:px-0')}>
          {collapsed ? <PanelLeftOpen aria-hidden="true" className="size-5 shrink-0" /> : <PanelLeftClose aria-hidden="true" className="size-5 shrink-0" />}
          <span className={cn(collapsed && 'sr-only')}>{collapsed ? 'Expand menu' : 'Collapse menu'}</span>
        </button>
      </aside>
    </>
  );
}
