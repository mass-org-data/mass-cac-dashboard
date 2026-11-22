import {useEffect, useState} from 'react';
import type {MessageKey} from '../i18n/en';

export type Route = 'overview' | 'attendance' | 'profiles' | 'assessments' | 'visits' | 'morarji' | 'donors' | 'about' | 'admin';
export const ROUTES: Array<{id: Route; number: number; labelKey: MessageKey}> = [
  {id: 'overview', number: 1, labelKey: 'route.overview'},
  {id: 'attendance', number: 2, labelKey: 'route.attendance'},
  {id: 'profiles', number: 3, labelKey: 'route.profiles'},
  {id: 'assessments', number: 4, labelKey: 'route.assessments'},
  {id: 'visits', number: 5, labelKey: 'route.visits'},
  {id: 'morarji', number: 6, labelKey: 'route.morarji'},
  {id: 'donors', number: 7, labelKey: 'route.donors'},
  {id: 'about', number: 8, labelKey: 'route.about'},
  {id: 'admin', number: 9, labelKey: 'route.admin'},
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
