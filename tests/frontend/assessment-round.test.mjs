import test from 'node:test';
import assert from 'node:assert/strict';
import {assessmentRoundForDate,assessmentDefinitionForDate} from '../../src/live/assessment-round.js';

const year={id:'year',starts_on:'2026-04-01',ends_before:'2027-04-01'};

test('April–March dates map to F1–F4 boundaries',()=>{
  for(const [date,label] of [['2026-04-01','F1'],['2026-06-30','F1'],['2026-07-01','F2'],['2026-10-01','F3'],['2027-01-01','F4'],['2027-03-31','F4']]) {
    assert.equal(assessmentRoundForDate(date,year).label,label,date);
  }
  assert.throws(()=>assessmentRoundForDate('2026-03-31',year),/within the selected academic year/);
  assert.throws(()=>assessmentRoundForDate('2027-04-01',year),/within the selected academic year/);
});

test('date-derived rounds require an approved 25-mark definition',()=>{
  const periods=[{id:'period-2',academic_year_id:'year',quarter:2}];
  const definitions=[{id:'definition-2',period_id:'period-2',max_score:25}];
  assert.equal(assessmentDefinitionForDate('2026-08-10',year,periods,definitions).definition.id,'definition-2');
  assert.throws(()=>assessmentDefinitionForDate('2026-11-10',year,periods,definitions),/F3 has no approved/);
});
