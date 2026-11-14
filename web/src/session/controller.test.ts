import {describe, expect, it, vi} from 'vitest';
import {createSessionController, type Backend, type ProgrammeContext, type Timers} from './controller';

const context = (roles: string[][] = [['Leadership']]): ProgrammeContext => ({user_id: 'u1', operational_roles_enabled: false, centres: roles.map((r, i) => ({id: `c${i}`, label: `Centre ${i}`, roles: r}))});

function setup(overrides: Partial<Backend> = {}) {
  const callbacks: Array<() => void> = [];
  const timers: Timers = {setInterval: cb => { callbacks.push(cb); return callbacks.length; }, clearInterval: () => undefined};
  const backend: Backend = {
    getSession: vi.fn(async () => ({data: {session: {user: {id: 'u1'}}}, error: null})),
    getUser: vi.fn(async () => ({data: {user: {id: 'u1'}}, error: null})),
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    readContext: vi.fn(async () => context()),
    ...overrides,
  };
  return {backend, controller: createSessionController(backend, timers), tick: () => callbacks.forEach(cb => cb())};
}

describe('session controller', () => {
  it('starts signed out when there is no session and reads no data', async () => {
    const {backend, controller} = setup({getSession: vi.fn(async () => ({data: {session: null}, error: null}))});
    await controller.start();
    expect(controller.getState()).toEqual({status: 'signed-out'});
    expect(backend.readContext).not.toHaveBeenCalled();
  });

  it('becomes ready with server roles only and defaults to Leadership when authorised', async () => {
    const {controller} = setup({readContext: vi.fn(async () => context([['Teacher'], ['Leadership', 'Cluster Officer']]))});
    await controller.start();
    const state = controller.getState();
    expect(state.status).toBe('ready');
    if (state.status === 'ready') { expect(state.roles).toEqual(['Leadership', 'Cluster Officer', 'Teacher']); expect(state.activeRole).toBe('Leadership'); }
  });

  it('only allows selecting a role the server returned', async () => {
    const {controller} = setup({readContext: vi.fn(async () => context([['Teacher']]))});
    await controller.start();
    expect(controller.selectRole('Leadership')).toBe(false);
    expect(controller.selectRole('Teacher')).toBe(true);
    expect(controller.selectRole('Admin')).toBe(false);
  });

  it('rejects a session whose verified user differs from the session user', async () => {
    const {backend, controller} = setup({getUser: vi.fn(async () => ({data: {user: {id: 'other'}}, error: null}))});
    await controller.start();
    expect(controller.getState().status).toBe('signed-out');
    expect(backend.signOut).toHaveBeenCalled();
    expect(backend.readContext).not.toHaveBeenCalled();
  });

  it('refuses accounts with no verified scope', async () => {
    const {controller} = setup({readContext: vi.fn(async () => ({user_id: 'u1', centres: []}))});
    await controller.start();
    expect(controller.getState()).toMatchObject({status: 'signed-out'});
  });

  it('ends the session when the authorised scope changes during re-verification', async () => {
    let call = 0;
    const {backend, controller, tick} = setup({readContext: vi.fn(async () => (call++ === 0 ? context() : context([['Leadership'], ['Leadership']])))});
    await controller.start();
    tick();
    await vi.waitFor(() => expect(controller.getState().status).toBe('signed-out'));
    expect(backend.signOut).toHaveBeenCalled();
  });

  it('keeps the session through a transport failure but ends it on an authorization failure', async () => {
    let mode: 'network' | 'denied' = 'network';
    const {controller, tick} = setup({getUser: vi.fn(async () => { if (controller_started) { if (mode === 'network') throw new Error('offline'); return {data: {user: null}, error: {status: 401}}; } return {data: {user: {id: 'u1'}}, error: null}; })});
    let controller_started = false;
    await controller.start();
    controller_started = true;
    tick();
    await Promise.resolve(); await Promise.resolve();
    expect(controller.getState().status).toBe('ready');
    mode = 'denied';
    await controller.verify();
    expect(controller.getState().status).toBe('signed-out');
  });

  it('signs in through the verified path, then loads, and signs out clearing the state', async () => {
    const {backend, controller} = setup();
    await controller.signIn('a@example.test', 'pw');
    expect(backend.signIn).toHaveBeenCalledWith('a@example.test', 'pw');
    expect(controller.getState().status).toBe('ready');
    await controller.signOut();
    expect(controller.getState()).toEqual({status: 'signed-out', message: undefined});
  });

  it('shows a sign-in failure without exposing provider details', async () => {
    const {controller} = setup({signIn: vi.fn(async () => { throw new Error('Unable to sign in. Check your credentials and account access.'); })});
    await controller.signIn('a@example.test', 'bad');
    expect(controller.getState()).toEqual({status: 'signed-out', message: 'Unable to sign in. Check your credentials and account access.'});
  });
});
