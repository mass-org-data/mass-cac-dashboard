import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
import {referenceSql} from '../../scripts/audit/sql.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('independent SQL respects October, holiday exclusions, true zero, undated quarters and matched scores',async()=>{
 const db=new PGlite();await db.waitReady;
 try {
 await db.exec(`CREATE SCHEMA mass_core;
 CREATE TABLE mass_core.centres(id uuid,label text,donor_id uuid);CREATE TABLE mass_core.donors(id uuid,label text);
 CREATE TABLE mass_core.enrolments(id uuid,child_id uuid,centre_id uuid,grade_label text,shift_code text,starts_on date,ends_before date);
 CREATE TABLE mass_core.private_child_profiles(child_id uuid,gender_code text);
 CREATE TABLE mass_core.attendance_records(id uuid,child_id uuid,enrolment_id uuid,centre_id uuid,shift_code text,attendance_date date,code text);
 CREATE TABLE mass_core.cac_sessions(centre_id uuid,shift_code text,session_date date,is_scheduled boolean);
 CREATE TABLE mass_core.academic_years(id uuid,starts_on date,ends_before date);
 CREATE TABLE mass_core.assessment_periods(id uuid,academic_year_id uuid,quarter int);
 CREATE TABLE mass_core.assessment_definitions(id uuid,period_id uuid,max_score numeric);
 CREATE TABLE mass_core.assessment_results(id uuid,child_id uuid,enrolment_id uuid,centre_id uuid,shift_code text,definition_id uuid,assessed_on date,score numeric);
 CREATE TABLE mass_core.cluster_officer_visits(id uuid,centre_id uuid,officer_id uuid,shift_code text,visit_date date,status text);
 CREATE TABLE mass_core.officer_assignments(id uuid,directory_assignment_id uuid,starts_on date,ends_before date);
 CREATE TABLE mass_core.centre_staff_assignments(id uuid,centre_id uuid,staff_member_id uuid);
 CREATE TABLE mass_core.activity_events(id uuid,centre_id uuid,shift_code text,activity_date date,category text,delivery_status text,event_kind text);
 CREATE TABLE mass_core.activity_participation(event_id uuid,child_id uuid,enrolment_id uuid,participated boolean);
 CREATE TABLE mass_core.cac_delivery_records(centre_id uuid,shift_code text,session_date date,status text);
 INSERT INTO mass_core.centres VALUES('${id(1)}','Fixture A',null),('${id(2)}','Fixture B',null);
 INSERT INTO mass_core.academic_years VALUES('${id(50)}','2026-04-01','2027-04-01');`);
 for(let n=1;n<=3;n++)await db.query('INSERT INTO mass_core.enrolments VALUES($1,$2,$3,\'5\',\'Morning\',\'2026-04-01\',null)',[id(10+n),id(20+n),id(1)]);
 await db.exec(`INSERT INTO mass_core.private_child_profiles VALUES('${id(21)}','Girl'),('${id(22)}','Boy');
 INSERT INTO mass_core.attendance_records VALUES
 ('${id(101)}','${id(21)}','${id(11)}','${id(1)}','Morning','2026-10-01','P'),
 ('${id(102)}','${id(21)}','${id(11)}','${id(1)}','Morning','2026-10-02','P'),
 ('${id(103)}','${id(22)}','${id(12)}','${id(1)}','Morning','2026-10-01','A'),
 ('${id(104)}','${id(21)}','${id(11)}','${id(1)}','Morning','2026-11-01','P'),
 ('${id(105)}','${id(21)}','${id(11)}','${id(1)}','Morning','2026-09-01','P');
 INSERT INTO mass_core.cac_sessions VALUES('${id(1)}','Morning','2026-10-02',false);`);
 for(let q=1;q<=3;q++)await db.exec(`INSERT INTO mass_core.assessment_periods VALUES('${id(60+q)}','${id(50)}',${q});INSERT INTO mass_core.assessment_definitions VALUES('${id(70+q)}','${id(60+q)}',25);`);
 for(const [n,child,q,score,date] of [[1,1,1,0,null],[2,1,2,20,null],[3,2,1,10,null],[4,2,2,0,null],[5,1,3,25,null],[6,2,3,20,'2026-11-01']])await db.query('INSERT INTO mass_core.assessment_results VALUES($1,$2,$3,$4,\'Morning\',$5,$6,$7)',[id(200+n),id(20+child),id(10+child),id(1),id(70+q),date,score]);
 const scenario={environment:'synthetic',project:'fixture',role:'Leadership',month:'2026-10',centres:[{id:id(1),label:'Fixture A'},{id:id(2),label:'Fixture B'}]};
 const results=await db.exec(referenceSql(scenario));const ref=results.find(r=>r.rows?.[0]?.audit_reference)?.rows[0].audit_reference;assert.ok(ref);
 const get=(key,dimension='All')=>ref.facts.find(f=>f.key===key&&f.dimension===dimension)?.value;
 assert.equal(get('grade','1'),0);assert.equal(get('grade','5'),3);assert.equal(get('students'),3);assert.equal(get('attendance'),50);assert.equal(get('present'),1);assert.equal(get('annual_attendance'),200/3);
 assert.equal(get('days_present','Below 15'),2);assert.equal(get('exam_coverage'),'2/3');assert.equal(get('exam_mean'),10);assert.equal(get('quarter_mean','F3'),null);assert.equal(get('matched'),2);assert.equal(get('mark_change'),5);assert.equal(get('growth'),100);assert.equal(get('visits'),null);
 assert.equal(get('centre_students','Fixture B'),0);assert.equal(get('centre_attendance','Fixture B'),null);
 const april=await db.exec(referenceSql({...scenario,month:'2026-04'}));const aprilRef=april.find(r=>r.rows?.[0]?.audit_reference)?.rows[0].audit_reference;assert.equal(aprilRef.facts.find(f=>f.key==='above20').value,0);assert.equal(aprilRef.facts.find(f=>f.key==='exam_mean').value,null);
 // Changing a filter changes the underlying cohort instead of reusing an all-student denominator.
 const next=await db.exec(referenceSql({...scenario,gender:'Girl'}));const ref2=next.find(r=>r.rows?.[0]?.audit_reference)?.rows[0].audit_reference;assert.equal(ref2.facts.find(f=>f.key==='students').value,1);
 // Distinct centres with the same label keep distinct identities in every reference key.
 await db.exec(`UPDATE mass_core.centres SET label='Repeated';`);
 const duplicated=await db.exec(referenceSql(scenario));const dupRef=duplicated.find(r=>r.rows?.[0]?.audit_reference)?.rows[0].audit_reference;
 const centreFacts=dupRef.facts.filter(f=>f.key==='centre_students');assert.equal(centreFacts.length,2);assert.equal(new Set(centreFacts.map(f=>f.dimension)).size,2);assert.ok(centreFacts.every(f=>f.dimension.startsWith('Repeated [')));
 } finally {await db.close();}
});
