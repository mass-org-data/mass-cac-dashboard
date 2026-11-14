import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {itemsFor, SideMenu, unavailableReason} from './SideMenu';
import type {Route} from './route';
import {violations} from '../test/axe';

function Harness({role = 'Teacher', initial = 'overview' as Route, collapsed: startCollapsed = false, onNavigate = vi.fn()}) {
  const [route, setRoute] = useState<Route>(initial);
  const [collapsed, setCollapsed] = useState(startCollapsed);
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>open</button>
      <SideMenu role={role} route={route} onNavigate={r => { onNavigate(r); setRoute(r); }} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(v => !v)} mobileOpen={open} onCloseMobile={() => setOpen(false)} legacyHref="./vanilla/" />
    </div>
  );
}
const labels = () => within(screen.getByRole('navigation', {name: 'Primary'})).getAllByRole('link').map(a => a.textContent);

describe('side menu', () => {
  it('shows the numbered screens in the original menu style, with the active one marked', () => {
    render(<Harness role="Cluster Officer" initial="attendance" />);
    expect(screen.getByText('Programme')).toBeInTheDocument();
    expect(labels().slice(0, 5)).toEqual(['1. Overview', '2. Attendance', '3. Student profiles', '4. Assessments', '5. Visits']);
    expect(screen.getByRole('link', {name: '2. Attendance'})).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', {name: '1. Overview'})).not.toHaveAttribute('aria-current');
  });
  it('lists all eight numbered screens for every role', () => {
    for (const role of ['Leadership', 'Teacher', 'Cluster Officer']) expect(itemsFor(role).map(i => i.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('greys out the screens a role cannot open, with the reason, and does not make them links', () => {
    expect(unavailableReason('Leadership', 'profiles')).toBeTruthy();
    expect(unavailableReason('Teacher', 'donors')).toBeTruthy();
    expect(unavailableReason('Cluster Officer', 'donors')).toBeTruthy();
    expect(unavailableReason('Teacher', 'visits')).toBeTruthy();
    expect(unavailableReason('Cluster Officer', 'visits')).toBeNull();
    expect(unavailableReason('Leadership', 'visits')).toBeNull();
    const view = render(<Harness role="Teacher" />);
    expect(labels()).toEqual(['1. Overview', '2. Attendance', '3. Student profiles', '4. Assessments', '6. Morarji scholarship', '8. About', 'Activities and monthly meetings (standard application)']);
    const nav = within(screen.getByRole('navigation', {name: 'Primary'}));
    expect(nav.getByText('7. Annual donor summary').closest('[aria-disabled="true"]')).not.toBeNull();
    expect(nav.getByText('5. Visits').closest('[aria-disabled="true"]')).not.toBeNull();
    expect(nav.getByText(/unavailable: Leadership reporting only/)).toBeInTheDocument();
    view.unmount();
    render(<Harness role="Leadership" />);
    expect(screen.getByText('3. Student profiles').closest('[aria-disabled="true"]')).not.toBeNull();
    expect(labels()).not.toContain('3. Student profiles');
  });
  it('navigates without leaving the page and reports the screen', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<Harness onNavigate={onNavigate} />);
    await user.click(screen.getByRole('link', {name: '4. Assessments'}));
    expect(onNavigate).toHaveBeenCalledWith('assessments');
    expect(screen.getByRole('link', {name: '4. Assessments'})).toHaveAttribute('aria-current', 'page');
  });
  it('collapses to icons with the names still available to screen readers and as tooltips, then expands again', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toggle = screen.getByRole('button', {name: 'Collapse menu'});
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(screen.getByRole('button', {name: 'Expand menu'})).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('complementary', {name: 'Menu'})).toHaveAttribute('data-collapsed', 'true');
    const link = screen.getByRole('link', {name: '2. Attendance'});            // still has its accessible name
    expect(link).toHaveAttribute('title', '2. Attendance');
    expect(within(link).getByText('2. Attendance')).toHaveClass('md:sr-only');
    await user.click(screen.getByRole('button', {name: 'Expand menu'}));
    expect(screen.getByRole('complementary', {name: 'Menu'})).toHaveAttribute('data-collapsed', 'false');
    expect(within(screen.getByRole('link', {name: '2. Attendance'})).getByText('2. Attendance')).not.toHaveClass('md:sr-only');
  });
  it('links to the standard application for Activities and monthly meetings', () => {
    render(<Harness />);
    expect(screen.getByRole('link', {name: /Activities and monthly meetings/})).toHaveAttribute('href', './vanilla/');
  });
  it('opens on a phone with a scrim, closes with the scrim, Escape or a choice', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole('button', {name: 'Close menu'})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'open'}));
    expect(screen.getByRole('complementary', {name: 'Menu'})).toHaveAttribute('data-open', 'true');
    expect(screen.getByRole('link', {name: '1. Overview'})).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('complementary', {name: 'Menu'})).toHaveAttribute('data-open', 'false');
    await user.click(screen.getByRole('button', {name: 'open'}));
    await user.click(screen.getByRole('button', {name: 'Close menu'}));
    expect(screen.getByRole('complementary', {name: 'Menu'})).toHaveAttribute('data-open', 'false');
    await user.click(screen.getByRole('button', {name: 'open'}));
    await user.click(screen.getByRole('link', {name: '4. Assessments'}));
    expect(screen.getByRole('complementary', {name: 'Menu'})).toHaveAttribute('data-open', 'false');
  });
  it('has no automatic accessibility violations, expanded or collapsed', async () => {
    const {container, rerender} = render(<Harness />);
    expect(await violations(container)).toEqual([]);
    rerender(<Harness collapsed />);
    expect(await violations(container)).toEqual([]);
  });
});
