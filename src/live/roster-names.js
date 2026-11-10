// Operational users already have this narrow, centre-scoped name read through
// the attendance register. Reuse it; do not grant private-profile access.
export async function hydrateRosterNames(students, centre, readRegister, today) {
 const missing = students.filter(row => !row.full_name && row.starts_on <= today);
 const requests = new Map();
 for (const row of missing) {
  let date = today;
  if (row.ends_before && row.ends_before <= date) {
   const end = new Date(row.ends_before + 'T12:00:00Z');
   end.setUTCDate(end.getUTCDate() - 1);
   date = end.toISOString().slice(0,10);
  }
  if (date < row.starts_on) continue;
  requests.set(row.shift_code + '|' + date, {p_centre:centre, p_shift:row.shift_code, p_date:date});
 }
 const names = new Map();
 // Bound simultaneous scoped reads even when historical episodes vary.
 const values = [...requests.values()]; let index = 0;
 await Promise.all(Array.from({length:Math.min(4,values.length)}, async () => {
  while (index < values.length) {
   const result = await readRegister(values[index++]);
   for (const row of result.roster || []) if (row.name) names.set(row.id,row.name);
  }
 }));
 return students.map(row => ({...row,full_name:row.full_name || names.get(row.enrolment_id) || null}));
}
