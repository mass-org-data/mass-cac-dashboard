import type {ReactNode} from 'react';
import {X} from 'lucide-react';
import {Button} from './ui/button';
import {cn} from '../lib/utils';
import {useI18n} from '../i18n/I18n';
import {en, type MessageKey} from '../i18n/en';

/** Dropdown option text is always English, even when the interface language is Kannada, so a value reads the same everywhere. */
export const english = (key: MessageKey): string => en[key];

/** One panel for every page's filters. A filter that has a value is drawn with a green border, and a Clear filters button
 *  appears after the last filter while any of them is active. */
export function FilterPanel({label, active, onClear, children, role = 'group'}: {label: string; active: boolean; onClear: () => void; children: ReactNode; role?: 'group' | 'search'}) {
  const {t} = useI18n();
  return (
    <div role={role} aria-label={label} className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-3">
      {children}
      {active ? <Button variant="outline" onClick={onClear}><X aria-hidden="true" className="size-4" />{t('common.clearFilters')}</Button> : null}
    </div>
  );
}

/** Border and fill that mark a filter as holding a value. */
export const activeFieldClass = (active: boolean): string => cn(active && 'border-brand-dark bg-brand-soft ring-1 ring-brand-dark');

/** The shared dropdown filter. Pass `allLabel` for a filter that can be left empty (and so can be active). */
export function FilterSelect({label, value, options, onChange, allLabel, active: forced}: {active?: boolean; label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void; allLabel?: string}) {
  const active = forced ?? (allLabel !== undefined && value !== '');
  return (
    <label className="flex min-w-40 flex-col gap-1 text-xs font-semibold text-muted">
      {label}
      <select value={value} onChange={event => onChange(event.target.value)} data-active={active} className={cn('min-h-11 rounded-md border border-line bg-white px-2 text-sm font-normal text-ink', activeFieldClass(active))}>
        {allLabel !== undefined ? <option value="">{allLabel}</option> : null}
        {options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}
      </select>
    </label>
  );
}
