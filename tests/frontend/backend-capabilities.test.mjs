import test from 'node:test';
import assert from 'node:assert/strict';
import {BackendError} from '../../src/live/api.js';
import {discoverCapabilities,safeDiagnosticText} from '../../src/live/backend-capabilities.js';
import {baselineAggregates} from '../../src/live/baseline-aggregates.js';
import {createReadApi} from '../../src/live/reads.js';

test('only the exact absent optional capability RPC enables baseline scoped reads',async()=>{
 const missing=new BackendError({code:'PGRST202'},404,false,'get_original_capabilities');
 const caps=await discoverCapabilities(async()=>{throw missing});assert.equal(caps.baseline,true);assert.equal(caps.periodAssessments,false);
 for(const error of [new BackendError({code:'PGRST106'},406,false,'get_original_capabilities'),new BackendError({code:'42501'},403,false,'get_original_capabilities'),new BackendError({code:'PGRST301'},401,false,'get_original_capabilities'),new BackendError({code:'PGRST202'},404,false,'get_context'),new BackendError({code:''},404,false,'get_original_capabilities'),new BackendError({},0,false,'get_original_capabilities')])await assert.rejects(discoverCapabilities(async()=>{throw error}),e=>e===error);
 const partial=await discoverCapabilities(async()=>({original_workflows:20,period_assessments:true}));assert.equal(partial.originalWorkflows,true);assert.equal(partial.operationalDetails,false);
 const full=await discoverCapabilities(async()=>({original_workflows:20,period_assessments:true,operational_details:22,aggregate_api:23}));assert.equal(full.aggregates,true);
 await assert.rejects(discoverCapabilities(async()=>({original_workflows:999})),/not recognized/);
});
test('failure diagnostics identify the RPC without retaining provider payload or request data',()=>{
 const error=new BackendError({code:'PGRST202',details:'Synthetic private sentinel',hint:'Synthetic secret sentinel',message:'Synthetic household sentinel'},404,false,'get_original_capabilities');
 assert.equal(safeDiagnosticText(error),'API: mass_api.get_original_capabilities · HTTP 404 · PGRST202');
 assert(!JSON.stringify(error).includes('sentinel'));assert.equal(safeDiagnosticText(new Error('private')), '');
});
test('baseline summaries preserve snapshot/holiday/leave rules without inferring demographics or scores',()=>{
 const centres=[{id:'a',donor:'x'},{id:'b',donor:'y'}];
 const students=[{id:'e',centre:'a',enrolled:'2026-04-01',exitDate:null,grade:'5',shift:'Morning'}, {id:'f',centre:'b',enrolled:'2026-04-01',exitDate:null,grade:'5',shift:'Evening'}];
 const db={students,calendar:[{centre:'a',shift:'Morning',date:'2026-10-04',status:'Not Scheduled'}],attendanceRecords:Object.fromEntries(['P','A','L','P','WO','MM'].map((code,i)=>[i,{enrolment_id:'e',attendance_date:`2026-10-0${i+1}`,shift_code:'Morning',code}]))};
 const result=baselineAggregates(db,centres,{month:'2026-10',today:'2026-10-29',page:'overview',grade:'5',donor:'x',officer:'ignored-selection'});
 assert.equal(result[0].students,1);assert.equal(result[1].students,1);assert.deepEqual(result[0].attendance,{p:1,a:1,l:1,excluded:3});
 assert.deepEqual(result[0].genders,{});assert.deepEqual(result[0].quarters,[]);assert.deepEqual(result[0].changes,[]);
 assert.throws(()=>baselineAggregates(db,centres,{month:'2026-10',gender:'Girl'}),/needs/);
 assert.throws(()=>baselineAggregates({...db,attendanceRecords:{bad:{enrolment_id:'unknown',attendance_date:'2026-10-01',code:'P'}}},centres,{month:'2026-10'}),/unavailable authorized enrolment/);
});
test('baseline loading does not query dated-only assessments and critical failures keep RPC identity',async()=>{
 const calls=[];const client={schema(){return{rpc(name){calls.push(name);const response=Promise.resolve({data:[],status:200,error:null});response.abortSignal=()=>response;return response;}}}};
 const result=await createReadApi(client).centre({centre:'synthetic',from:'2026-04-01',until:'2027-04-01',includeAssessments:false});
 assert.deepEqual(result.assessments,[]);assert(!calls.includes('read_assessments'));assert(calls.includes('read_attendance'));
 const failed={schema(){return{rpc(){return Promise.resolve({error:{code:'42501'},status:403})}}}};
 await assert.rejects(createReadApi(failed).context(),e=>e.rpc==='get_context'&&e.status===403);
});
