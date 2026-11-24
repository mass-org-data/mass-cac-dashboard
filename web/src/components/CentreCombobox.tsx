import {useEffect, useId, useMemo, useRef, useState} from 'react';
import {Check, ChevronsUpDown, Search} from 'lucide-react';
import {cn} from '../lib/utils';

export interface CentreOption {id: string; label: string}

/**
 * Searchable centre lookup used by filters and write dialogs. The selected value
 * is always the centre id; labels are display-only and are never used as keys.
 */
export function CentreCombobox({label, value, options, onChange, allLabel, disabled = false, active = false, className}: {
  label: string;
  value: string;
  options: CentreOption[];
  onChange: (value: string) => void;
  allLabel?: string;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  const inputId = useId();
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.id === value);
  const selectedLabel = value === '' ? (allLabel ?? '') : (selected?.label ?? '');
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  useEffect(() => { if (!open) setQuery(selectedLabel); }, [open, selectedLabel]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('en');
    const rows = needle && query !== selectedLabel
      ? options.filter(option => option.label.toLocaleLowerCase('en').includes(needle))
      : options;
    return allLabel === undefined ? rows : [{id: '', label: allLabel}, ...rows];
  }, [allLabel, options, query, selectedLabel]);

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery(id === '' ? (allLabel ?? '') : (options.find(option => option.id === id)?.label ?? ''));
  };

  return (
    <label htmlFor={inputId} className={cn('relative flex min-w-40 flex-col gap-1 text-xs font-semibold text-muted', className)}>
      {label}
      <div ref={root} className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" />
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          aria-activedescendant={open && matches[highlighted] ? `${listId}-${highlighted}` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={query}
          onFocus={() => { setOpen(true); setHighlighted(0); }}
          onChange={event => { setQuery(event.target.value); setOpen(true); setHighlighted(0); }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setHighlighted(index => Math.min(matches.length - 1, index + 1)); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); setHighlighted(index => Math.max(0, index - 1)); }
            else if (event.key === 'Enter' && open && matches[highlighted]) { event.preventDefault(); choose(matches[highlighted].id); }
            else if (event.key === 'Escape') { setOpen(false); setQuery(selectedLabel); }
          }}
          className={cn('min-h-11 w-full rounded-md border border-line bg-white py-2 pl-9 pr-9 text-sm font-normal text-ink', active && 'border-brand-dark bg-brand-soft ring-1 ring-brand-dark')}
        />
        <ChevronsUpDown aria-hidden="true" className="pointer-events-none absolute right-3 top-3.5 size-4 text-muted" />
        {open && !disabled ? (
          <ul id={listId} role="listbox" className="absolute z-50 mt-1 max-h-64 w-full min-w-64 overflow-auto rounded-md border border-line bg-white p-1 text-sm font-normal text-ink shadow-lg">
            {matches.length ? matches.map((option, index) => (
              <li
                id={`${listId}-${index}`}
                key={option.id || '__all__'}
                role="option"
                aria-selected={option.id === value}
                onMouseDown={event => event.preventDefault()}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => choose(option.id)}
                className={cn('flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded px-3 py-2', index === highlighted && 'bg-brand-soft', option.id === value && 'font-semibold text-brand-dark')}
              >
                <span>{option.label}</span>{option.id === value ? <Check aria-hidden="true" className="size-4" /> : null}
              </li>
            )) : <li className="px-3 py-2 text-muted">No matching centres</li>}
          </ul>
        ) : null}
      </div>
    </label>
  );
}
