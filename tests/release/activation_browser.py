"""Real isolated PostgREST and original UI: installed but disabled operational APIs."""
import json
from playwright.sync_api import sync_playwright
def run(origin,post,token):
 checks=[];teacher='00000000-0000-4000-8000-000000000001';officer='00000000-0000-4000-8000-000000000003'
 def rpc(user,name,args):
  r=post('/rpc/'+name,json.dumps(args).encode(),{'Authorization':'Bearer '+token(user),'Content-Type':'application/json','Content-Profile':'mass_api'});return r['status'],json.loads(r['body'])
 status,caps=rpc(teacher,'get_original_capabilities',{})
 assert status==200 and caps['activation_control']==1 and not any(caps['writes'].values())
 checks.append('Real PostgREST reports installed reads separately from default-disabled operations')
 requests={
 'record_attendance':dict(p_enrolment=None,p_date=None,p_code=None,p_expected=0),
 'record_attendance_batch':dict(p_rows=[]),
 'record_assessment':dict(p_enrolment=None,p_definition=None,p_date=None,p_score=None,p_expected=0),
 'record_assessment_batch':dict(p_rows=[]),
 'record_visit':dict(p_id=None,p_assignment=None,p_shift=None,p_date=None,p_status=None,p_feedback=None,p_next_action=None,p_expected=0,p_reason=None),
 'transfer_student':dict(p_child=None,p_enrolment=None,p_profile_expected=None,p_enrolment_expected=None,p_name=None,p_gender=None,p_board=None,p_old_end=None,p_centre=None,p_grade=None,p_shift=None,p_new_start=None)}
 for name,args in requests.items():
  status,data=rpc(officer if name=='record_visit' else teacher,name,args);assert status==403 and data['code']=='42501',(name,status,data)
  checks.append('Direct HTTP API blocked while disabled: '+name)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=browser.new_page();page.clock.set_fixed_time('2026-10-29T12:00:00+05:30')
  page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(origin+'/?role=teacher');page.wait_for_selector('[data-nav="daily"]',timeout=60000)
  assert not page.locator('h1:text-is("Programme data could not be loaded")').count();checks.append('Original protected dashboard loads actual isolated data with all writes disabled')
  page.locator('[data-nav="daily"]').first.click();page.locator('[data-mark]').first.wait_for();before=page.evaluate('JSON.stringify(globalThis.__massLiveReviewData.attendanceRecords)')
  writes=[];page.on('request',lambda r:writes.append(r.url) if '/rpc/record_' in r.url else None)
  page.locator('[data-mark]').first.click();page.wait_for_function("document.querySelector('#toast')?.textContent.includes('Operational activation pending')")
  assert not writes;checks.append('Attendance control cannot submit a mutation when disabled')
  page.locator('[data-action="save-default-attendance"]').click();page.wait_for_function("document.querySelector('#toast')?.textContent.includes('explicit marks saved')")
  assert page.evaluate('JSON.stringify(globalThis.__massLiveReviewData.attendanceRecords)')==before;checks.append('Save Attendance still refreshes explicit records without writing or changing unknowns')
  page.locator('[data-nav="learning"]').first.click();page.locator('[data-action="enter-marks"]').click();page.wait_for_function("document.querySelector('#toast')?.textContent.includes('Operational activation pending')");assert not writes;checks.append('Assessment form activation requires explicit authorization metadata')
  page.goto(origin+'/?role=officer');page.wait_for_selector('[data-action="new-visit"]',timeout=60000);page.locator('[data-action="new-visit"]').first.click();page.wait_for_function("document.querySelector('#toast')?.textContent.includes('Operational activation pending')");assert not writes;checks.append('Visit entry remains unavailable despite installed visit tables and RPCs')
  assert not errors;browser.close()
 from dependent_browser import run as dependent
 dependent(origin,post,token)
 print(json.dumps({'suite':'installed but disabled gate / original UI / actual isolated PostgREST','checks':len(checks),'passed':len(checks),'failed':0,'scenarios':checks,'boundary':'Synthetic identities only. Actual hosted grant snapshot unavailable (401); no managed Auth or production write evidence.'}))
