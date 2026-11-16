import {useMemo} from 'react';
import type {ProgrammeContext} from '../session/controller';

const ROLE_ORDER = ['Leadership', 'Cluster Officer', 'Teacher'];
const section = 'rounded-lg border border-line bg-white p-4 shadow-sm';

// The simple general About page of the live application: access, reporting rules and data coverage.
// It states the approved rules in plain words and shows only what the server has verified for this account.
export function About({context, role}: {context: ProgrammeContext; role: string}) {
  const access = useMemo(() => ROLE_ORDER.map(name => ({name, centres: context.centres.filter(c => c.roles.includes(name)).length})).filter(row => row.centres > 0), [context]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">MASS Children’s Activity Centres dashboard.</p>
      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <section aria-labelledby="about-access" className={section}>
          <h2 id="about-access" className="mb-2 text-lg font-semibold">Your access</h2>
          <p className="text-sm">The dashboard shows only the roles and centres assigned to your authenticated account. Saves and corrections use server-enforced permissions and revision checks.</p>
          <ul aria-label="Verified roles" className="mt-3 space-y-1 text-sm">
            {access.map(row => (
              <li key={row.name}><strong>{row.name}</strong>{row.name === role ? ' (active)' : ''}: {row.centres} {row.centres === 1 ? 'centre' : 'centres'}{row.name === 'Leadership' ? ', read-only reporting' : ''}</li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="about-rules" className={section}>
          <h2 id="about-rules" className="mb-2 text-lg font-semibold">Reporting rules</h2>
          <p className="text-sm">Attendance uses Present ÷ recorded classroom attendance, where L means Leave. H, MM and historical WO are excluded. Historical L remains in the denominator. Assessments use four April–March rounds (F1–F4) with a maximum of 25 marks.</p>
        </section>
        <section aria-labelledby="about-coverage" className={section}>
          <h2 id="about-coverage" className="mb-2 text-lg font-semibold">Data coverage</h2>
          <p className="text-sm">Missing records remain unknown. Historical assessment dates, delivery, donor validity and programme outcomes are never inferred. An unknown value is shown as a dash or as unknown, never as zero.</p>
        </section>
      </div>
      <section aria-labelledby="about-export" className={section}>
        <h2 id="about-export" className="mb-2 text-lg font-semibold">Exports</h2>
        <p className="text-sm">Every table has its own Export CSV button. It exports the rows you can see in that table, after the search and sorting you chose. Server-paged tables export the page shown.</p>
      </section>
    </div>
  );
}
