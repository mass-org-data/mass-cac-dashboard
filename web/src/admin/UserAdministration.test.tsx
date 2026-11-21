import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, vi} from 'vitest';
import {UserAdministration} from './UserAdministration';
import type {AdministrationCall, AdministrationDirectory} from './contracts';

const directory: AdministrationDirectory = {
  users: [{
    id:'one',email:'first@example.invalid',emailConfirmed:true,role:'Leadership',status:'Active',version:1,pending:null,assignments:[],
  },{
    id:'two',email:'second@example.invalid',emailConfirmed:true,role:'Leadership',status:'Active',version:3,pending:null,assignments:[],
  }],
  pendingInvites: [],
  more: false,
};

it('hides self changes and gives another Leadership account a confirmed deactivation workflow', async () => {
  const user = userEvent.setup();
  const call = vi.fn(async ({action}: Record<string, string | number>) => action === 'directory' ? directory : {state:'complete'});
  render(<UserAdministration call={call as unknown as AdministrationCall} actor="one" centres={[]} />);
  const manage = await screen.findAllByRole('button', {name:'Manage account'});
  await user.click(manage[0]);
  expect(screen.queryByRole('button', {name:'Deactivate account'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name:'Change role'})).not.toBeInTheDocument();
  await user.click(manage[1]);
  await user.click(screen.getByRole('button', {name:'Deactivate account'}));
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveTextContent('end active assignments');
  expect(call).toHaveBeenCalledTimes(1);
  await user.click(within(dialog).getByRole('button', {name:'Confirm change'}));
  expect(await screen.findByText('Account change completed.')).toBeVisible();
  expect(call).toHaveBeenCalledWith(expect.objectContaining({action:'deactivate',subject:'two',version:3,id:expect.any(String)}));
});

it('offers an Auth retry for an incomplete change and preserves its stored request ID', async () => {
  const user = userEvent.setup();
  const pending = {...directory,users:[{...directory.users[1],status:'Inactive',pending:{id:'saved-request',action:'deactivate',state:'retry'}}]};
  const call = vi.fn(async ({action}) => action === 'directory' ? pending : {state:'complete'});
  render(<UserAdministration call={call as unknown as AdministrationCall} actor="one" centres={[]} />);
  await user.click(await screen.findByRole('button',{name:'Manage account'}));
  expect(screen.getByText(/Auth deactivation is pending/)).toBeVisible();
  await user.click(screen.getByRole('button',{name:'Retry Auth action'}));
  await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Confirm change'}));
  expect(call).toHaveBeenCalledWith({action:'retry',id:'saved-request'});
});
