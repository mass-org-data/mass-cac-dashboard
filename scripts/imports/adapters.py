"""Review-only historical observations. No inferred dates/identities or database writes."""
from datetime import date,datetime
from decimal import Decimal,InvalidOperation
from common import json_value
FIELDS={
 'child':{'student_name','source_id','centre','grade','gender','shift','enrolled','status','exit_date','class10_board_passed'},
 'attendance':{'student_name','source_id','centre','grade','shift'},
 'assessment':{'student_name','source_id','centre','grade','shift','assessed_on','academic_year','quarter','score','max_score','paper'},
 'activity':{'student_name','source_id','centre','grade','shift','month','slot_1','slot_2','slot_3','slot_4'},
 'morarji':{'student_name','source_id','centre','grade','shift','observed_on','cohort','academic_year','applied','attended','passed','school_name'},
 'visit':{'officer','centre','shift','visited_on','assessment_score'},
}
def iso_day(v):
 if isinstance(v,datetime):return v.date().isoformat()
 if isinstance(v,date):return v.isoformat()
 if isinstance(v,str) and len(v)==10:
  try:
   if date.fromisoformat(v).isoformat()==v:return v
  except ValueError:pass
 return None

def observation(kind,raw,extra=None):
 out={k:json_value(v) for k,v in raw.items()};issues=['unverified_identity']
 if any(isinstance(v,str) and v.startswith('=') for v in raw.values()):issues.append('formula_value_unverified')
 if kind=='child':
  issues.append('D10_sensitive_baseline_approval_required')
  if not iso_day(raw.get('enrolled')):issues.append('missing_verified_enrolment_date')
 elif kind=='attendance':
  on=iso_day((extra or {}).get('date'));code=str((extra or {}).get('code') or '').strip()
  out.update(attendance_date=on,source_date=json_value((extra or {}).get('date')),code=code or None)
  if not on:issues.append('missing_verified_attendance_date')
  if not code:issues.append('unrecorded_unknown')
  elif code not in ('P','A','L','WO','MM'):issues.append('unverified_attendance_code')
 elif kind=='assessment':
  on=iso_day(raw.get('assessed_on'));out['verified_date']=on
  if not on:issues.append('missing_verified_assessment_date')
  if not raw.get('academic_year'):issues.append('missing_verified_academic_year')
  if raw.get('quarter') not in ('Q1','Q2','Q3','Q4',1,2,3,4):issues.append('unverified_quarter')
  try:
   score=Decimal(str(raw.get('score')))
   if not score.is_finite() or not 0<=score<=25:issues.append('score_outside_current_scale')
   elif score!=score.to_integral_value():issues.append('assessment_precision_approval_required')
  except InvalidOperation:issues.append('missing_or_invalid_score')
  if str(raw.get('max_score')) not in ('25','25.0'):issues.append('historical_scale_conflict_no_rescale')
 elif kind=='activity':
  issues.append('historical_monthly_response_no_named_event_inference')
  if not raw.get('month'):issues.append('missing_source_month')
 elif kind=='morarji':
  if not raw.get('cohort') or not raw.get('academic_year'):issues.append('missing_verified_cohort_period')
  for k in ('applied','attended','passed'):
   v=raw.get(k)
   if v not in (None,'',True,False,'Yes','No'):issues.append('unverified_outcome_value')
  if raw.get('passed') in (True,'Yes') and raw.get('attended') in (False,'No'):issues.append('source_outcome_conflict')
 elif kind=='visit':
  if not iso_day(raw.get('visited_on')):issues.append('missing_verified_visit_date')
  issues.append('visit_module_not_implemented')
 return {'values':out,'issues':sorted(set(issues)),'operational_import_ready':False}
