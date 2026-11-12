import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadApi} from '../../src/live/reads.js';

const allowedCentre='10000000-0000-4000-8000-000000000001';
const setup=()=>{
 const calls=[];
 const client={schema:()=>({rpc:(name,args)=>{calls.push({name,args});return Promise.resolve({data:[],error:null});}})};
 return {calls,reads:createReadApi(client)};
};

test('profiles do not fetch attendance, assessments or activity facts',async()=>{
 const {calls,reads}=setup();
 await reads.centre({centre:allowedCentre,from:'2026-04-01',until:'2027-04-01',view:'children'});
 assert.deepEqual(calls.map(c=>c.name),['read_students']);
 assert(calls.every(c=>c.args.p_centre===allowedCentre));
});

test('assessment entry loads the full centre roster and scores, without unrelated modules',async()=>{
 const {calls,reads}=setup();
 await reads.centre({centre:allowedCentre,from:'2026-04-01',until:'2027-04-01',view:'learning'});
 assert.deepEqual(calls.map(c=>c.name),['read_students','read_assessments']);
 assert.equal(calls[0].args.p_limit,100);
});

test('explicit student detail retains the complete read contract',async()=>{
 const {calls,reads}=setup();
 await reads.centre({centre:allowedCentre,from:'2026-04-01',until:'2027-04-01',view:'student-detail'});
 assert.equal(calls.length,7);
 assert(calls.every(c=>c.args.p_centre===allowedCentre));
});
