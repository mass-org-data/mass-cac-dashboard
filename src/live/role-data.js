const ROLE_ORDER = ['Leadership', 'Cluster Officer', 'Teacher'];

export function authorizedRoles(context) {
  const found = new Set((context?.centres || []).flatMap(centre => centre.roles || []));
  return ROLE_ORDER.filter(role => found.has(role));
}

export function defaultAuthorizedRole(context) {
  const roles = authorizedRoles(context);
  return roles[0] || null;
}

export function roleDataPlan(context, role, {aggregateApi = true, view = 'details'} = {}) {
  const roles = authorizedRoles(context);
  if (!roles.includes(role)) throw new Error('Choose an authorized role.');
  const centres = context.centres.filter(centre => centre.roles.includes(role));
  const overviewOnly = aggregateApi && ['overview','donor','visits'].includes(view);
  const aggregateMode = overviewOnly || role === 'Leadership' || centres.some(centre => !centre.can_read_profiles);
  let detailedCentres = [];
  if (overviewOnly) {
    detailedCentres = [];
  } else if (role === 'Leadership') {
    if (!aggregateApi) detailedCentres = centres;
  } else if (context.operational_roles_enabled === true) {
    detailedCentres = centres.filter(centre => centre.can_write);
  } else if (!aggregateMode || !aggregateApi) {
    detailedCentres = centres;
  }
  return Object.freeze({role, roles, centres, detailedCentres, aggregateMode});
}
