import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ReactNode} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {App} from './App';
import {SAMPLE_CENTRE_IDS} from './centreScope';
import type {ProgrammeContext} from '../session/controller';

const session = vi.hoisted(() => ({context: null as ProgrammeContext | null}));

vi.mock('../session/backend', () => ({createLiveBackend: () => ({})}));
vi.mock('../session/controller', () => ({createSessionController: () => ({})}));
vi.mock('../session/SessionProvider', () => ({
  SessionProvider: ({children}: {children: ReactNode}) => children,
  useSession: () => ({
    state: session.context && {
      status: 'ready', userId: session.context.user_id, role: session.context.role,
      context: session.context, defaultLanguage: 'en', email: 'test@example.invalid',
    },
    controller: {},
  }),
}));
vi.mock('../pages/Overview', () => ({
  Overview: ({context}: {context: ProgrammeContext}) => <section aria-label="Report selection">
    {context.centres.map(centre => <p key={centre.id}>{centre.label}</p>)}
    {context.capabilities?.export ? <button>Official export</button> : null}
  </section>,
}));

const real = {id: 'programme-centre', label: 'Programme Centre', can_write: true};
const mass = {id: SAMPLE_CENTRE_IDS.mass, label: 'Sample - Mass', can_write: true};
const kirti = {id: SAMPLE_CENTRE_IDS.kirti, label: 'Sample - Kirti', can_write: true};
const config = {mode: 'live'};

function load(role: string, centres: ProgrammeContext['centres']) {
  session.context = {user_id: 'test-user', role, centres, capabilities: {export: role === 'Leadership'}};
  return render(<App config={config} />);
}

describe('Production sample-centre scope', () => {
  it('defaults Leadership to programme centres, isolates the sample selection and restores official export on return', async () => {
    const user = userEvent.setup();
    load('Leadership', [mass, real, kirti]);
    const picker = screen.getByRole('combobox', {name: 'Centre group'});
    const report = () => within(screen.getByRole('region', {name: 'Report selection'}));

    expect(picker).toHaveValue('programme');
    expect(report().getByText(real.label)).toBeInTheDocument();
    expect(report().queryByText(mass.label)).not.toBeInTheDocument();
    expect(report().queryByText(kirti.label)).not.toBeInTheDocument();
    expect(report().getByRole('button', {name: 'Official export'})).toBeInTheDocument();

    await user.selectOptions(picker, 'sample');
    expect(report().getByText(mass.label)).toBeInTheDocument();
    expect(report().getByText(kirti.label)).toBeInTheDocument();
    expect(report().queryByText(real.label)).not.toBeInTheDocument();
    expect(report().queryByRole('button', {name: 'Official export'})).not.toBeInTheDocument();

    await user.selectOptions(picker, 'programme');
    expect(report().getByText(real.label)).toBeInTheDocument();
    expect(report().getByRole('button', {name: 'Official export'})).toBeInTheDocument();
  });

  it.each([
    {role: 'Cluster Officer', centres: [mass, kirti]},
    {role: 'Teacher', centres: [kirti]},
  ])('retains precisely the server assignments for $role', ({role, centres}) => {
    load(role, centres);
    expect(screen.queryByRole('combobox', {name: 'Centre group'})).not.toBeInTheDocument();
    const report = within(screen.getByRole('region', {name: 'Report selection'}));
    expect(report.queryByText(real.label)).not.toBeInTheDocument();
    expect(report.queryByRole('button', {name: 'Official export'})).not.toBeInTheDocument();
    for (const centre of centres) expect(report.getByText(centre.label)).toBeInTheDocument();
    if (role === 'Teacher') expect(report.queryByText(mass.label)).not.toBeInTheDocument();
  });

  it('does not add the picker for a production context without sample centres', () => {
    load('Leadership', [real]);
    expect(screen.queryByRole('combobox', {name: 'Centre group'})).not.toBeInTheDocument();
  });
});
