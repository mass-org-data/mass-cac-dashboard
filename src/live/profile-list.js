const text = value => String(value ?? '').trim();
const compareText = (left, right) => text(left).localeCompare(text(right), 'en', {numeric:true, sensitivity:'base'});

export function profileRows(students, {query = '', idQuery = '', sort = 'name', centreLabel = id => id} = {}) {
  const term = text(query).toLocaleLowerCase('en');
  const idTerm=text(idQuery).toLocaleLowerCase('en');
  const rows = students.filter(student => (!idTerm || text(student.studentId||student.id).toLocaleLowerCase('en').includes(idTerm)) && (!term || [student.name, student.studentId, student.id, centreLabel(student.centre)]
    .some(value => text(value).toLocaleLowerCase('en').includes(term))));
  const byName = (left, right) => compareText(left.name, right.name) || compareText(left.studentId || left.id, right.studentId || right.id);
  const comparators = {
    name: byName,
    id: (left, right) => compareText(left.studentId || left.id, right.studentId || right.id) || byName(left, right),
    centre: (left, right) => compareText(centreLabel(left.centre), centreLabel(right.centre)) || byName(left, right),
    grade: (left, right) => Number(left.grade) - Number(right.grade) || byName(left, right),
    gender: (left, right) => compareText(left.gender, right.gender) || byName(left, right),
    shift: (left, right) => compareText(left.shift, right.shift) || byName(left, right),
    newest: (left, right) => compareText(right.enrolled, left.enrolled) || byName(left, right),
  };
  const reverse=sort.startsWith('-'),key=reverse?sort.slice(1):sort;
  return [...rows].sort((a,b)=>(comparators[key]||comparators.name)(a,b)*(reverse?-1:1));
}
