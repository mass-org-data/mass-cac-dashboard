import test from 'node:test';
import assert from 'node:assert/strict';
import {loadVisitTrends,summarizeVisitMonth} from '../../src/live/visit-trends.js';
test('visit trend targets preserve two-shift completion and uncapped actual counts',()=>{
 const fourMorning=[{centre_id:'a',morning:4,evening:0,recorded_count:4}];
 assert.equal(summarizeVisitMonth(fourMorning,['a']).centresMeetingBothShifts,0);
 const over=[{centre_id:'a',morning:4,evening:2,recorded_count:7}];
 assert.equal(summarizeVisitMonth(over,['a']).actual,6);assert.equal(summarizeVisitMonth(over,['a']).achievement,150);
 assert.equal(summarizeVisitMonth(over,['a'],'Evening').actual,2);
 assert.equal(summarizeVisitMonth(over,['a'],'Evening').target,2);
 assert.equal(summarizeVisitMonth(over,['other']).actual,null);
 assert.equal(summarizeVisitMonth([{centre_id:'a',morning:0,evening:0,recorded_count:0}],['a']).actual,null);
});
test('trend reads are bounded and failures never return partial charts',async()=>{
 let active=0,maximum=0;const calls=[];
 const args={months:['2026-09','2026-10'],centres:['a','b'],concurrency:2,readSummary:async a=>{active++;maximum=Math.max(active,maximum);calls.push(a);await new Promise(r=>setTimeout(r,2));active--;return [{centre_id:a.p_centre,morning:2,evening:2,recorded_count:4}];}};
 const result=await loadVisitTrends(args);assert.equal(maximum,2);assert.equal(calls.length,4);assert.equal(result['2026-09'].length,2);
 assert(calls.some(c=>c.p_from==='2026-09-01'&&c.p_until==='2026-10-01'));
 await assert.rejects(loadVisitTrends({...args,readSummary:async a=>{if(a.p_centre==='b')throw Error('Denied');return []}}),/Denied/);
});
