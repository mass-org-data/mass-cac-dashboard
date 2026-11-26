import {useEffect, useState} from 'react';
import type {MessageKey} from '../i18n/en';

export type Route = 'overview' | 'attendance' | 'profiles' | 'assessments' | 'visits' | 'morarji' | 'donors' | 'about' | 'admin';
export const ROUTES: Array<{id: Route; /** Menu serial number; null for About, which closes the list without one. */ number: number | null; labelKey: MessageKey}> = [
  {id: 'overview', number: 1, labelKey: 'route.overview'},
  {id: 'profiles', number: 2, labelKey: 'route.profiles'},
  {id: 'attendance', number: 3, labelKey: 'route.attendance'},
  {id: 'assessments', number: 4, labelKey: 'route.assessments'},
  {id: 'visits', number: 5, labelKey: 'route.visits'},
  {id: 'morarji', number: 6, labelKey: 'route.morarji'},
  {id: 'donors', number: 7, labelKey: 'route.donors'},
  {id: 'admin', number: 8, labelKey: 'route.admin'},
  {id: 'about', number: null, labelKey: 'route.about'},
];

const parse = (hash: string): Route => ROUTES.find(r => r.id === hash.replace(/^#\/?/, ''))?.id ?? 'overview';

// Hash routes need no server rewrites and survive the strict CSP.
export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return [route, next => { window.location.hash = `#/${next}`; }];
}
