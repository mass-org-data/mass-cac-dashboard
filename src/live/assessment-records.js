export function savedAssessmentGroups(db, centres) {
 const allowed = new Set(centres.map(centre => centre.id));
 const groups = new Map();
 for (const student of db.students) {
  if (!allowed.has(student.centre)) continue;
  for (const round of ['F1','F2','F3','F4']) {
   const result = db.assessmentDetails[student.id + '|' + round];
   if (!result?.id) continue;
   const key = [student.centre, round, result.date || 'unknown', student.shift].join('|');
   const group = groups.get(key) || {key, centre:student.centre, round, shift:student.shift, date:result.date || '', students:[]};
   group.students.push(student);
   groups.set(key, group);
  }
 }
 return [...groups.values()].sort((a,b) => b.date.localeCompare(a.date) || a.centre.localeCompare(b.centre) || a.round.localeCompare(b.round));
}
