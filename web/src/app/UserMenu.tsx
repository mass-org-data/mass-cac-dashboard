import {useEffect, useRef, useState} from 'react';
import {Check, ChevronDown, UserRound} from 'lucide-react';
import {Button} from '../components/ui/button';
import {useI18n, type Language} from '../i18n/I18n';

export function UserMenu({email, defaultLanguage, onSaveLanguage, onSignOut}: {email: string; defaultLanguage: Language; onSaveLanguage: (language: Language) => Promise<boolean>; onSignOut: () => Promise<void>}) {
  const {setLanguage, t} = useI18n();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<'saved' | 'error' | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [open]);
  const save = async (next: Language) => {
    setSaving(true); setNotice(null);
    try {
      const saved = await onSaveLanguage(next);
      if (!saved) throw new Error('unsupported');
      setLanguage(next); setNotice('saved');
    } catch { setNotice('error'); }
    finally { setSaving(false); }
  };
  return (
    <div ref={root} className="relative">
      <button type="button" aria-label={t('account.menu')} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(value => !value)} className="inline-flex min-h-11 max-w-56 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-brand-soft">
        <UserRound aria-hidden="true" className="size-5 shrink-0" /><span className="truncate">{email}</span><ChevronDown aria-hidden="true" className="size-4 shrink-0" />
      </button>
      {open ? <div role="menu" className="absolute right-0 z-50 mt-2 w-72 space-y-4 rounded-lg border border-line bg-white p-4 shadow-xl">
        <div><p className="text-xs font-semibold text-muted">{t('account.signedInAs')}</p><p className="break-all text-sm font-semibold">{email}</p></div>
        <label className="block text-sm font-semibold">{t('language.default')}
          <select value={defaultLanguage} disabled={saving} onChange={event => void save(event.target.value as Language)} className="mt-1 min-h-11 w-full rounded-md border border-line bg-white px-3 font-normal">
            <option value="en">{t('language.english')}</option><option value="kn">{t('language.kannada')}</option>
          </select>
        </label>
        {notice ? <p role={notice === 'error' ? 'alert' : 'status'} className={`flex items-center gap-1 text-xs ${notice === 'error' ? 'text-bad' : 'text-ok'}`}>{notice === 'saved' ? <Check aria-hidden="true" className="size-4" /> : null}{t(notice === 'saved' ? 'language.saved' : 'language.saveFailed')}</p> : null}
        <Button role="menuitem" variant="outline" className="w-full" onClick={() => void onSignOut()}>{t('account.signOut')}</Button>
      </div> : null}
    </div>
  );
}
