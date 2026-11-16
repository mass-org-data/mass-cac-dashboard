import test from 'node:test';
import assert from 'node:assert/strict';
import {chartTicks,profileSortChoice} from '../../src/live/review-display.js';
import {academicProfileTable} from '../../src/live/academic-profile.js';
import {escapeHtml} from '../../src/live/html.js';
test('student axes use readable whole-number steps and retain the full range',()=>{
 assert.deepEqual(chartTicks(145),{top:150,ticks:[0,50,100,150]});
 assert.deepEqual(chartTicks(37),{top:40,ticks:[0,10,20,30,40]});
 assert.deepEqual(chartTicks(0),{top:1,ticks:[0,1]});
 assert.deepEqual(chartTicks(25,5),{top:25,ticks:[0,5,10,15,20,25]});
});
test('profile column headers reverse a sort and start another column ascending',()=>{
 assert.equal(profileSortChoice('name','name'),'-name');
 assert.equal(profileSortChoice('-name','name'),'name');
 assert.equal(profileSortChoice('-name','grade'),'grade');
});
test('academic history has one current status input and read-only previous years',()=>{
 const html=academicProfileTable([{label:'2026–2027',grade:'5',status:'Active',editable:true},{label:'2025–2026',grade:'4',status:'Graduated',editable:false}],escapeHtml);
 assert.equal((html.match(/name="academicStatus"/g)||[]).length,1);
 assert.match(html,/2025–2026 · read only/);assert.match(html,/Graduated/);assert.doesNotMatch(html,/Passed Out/);
 assert.doesNotMatch(academicProfileTable([{label:'<img src=x>',grade:'1',status:null,editable:false}],escapeHtml),/<img/);
});
