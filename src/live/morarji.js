// Resolve the selected cohort before opening a follow-up. A current membership
// must never shadow a historical membership for the same enrolment.
export function selectedMorarjiMembership(db, enrolmentId, cohort, membershipId = '') {
  const current = db.morarji?.[enrolmentId];
  const candidates = [
    ...(current ? [{...current, s: {id: enrolmentId}}] : []),
    ...(db.morarjiHistory || []),
  ].filter(r => r.s?.id === enrolmentId && r.cohort === cohort && r.membershipId &&
    (!membershipId || r.membershipId === membershipId));
  const unique = new Map(candidates.map(r => [r.membershipId, r]));
  if (unique.size !== 1) throw Error('Choose one verified Morarji membership in the selected cohort. Reload the cohort before editing.');
  return [...unique.values()][0];
}
