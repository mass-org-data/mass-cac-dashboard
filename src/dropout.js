// CAC programme rule confirmed by the PM on 22 October 2026.
// Classification is derived per completed calendar month; it never changes enrolment.
export function cacDropout(student, month, today, sessions, attendance) {
  const first = month + '-01';
  const [year, number] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 10);
  const unknown = reason => ({status:'Not classified', tone:'muted', reason, assessed:false, dropout:false});
  if (today < next) return unknown('Month not complete');
  if (!student.enrolled || student.enrolled > first) return unknown('Not enrolled for the full month');
  const planned = sessions.filter(s => s.centre === student.centre && s.shift === student.shift && s.date >= first && s.date < next);
  if (!planned.length) return unknown('Session calendar missing');
  if (planned.some(s => !['Held','Cancelled'].includes(s.status))) return unknown('Session status incomplete');
  const dates = [...new Set(planned.filter(s => s.status === 'Held').map(s => s.date))];
  if (!dates.length) return unknown('No sessions held');
  const codes = dates.map(date => attendance[student.id + '|' + date]);
  if (codes.some(code => !['P','A','H'].includes(code))) return unknown('Attendance incomplete');
  if (codes.every(code => code === 'H')) return unknown('No eligible attendance days');
  const dropout = !codes.includes('P');
  return {status:dropout?'CAC dropout':'Attended this month', tone:dropout?'red':'green', reason:dropout?'Zero attendance across the completed month':'At least one session attended', assessed:true, dropout};
}
