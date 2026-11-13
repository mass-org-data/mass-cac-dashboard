import {useCallback, useEffect, useMemo, useState} from 'react';
import {DataTable, type Column} from '../components/DataTable';
import {Scorecard} from '../components/Scorecard';
import type {LoadState} from '../components/AsyncState';
import {formatCount} from '../lib/format';
import type {LiveBackend} from '../session/backend';
import type {ProgrammeContext} from '../session/controller';

interface CentreRow {id: string; name: string; donor: string | null; roles: string}

// Foundation page: proves the shared components against real, server-scoped data.
// It shows centres the signed-in account is authorised for; no student records are read.
export function Foundation({backend, context, role}: {backend: LiveBackend; context: ProgrammeContext; role: string}) {
  const [donors, setDonors] = useState<Record<string, string | null>>({});
  const [state, setState] = useState<LoadState>('loading');

  const load = useCallback(() => {
    setState('loading');
    backend.readDirectory().then(rows => {
      setDonors(Object.fromEntries(rows.map(row => [row.centre_id, row.donor_label ?? null])));
      setState('ready');
    }).catch(() => setState('error'));
  }, [backend]);
  useEffect(load, [load]);

  const rows = useMemo<CentreRow[]>(() => context.centres
    .filter(centre => centre.roles.includes(role))
    .map(centre => ({id: centre.id, name: centre.label, donor: donors[centre.id] ?? null, roles: centre.roles.join(', ')})), [context, donors, role]);
  const donorCount = new Set(rows.map(row => row.donor).filter(Boolean)).size;

  const columns = useMemo<Column<CentreRow>[]>(() => [
    {id: 'name', header: 'Centre', value: row => row.name},
    {id: 'donor', header: 'Donor', value: row => row.donor},
    {id: 'roles', header: 'Your roles here', value: row => row.roles},
  ], []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Scorecard label="Centres in this role" value={formatCount(rows.length)} hint="Authorised by the server" />
        <Scorecard label="Donors represented" value={formatCount(donorCount)} hint="Current directory associations" state={state === 'loading' ? 'loading' : state === 'error' ? 'error' : 'ready'} message="The donor directory could not be read." />
        <Scorecard label="Roles available" value={formatCount(new Set(context.centres.flatMap(centre => centre.roles)).size)} hint="Only roles the server returned" />
      </div>
      <DataTable<CentreRow> caption="Centres" columns={columns} data={rows} getRowId={row => row.id} exportName={`MASS-centres-${role.toLowerCase().replace(/\s+/g, '-')}`} state={state === 'loading' ? 'loading' : state === 'error' ? 'error' : 'ready'} errorMessage="The centre directory could not be loaded." onRetry={load} emptyMessage="No centres are assigned to this role." />
    </div>
  );
}
