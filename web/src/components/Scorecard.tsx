import type {ReactNode} from 'react';
import {Card} from './ui/card';
import {Skeleton} from './ui/skeleton';
import {cn} from '../lib/utils';
import {UNKNOWN} from '../lib/format';

export type ScorecardState = 'ready' | 'loading' | 'error' | 'unavailable';

interface Props {
  label: string;
  value?: string | number | null;
  unit?: string;
  hint?: ReactNode;
  state?: ScorecardState;
  /** Text shown for the error and unavailable states. */
  message?: string;
  tone?: 'default' | 'alert';
}

// One scorecard for every page: compact label, large value, same three states everywhere.
export function Scorecard({label, value, unit, hint, state = 'ready', message, tone = 'default'}: Props) {
  const unknown = value === null || value === undefined || value === '';
  return (
    <Card role="group" aria-label={label} aria-busy={state === 'loading'} className={cn('flex min-h-36 flex-col justify-between', tone === 'alert' && 'border-bad')}>
      <p className="min-h-11 text-sm font-semibold text-muted">{label}</p>
      <div>
        {state === 'loading' ? (
          <div role="status"><span className="sr-only">Loading {label}</span><Skeleton className="h-9 w-24" /></div>
        ) : state === 'error' ? (
          <p role="alert" className="text-lg font-semibold text-bad">Unavailable</p>
        ) : state === 'unavailable' || unknown ? (
          <p className="text-4xl font-bold leading-tight text-muted"><span aria-hidden="true">{UNKNOWN}</span><span className="sr-only">Not available</span></p>
        ) : (
          <p className="text-4xl font-bold leading-tight text-ink">{value}{unit ? <span className="ml-1 text-sm font-medium text-muted">{unit}</span> : null}</p>
        )}
        {state === 'error' || state === 'unavailable' ? (message ? <p className="mt-1 text-xs text-muted">{message}</p> : null) : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </div>
    </Card>
  );
}
