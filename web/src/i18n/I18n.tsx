import {createContext, useContext, useEffect, useMemo, type ReactNode} from 'react';
import {en, type MessageKey} from './en';
import {kn} from './kn';
import {setFormatLanguage} from '../lib/format';

export type Language = 'en' | 'kn';
type Values = Record<string, string | number>;
type Translator = (key: MessageKey, values?: Values) => string;

const interpolate = (message: string, values?: Values) => values
  ? message.replace(/\{([a-z]+)\}/gi, (_match, key: string) => String(values[key] ?? `{${key}}`))
  : message;

const translate = (language: Language): Translator => (key, values) => interpolate((language === 'kn' ? kn : en)[key], values);

const Context = createContext<{language: Language; setLanguage: (language: Language) => void; t: Translator}>({language: 'en', setLanguage: () => undefined, t: translate('en')});

export function I18nProvider({language, setLanguage, children}: {language: Language; setLanguage: (language: Language) => void; children: ReactNode}) {
  const value = useMemo(() => ({language, setLanguage, t: translate(language)}), [language, setLanguage]);
  // Configure pure formatting helpers before descendants render, so a language switch never leaves one stale frame.
  setFormatLanguage(language, value.t('common.notRecorded'));
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useI18n = () => useContext(Context);

export function LanguageToggle({compact = false}: {compact?: boolean}) {
  const {language, setLanguage, t} = useI18n();
  return (
    <fieldset aria-label={t('language.switcher')} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-white p-1 text-sm font-semibold">
      {(['en', 'kn'] as const).map(code => <button key={code} type="button" aria-pressed={language === code} onClick={() => setLanguage(code)} className={`min-h-9 rounded-md px-3 ${language === code ? 'bg-brand text-white' : 'text-muted hover:bg-brand-soft'}`}>{compact && code === 'en' ? 'EN' : t(code === 'en' ? 'language.english' : 'language.kannada')}</button>)}
    </fieldset>
  );
}

export const intlLocale = (language: Language): string => language === 'kn' ? 'kn-IN-u-nu-latn' : 'en-IN';
