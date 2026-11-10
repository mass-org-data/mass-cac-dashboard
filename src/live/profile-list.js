const text = value => String(value ?? '').trim();
const compareText = (left, right) => text(left).localeCompare(text(right), 'en', {numeric:true, sensitivity:'base'});

export function profileRows(students, {query = '', sort = 'name', centreLabel = id => id} = {}) {
  const term = text(query).toLocaleLowerCase('en');
  const rows = students.filter(student => !term || [student.name, student.studentId, student.id, centreLabel(student.centre)]
    .some(value => text(value).toLocaleLowerCase('en').includes(term)));
  const byName = (left, right) => compareText(left.name, right.name) || compareText(left.studentId || left.id, right.studentId || right.id);
  const comparators = {
    name: byName,
    id: (left, right) => compareText(left.studentId || left.id, right.studentId || right.id) || byName(left, right),
    centre: (left, right) => compareText(centreLabel(left.centre), centreLabel(right.centre)) || byName(left, right),
    grade: (left, right) => Number(left.grade) - Number(right.grade) || byName(left, right),
    newest: (left, right) => compareText(right.enrolled, left.enrolled) || byName(left, right),
  };
  return [...rows].sort(comparators[sort] || comparators.name);
}
