import {useCallback, useEffect, useRef, useState} from 'react';
import type {Environment, OverviewService, Report, Selection, Series, ShiftCounts} from './overview';
import {isFutureMonth} from './overview';

export type Slice<T> = {status: 'idle'} | {status: 'loading'} | {status: 'ready'; value: T} | {status: 'error'; message: string} | {status: 'future'};

const idle = {status: 'idle'} as const;
const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : 'This could not be loaded.');

// Loads the Overview slices one after another so the first scorecards never wait for the charts:
// report first, then the shift counts and the monthly series (which run behind the same two-at-a-time queue).
export function useOverview(service: OverviewService, selection: Selection | null, env: Environment | null) {
  const [report, setReport] = useState<Slice<Report>>(idle);
  const [shifts, setShifts] = useState<Slice<ShiftCounts>>(idle);
  const [series, setSeries] = useState<Slice<Series>>(idle);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const selectionKey = JSON.stringify([selection, env?.yearId, env?.today, env?.fromQuarter, env?.toQuarter, env?.hasSeries]);

  useEffect(() => {
    if (!selection || !env || selection.centres.length === 0) { setReport(idle); setShifts(idle); setSeries(idle); return; }
    const run = ++latest.current;
    const current = () => run === latest.current;
    if (isFutureMonth(selection.month, env.today)) { setReport({status: 'future'}); setShifts({status: 'future'}); setSeries(idle); }
    else { setReport({status: 'loading'}); setShifts({status: 'loading'}); }
    setSeries({status: 'loading'});
    const reportPromise = isFutureMonth(selection.month, env.today) ? Promise.resolve(null) : service.report(selection, env);
    reportPromise.then(value => { if (current() && value) setReport({status: 'ready', value}); }).catch(error => { if (current()) setReport({status: 'error', message: messageOf(error)}); });
    if (!isFutureMonth(selection.month, env.today)) {
      service.shifts(selection, env).then(value => { if (current()) setShifts({status: 'ready', value}); }).catch(error => { if (current()) setShifts({status: 'error', message: messageOf(error)}); });
    }
    service.series(selection, env).then(value => { if (current()) setSeries({status: 'ready', value}); }).catch(error => { if (current()) setSeries({status: 'error', message: messageOf(error)}); });
    return () => { latest.current++; };
    // selectionKey captures every input that changes what is requested.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, selectionKey, attempt]);

  return {report, shifts, series, retry};
}
