import type {ProgrammeContext} from '../session/controller';
import {useI18n} from '../i18n/I18n';

const section = 'rounded-lg border border-line bg-white p-4 shadow-sm';

// The simple general About page of the live application: access, reporting rules and data coverage.
// It states the approved rules in plain words and shows only what the server has verified for this account.
export function About({context, role}: {context: ProgrammeContext; role: string}) {
  const {t} = useI18n();
  const access = [{name: role, centres: context.centres.length}];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{t('about.intro')}</p>
      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <section aria-labelledby="about-access" className={section}>
          <h2 id="about-access" className="mb-2 text-lg font-semibold">{t('about.accessTitle')}</h2>
          <p className="text-sm">{t('about.accessBody')}</p>
          <ul aria-label={t('about.verifiedRoles')} className="mt-3 space-y-1 text-sm">
            {access.map(row => (
              <li key={row.name}><strong>{row.name}</strong> ({t('about.active')}): {row.centres} {t(row.centres === 1 ? 'about.centre' : 'about.centres')}</li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="about-rules" className={section}>
          <h2 id="about-rules" className="mb-2 text-lg font-semibold">{t('about.rulesTitle')}</h2>
          <p className="text-sm">{t('about.rulesBody')}</p>
        </section>
        <section aria-labelledby="about-coverage" className={section}>
          <h2 id="about-coverage" className="mb-2 text-lg font-semibold">{t('about.coverageTitle')}</h2>
          <p className="text-sm">{t('about.coverageBody')}</p>
        </section>
      </div>
      <section aria-labelledby="about-export" className={section}>
        <h2 id="about-export" className="mb-2 text-lg font-semibold">{t('about.exportsTitle')}</h2>
        <p className="text-sm">{t(context.capabilities?.export === true ? 'about.exportsBody' : 'about.exportsLeadershipOnly')}</p>
      </section>
    </div>
  );
}
