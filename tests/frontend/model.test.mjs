import test from 'node:test';
import assert from 'node:assert/strict';
import {monthWindow,roster,filteredFacts,attendanceTotals,eligibleEpisode,combineCentres,quarterWindow} from '../../src/live/model.js';

const episode={child_id:'child',student_id:'ID',enrolment_id:'old',starts_on:'2026-04-01',ends_before:'2026-07-01',grade_label:'5',shift_code:'Morning',full_name:null,gender_code:null};
test('month windows and exclusive historical assignments preserve boundaries',()=>{
  assert.deepEqual(monthWindow('2028-02'),{from:'2028-02-01',until:'2028-03-01'});
  assert.equal(roster({students:[episode]},'2026-06-30').length,1);
  assert.equal(roster({students:[episode]},'2026-07-01').length,0);
  assert.throws(()=>monthWindow('2026-13'));
});
test('grade/shift filters apply to facts through historical episode, not current profile',()=>{
  const newer={...episode,enrolment_id:'new',grade_label:'6',shift_code:'Evening',starts_on:'2026-07-01',ends_before:null};
  const data={students:[episode,newer],attendance:[{enrolment_id:'old',code:'P'},{enrolment_id:'new',code:'A'}]};
  assert.deepEqual(filteredFacts(data,'attendance',{grade:'5'}),[data.attendance[0]]);
  assert.deepEqual(filteredFacts(data,'attendance',{shift:'Evening'}),[data.attendance[1]]);
  assert.equal(roster(data,'2026-07-01',{gender:'Girl'}).length,0);
});
test('attendance counts recorded P/A/L only and excludes WO/MM/confirmed holidays',()=>{
  const rows=['P','A','L','WO','MM'].map((code,i)=>({code,centre_id:'a',shift_code:'Morning',attendance_date:`2026-04-0${i+1}`}));
  const counts=attendanceTotals(rows);assert.equal(counts.percentage,100/3);assert.equal(counts.excluded,2);
  assert.equal(attendanceTotals([]).percentage,null);
  const calendar=[{centre_id:'a',shift_code:'Morning',session_date:'2026-04-01',is_scheduled:false}];
  assert.equal(attendanceTotals(rows,calendar).p,0);assert.equal(attendanceTotals(rows,calendar).excluded,3);
});
test('ambiguous assignment is never automatically resolved for new facts',()=>{
  assert.equal(eligibleEpisode({students:[episode]},'child','2026-04-01','Morning'),episode);
  assert.throws(()=>eligibleEpisode({students:[episode,{...episode,enrolment_id:'other'}]},'child','2026-04-01','Morning'));
  assert.throws(()=>eligibleEpisode({students:[episode]},'child','2026-07-01','Morning'));
});
test('combined reads retain each server-verified centre context',()=>{
  const keys=['students','attendance','calendar','assessments','activities','participation','morarji'];
  const datasets=['a','b'].map(centre=>({centre,...Object.fromEntries(keys.map(k=>[k,k==='students'?[{...episode}]:[]]))}));
  assert.deepEqual(combineCentres(datasets).students.map(s=>s.centre_id),['a','b']);
});
test('quarter dates derive only from an actual approved year/period reference',()=>{
  const refs={academic_years:[{id:'year',starts_on:'2027-04-01',ends_before:'2028-04-01'}],assessment_periods:[{id:'period',academic_year_id:'year',quarter:4}]};
  assert.deepEqual(quarterWindow({period_id:'period'},refs),{from:'2028-01-01',until:'2028-04-01'});
  assert.throws(()=>quarterWindow({period_id:'missing'},refs));
});
