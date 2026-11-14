import type {ReactNode} from 'react';
import {Card} from './ui/card';
import {AsyncState, type LoadState} from './AsyncState';

// A numbered chart section with the shared loading, empty and error states.
export function ChartCard({reference, title, subtitle, state, errorMessage, emptyMessage, onRetry, children}: {reference?: string; title: string; subtitle?: string; state: LoadState; errorMessage?: string; emptyMessage?: string; onRetry?: () => void; children?: ReactNode}) {
  return (
    <Card aria-label={title} role="region" className="min-w-0">
      <h2 className="text-base font-semibold text-ink">{reference ? <span className="mr-1 text-xs font-bold text-brand-dark">{reference}</span> : null}{title}</h2>
      {subtitle ? <p className="mb-3 text-xs text-muted">{subtitle}</p> : <div className="mb-3" />}
      <AsyncState state={state} errorMessage={errorMessage} emptyMessage={emptyMessage} onRetry={onRetry} rows={4}>{children}</AsyncState>
    </Card>
  );
}
