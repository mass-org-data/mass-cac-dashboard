import {useEffect, useState} from 'react';

export type Route = 'overview' | 'attendance' | 'profiles' | 'assessments' | 'visits' | 'morarji' | 'donors' | 'about';
export const ROUTES: Array<{id: Route; number: number; label: string}> = [
  {id: 'overview', number: 1, label: 'Overview'},
  {id: 'attendance', number: 2, label: 'Attendance'},
  {id: 'profiles', number: 3, label: 'Student profiles'},
  {id: 'assessments', number: 4, label: 'Assessments'},
  {id: 'visits', number: 5, label: 'Visits'},
  {id: 'morarji', number: 6, label: 'Morarji scholarship'},
  {id: 'donors', number: 7, label: 'Annual donor summary'},
  {id: 'about', number: 8, label: 'About'},
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
