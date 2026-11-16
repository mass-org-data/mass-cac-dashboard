// One data service of each kind per signed-in session, so screens reuse what another screen already loaded
// (for example the all-centre report the Overview fetched) instead of asking the database again.
// The backend forgets them on sign-in, sign-out and role change; they are in memory only and never persisted.
import type {LiveBackend} from '../session/backend';
import {createOverviewService, type OverviewService} from './overview';
import {createProfilesService, type ProfilesService} from '../profiles/service';
import {createMorarjiService, type MorarjiService} from '../morarji/service';

type Maybe = Pick<LiveBackend, 'rpc'> & Partial<Pick<LiveBackend, 'shared'>>;
const once = <T,>(backend: Maybe, key: string, create: () => T): T => (backend.shared ? backend.shared(key, create) : create());

export const sharedOverview = (backend: Maybe): OverviewService => once(backend, 'overview', () => createOverviewService(backend.rpc));
export const sharedProfiles = (backend: Maybe): ProfilesService => once(backend, 'profiles', () => createProfilesService(backend.rpc));
export const sharedMorarji = (backend: Maybe): MorarjiService => once(backend, 'morarji', () => createMorarjiService(backend.rpc));
