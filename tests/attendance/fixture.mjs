import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import {runSqlScript} from '../sql-statements.mjs';
export const centre='10000000-0000-4000-8000-000000000001';
export const user=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export async function fixture({metadata=true,centreEvents=true,review=true}={}) {
 let pendingMetadata='',pendingFeedback='',pendingCentreEvents='',pendingReview='';
 const db=new PGlite();await db.waitReady;
 const read=name=>fs.readFileSync(new URL('../../'+name,import.meta.url),'utf8');
 await db.exec(read('tests/core/bootstrap.sql'));
 for(const file of fs.readdirSync(new URL('../../supabase/migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()){
  if(file.includes('swapneel_review_workflows')){pendingReview=read('supabase/migrations/'+file);continue;}
  if(file.includes('centre_wide_events')){pendingCentreEvents=read('supabase/migrations/'+file);continue;}
  if(file.includes('feedback_register_reporting')){pendingFeedback=read('supabase/migrations/'+file);continue;}
  if(file.includes('attendance_register_metadata')){pendingMetadata=read('supabase/migrations/'+file);continue;}
  const sql=read('supabase/migrations/'+file);
  if(file.includes('attendance_register_workflow')){
   const before=(await db.query("SELECT md5(pg_get_functiondef('mass_core.guard_record()'::regprocedure)) hash")).rows[0].hash;
   try{await db.exec(sql.replace('COMMIT;','SELECT 1/0;COMMIT;'));throw Error('Injected migration failure unexpectedly committed');}catch(error){if(error.code!=='22012')throw error;await db.exec('ROLLBACK;');}
   const after=(await db.query("SELECT to_regclass('mass_core.attendance_register_actions') missing,md5(pg_get_functiondef('mass_core.guard_record()'::regprocedure)) hash")).rows[0];
   if(after.missing!==null||after.hash!==before)throw Error('Migration rollback changed the original schema');
  }
  await db.exec(sql);
 }
 await db.exec(read('supabase/proposals/202611030024_reviewed_chart_metrics.sql'));
 if(metadata&&pendingMetadata)await db.exec(pendingMetadata);
 if(metadata&&pendingFeedback)await db.exec(pendingFeedback);
 const core=read('tests/core/synthetic.sql').replace('count(*)=17 AND bool_and(relrowsecurity AND relforcerowsecurity)','count(*)=28 AND bool_and(relrowsecurity AND relforcerowsecurity)').replace('bool_and(student_id=upper(id::text))',()=>"bool_and(student_id ~ '^ST_[A-Z]{2}_(10|[1-9])_[0-9]{2,}$')").replace("'428C9','generated permanent student ID cannot be overwritten'","'55000','generated permanent student ID cannot be overwritten'");
 await runSqlScript(db,core);
 await runSqlScript(db,read('tests/release/visits.sql'));
 await db.exec('RESET ROLE; BEGIN;'+read('supabase/activation/control.sql')+read('supabase/activation/seal.sql')+'COMMIT;');
 if(centreEvents&&pendingCentreEvents)await db.exec(pendingCentreEvents);
 if(metadata&&review&&pendingReview)await db.exec(pendingReview);
 await db.exec("SET ROLE mass_core_owner; UPDATE mass_activation.features SET enabled=true,approval_reference='isolated register test' WHERE feature IN ('attendance_entry','assessment_entry','reviewed_reads'); UPDATE mass_core.attendance_register_control SET enabled=true,approval_reference='isolated approved register test'; RESET ROLE;");
 async function rpc(name,args={},actor=user(1),role='authenticated') {
  if(!/^[a-z_][a-z0-9_]*$/.test(name)||Object.keys(args).some(k=>!/^p_[a-z_]+$/.test(k)))throw Error('Invalid test RPC');
  return db.transaction(async tx=>{
   await tx.exec('SET LOCAL ROLE '+role);
   await tx.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor,role})]);
   const types=(await tx.query("SELECT proargnames,oidvectortypes(proargtypes) types FROM pg_proc WHERE pronamespace='mass_api'::regnamespace AND proname=$1",[name])).rows[0];
   if(!types)throw Error('Unknown RPC '+name);
   const argTypes=types.types.split(', '),names=types.proargnames;
   const values=Object.values(args).map((v,i)=>argTypes[names.indexOf(Object.keys(args)[i])]==='jsonb'?JSON.stringify(v):v);
   const named=Object.keys(args).map((key,i)=>`${key} => $${i+1}::${argTypes[names.indexOf(key)]}`).join(',');
   const result=await tx.query(`SELECT * FROM mass_api.${name}(${named})`,values);
   return result.rows.length===1&&Object.keys(result.rows[0]).length===1?Object.values(result.rows[0])[0]:result.rows;
  });
 }
 return {db,rpc};
}
