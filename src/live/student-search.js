import {escapeHtml} from './html.js';

export function studentSearchControls() {
 return '<div class="student-search-row roster-search"><label><span>Student ID</span><input type="search" data-roster-search="id" aria-label="Search Student ID" placeholder="Search ID"></label><label><span>Student Name</span><input type="search" data-roster-search="name" aria-label="Search Student Name" placeholder="Search Student Name"></label></div><p class="roster-search-count" role="status"></p>';
}

export function studentRowAttributes(student) {
 return `data-student-name="${escapeHtml(student.name||'')}" data-student-id="${escapeHtml(student.studentId||student.student_id||student.id)}"`;
}

export function bindStudentSearch(form) {
 if(!form)return;
 form.addEventListener('input',event=>{
  if(!event.target.matches('[data-roster-search]'))return;
  const id=form.querySelector('[data-roster-search=id]').value.trim().toLocaleLowerCase('en');
  const name=form.querySelector('[data-roster-search=name]').value.trim().toLocaleLowerCase('en');
  const rows=[...form.querySelectorAll('[data-student-id]')];let visible=0;
  for(const row of rows){row.hidden=!(row.dataset.studentId.toLocaleLowerCase('en').includes(id)&&row.dataset.studentName.toLocaleLowerCase('en').includes(name));if(!row.hidden)visible++;}
  form.querySelector('.roster-search-count').textContent=`${visible} of ${rows.length} students shown. All entered scores are retained.`;
 });
}
