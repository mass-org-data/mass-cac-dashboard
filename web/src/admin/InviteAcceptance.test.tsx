import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, vi} from 'vitest';
import {InviteAcceptance, takeInviteToken} from './InviteAcceptance';

const auth = vi.hoisted(() => ({
  verifyOtp:vi.fn(async () => ({data:{session:{}},error:null})),
  updateUser:vi.fn()
    .mockResolvedValueOnce({error:new Error('test password policy')})
    .mockResolvedValueOnce({error:null}),
  signOut:vi.fn(async () => ({})),
}));
vi.mock('@supabase/supabase-js', () => ({createClient:() => ({auth})}));

it('takes an invite token out of the browser address', () => {
  window.history.replaceState(null, '', '/#invite?token_hash=synthetic-marker');
  expect(takeInviteToken(window.location,window.history)).toBe('synthetic-marker');
  expect(window.location.hash).toBe('');
});

it('verifies the invite once and retries a rejected password without consuming the link twice', async () => {
  const user = userEvent.setup();
  const exit = vi.fn();
  render(<InviteAcceptance config={{mode:'live',url:'https://test.example.invalid',publishableKey:'public identifier'}} token="synthetic-marker" onExit={exit} />);
  expect(auth.verifyOtp).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText('New password'),'synthetic-password');
  await user.click(screen.getByRole('button',{name:'Accept invite and save password'}));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(auth.verifyOtp).toHaveBeenCalledWith({type:'invite',token_hash:'synthetic-marker'});
  await user.click(screen.getByRole('button',{name:'Accept invite and save password'}));
  expect(auth.verifyOtp).toHaveBeenCalledTimes(1);
  expect(auth.updateUser).toHaveBeenCalledTimes(2);
  expect(auth.signOut).toHaveBeenCalledWith({scope:'local'});
  expect(exit).toHaveBeenCalledWith(true);
});
