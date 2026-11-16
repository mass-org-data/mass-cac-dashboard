import type {ReactNode} from 'react';
import {Button} from './ui/button';
import {Skeleton} from './ui/skeleton';

export type LoadState = 'ready' | 'loading' | 'empty' | 'error';

interface Props {
  state: LoadState;
  /** Shown when ready. */
  children?: ReactNode;
  loadingLabel?: string;
  emptyMessage?: string;
  errorMessage?: string;
  onRetry?: () => void;
  /** Skeleton rows shown while loading. */
  rows?: number;
}

// One loading, empty and error treatment for every card, chart and table.
export function AsyncState({state, children, loadingLabel = 'Loading…', emptyMessage = 'No records match.', errorMessage = 'This could not be loaded.', onRetry, rows = 3}: Props) {
  if (state === 'ready') return <>{children}</>;
  if (state === 'loading') {
    return (
      <div role="status" aria-busy="true" className="space-y-2">
        <span className="sr-only">{loadingLabel}</span>
        {Array.from({length: rows}, (_, index) => <Skeleton key={index} className="h-6 w-full" />)}
      </div>
    );
  }
  if (state === 'empty') return <p role="note" className="rounded-md bg-brand-soft p-4 text-sm text-ink">{emptyMessage}</p>;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md bg-bad-soft p-4 text-sm text-bad">
      <span>{errorMessage}</span>
      {onRetry ? <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button> : null}
    </div>
  );
}
