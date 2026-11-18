import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it} from 'vitest';
import {formatCount, formatDateTime} from '../lib/format';
import {I18nProvider, LanguageToggle, useI18n, type Language} from './I18n';

function Harness() {
  const [language, setLanguage] = useState<Language>('en');
  return <I18nProvider language={language} setLanguage={setLanguage}><Content /></I18nProvider>;
}

function Content() {
  const {t} = useI18n();
  return <><LanguageToggle /><p>{t('signin.intro')}</p><output>{formatCount(1234)} | {formatDateTime(null)}</output></>;
}

describe('interface language', () => {
  it('defaults to English and switches the interface to Kannada while retaining Latin numerals', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByText('Sign in to your authorised programme workspace.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'ಕನ್ನಡ'}));
    expect(document.documentElement.lang).toBe('kn');
    expect(screen.getByText('ನಿಮ್ಮ ಅಧಿಕೃತ ಕಾರ್ಯಕ್ರಮ ಕಾರ್ಯಕ್ಷೇತ್ರಕ್ಕೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.')).toBeInTheDocument();
    expect(screen.getByText(/1,234/)).toHaveTextContent('1,234');
    expect(screen.getByText(/ದಾಖಲಾಗಿಲ್ಲ/)).toBeInTheDocument();
  });
});
