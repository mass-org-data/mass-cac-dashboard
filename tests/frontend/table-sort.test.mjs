import test from 'node:test';
import assert from 'node:assert/strict';
import {compareTableValues} from '../../src/live/table-sort.js';
import {profileRows} from '../../src/live/profile-list.js';
test('table comparison preserves numeric order, fractions, names and missing values',()=>{
 assert(compareTableValues('2','10')<0);assert(compareTableValues('21.5%','9.0%')>0);assert(compareTableValues('1/17','2/17')<0);assert(compareTableValues('Asha','praveen')<0);assert(compareTableValues('—','0')>0);
});
test('reversed profile ordering operates over the entire matching roster',()=>{
 const students=Array.from({length:25},(_,i)=>({id:String(i),name:'Student '+String(i).padStart(2,'0'),grade:String(i%10+1)}));
 const result=profileRows(students,{sort:'-name'});assert.equal(result[0].id,'24');assert.equal(result.at(-1).id,'0');assert.equal(profileRows(students,{sort:'-grade'})[0].grade,'10');
});
