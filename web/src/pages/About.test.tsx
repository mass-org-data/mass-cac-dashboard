import {render, screen, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {About} from './About';
import type {ProgrammeContext} from '../session/controller';
import {violations} from '../test/axe';

const ctx = (centres: Array<{id: string; roles: string[]}>): ProgrammeContext => ({user_id: 'u', operational_roles_enabled: true, centres: centres.map(c => ({...c, label: c.id, can_write: false}))}) as unknown as ProgrammeContext;

describe('About page', () => {
  it('states the approved reporting rules and the unknown-is-not-zero rule', () => {
    render(<About context={ctx([{id: 'c1', roles: ['Teacher']}])} role="Teacher" />);
    expect(screen.getByText(/Present ÷ recorded classroom attendance, where L means Leave/)).toBeInTheDocument();
    expect(screen.getByText(/H, MM and historical WO are excluded/)).toBeInTheDocument();
    expect(screen.getByText(/maximum of 25 marks/)).toBeInTheDocument();
    expect(screen.getByText(/never as zero/)).toBeInTheDocument();
  });
  it('lists only the roles the server verified, with centre counts and the active role', () => {
    render(<About context={ctx([{id: 'c1', roles: ['Leadership', 'Cluster Officer']}, {id: 'c2', roles: ['Leadership', 'Cluster Officer']}, {id: 'c3', roles: ['Leadership']}])} role="Leadership" />);
    const list = screen.getByRole('list', {name: 'Verified roles'});
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Leadership (active): 3 centres, read-only reporting');
    expect(items[1]).toHaveTextContent('Cluster Officer: 2 centres');
    expect(within(list).queryByText(/Teacher/)).not.toBeInTheDocument();
  });
  it('uses the singular for one centre', () => {
    render(<About context={ctx([{id: 'c1', roles: ['Teacher']}])} role="Teacher" />);
    expect(screen.getByRole('listitem')).toHaveTextContent('Teacher (active): 1 centre');
  });
  it('explains exports and has no automatic accessibility violations', async () => {
    const {container} = render(<About context={ctx([{id: 'c1', roles: ['Teacher']}])} role="Teacher" />);
    expect(screen.getByText(/Every table has its own Export CSV button/)).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });
});
