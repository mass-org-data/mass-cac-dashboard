export const applicationRoles = ['Teacher', 'Cluster Officer', 'Leadership'] as const;
export type ApplicationRole = typeof applicationRoles[number];

export interface CentreAssignment {
  id: string;
  centre: string;
  label: string;
  status: 'Active' | 'Inactive';
  startsAt: string;
  endsAt: string | null;
  version: number;
}
export interface AdministrationUser {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
  role: ApplicationRole;
  status: 'Active' | 'Inactive';
  version: number;
  pending: {id: string; action: 'deactivate' | 'reactivate'; state: 'pending' | 'retry'} | null;
  assignments: CentreAssignment[];
}
export interface AdministrationDirectory {
  users: AdministrationUser[];
  more: boolean;
  pendingInvites: Array<{id: string; email: string}>;
}
export interface AdministrationResult {state: 'complete' | 'retry' | 'failed'; failure?: string}
export type AdministrationCall = <T>(body: Record<string, string | number>) => Promise<T>;
export class AdministrationError extends Error {
  constructor(public code: string) { super(code); }
}
