"""Dependent filters in the original UI against actual isolated PostgREST."""
import csv,io,json,os,pathlib,zipfile
from playwright.sync_api import sync_playwright
A='10000000-0000-4000-8000-000000000001';B='10000000-0000-4000-8000-000000000002'
DA='Synthetic donor A';DB='Synthetic donor B'
DISABLED=os.environ.get('MASS_ACTIVATION_DISABLED_BROWSER')=='1'
Y='20000000-0000-4000-8000-000000000001';PAST='20000000-0000-4000-8000-000000000002'
def run(origin,post,token):
 checks=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=browser.new_page(viewport={'width':1280,'height':900});page.clock.set_fixed_time('2026-10-29T12:00:00+05:30');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));failures=[];page.on('requestfailed',lambda r:failures.append(r.failure));page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
  def loaded(role):
   page.goto(origin+'/?role='+role)
   page.wait_for_function("document.querySelector('[data-nav=overview]')||document.querySelector('h1')?.textContent==='Programme data could not be loaded'",timeout=60000)
   if not page.locator('[data-nav=overview]').count() and 'net::ERR_NETWORK_CHANGED' in failures:
    page.get_by_role('button',name='Retry verified load').click();failures.clear()
   try:page.wait_for_selector('[data-nav=overview]',timeout=60000)
   except Exception:
    print(json.dumps({'synthetic_startup_role':role,'errors':errors,'network_failures':failures,'synthetic_body':page.locator('body').inner_text()}),flush=True);raise
  def values(key):return page.locator('[data-filter='+key+'] option').evaluate_all('(xs)=>xs.map(x=>x.value).filter(Boolean)')
  def choose(key,value):page.locator('[data-filter='+key+']').select_option(value)
  def grades(shift):
   response=post('/rpc/read_students',json.dumps({'p_centre':A,'p_on':'2026-10-29','p_limit':100,'p_offset':0}).encode(),{'Authorization':'Bearer '+token('00000000-0000-4000-8000-000000000001'),'Content-Type':'application/json','Content-Profile':'mass_api'})
   assert response['status']==200
   return sorted({r['grade_label'] for r in json.loads(response['body']) if r['shift_code']==shift},key=int)
  loaded('teacher');choose('shift','Morning');assert values('grade')==grades('Morning');checks.append('Morning Grade options equal an independent authorized roster read')
  choose('grade','6');choose('shift','Evening');assert values('grade')==grades('Evening'),(values('grade'),grades('Evening'));assert '9' in values('grade');assert page.locator('[data-filter=grade]').input_value()=='';checks.append('Evening recalculates Grade and clears an invalid previous grade')
  choose('grade','9');choose('shift','');assert page.locator('[data-filter=grade]').input_value()=='9';choose('shift','Evening');assert page.locator('[data-filter=grade]').input_value()=='9';checks.append('A still-valid selected grade survives shift changes in either order')
  choose('shift','Morning');choose('grade','6')
  page.wait_for_function("document.querySelector('.metric-value')?.textContent==='1'")
  page.locator('[data-nav=children]').first.click();choose('shift','Morning');choose('grade','6');assert page.locator('tbody tr').count()==1
  page.locator('[data-action=guide]').first.click();page.get_by_role('dialog').wait_for();assert page.locator('a[download]').count()==1
  with page.expect_download() as source:page.locator('a[download]').click()
  with zipfile.ZipFile(source.value.path()) as archive:
   names=archive.namelist();assert any(n.endswith('src/app.js') for n in names);assert not any(n.endswith(('.xlsx','.private.json','.private.sql')) or '/.env' in n and not n.endswith('.example') for n in names)
  checks.append('Restored source download returns the actual code-only ZIP without workbooks or private artifacts')
  with page.expect_download() as downloaded:page.locator('[data-action=export]').first.click()
  page.locator('[data-action=close]').first.click()
  rows=list(csv.reader(io.StringIO(pathlib.Path(downloaded.value.path()).read_text())));assert len(rows)==2 and rows[1][3:5]==['Morning','6'];checks.append('Filtered table and CSV export contain the same single eligible episode')
  page.locator('[data-nav=overview]').first.click();choose('shift','Morning');choose('grade','6');page.wait_for_function("document.querySelector('.metric-value')?.textContent==='1'");page.wait_for_function("document.querySelector('[data-chart=\"22\"] svg')?.textContent.includes('6')")
  headers={'Authorization':'Bearer '+token('00000000-0000-4000-8000-000000000001'),'Content-Type':'application/json','Content-Profile':'mass_api'}
  data=post('/rpc/programme_aggregate' if DISABLED else '/rpc/reviewed_chart_metrics',json.dumps(({'p_centre':A} if DISABLED else {'p_centres':[A],'p_earlier':1,'p_later':2})|{'p_on':'2026-10-29','p_from':'2026-10-01','p_until':'2026-11-01','p_year':Y,'p_grade':'6','p_shift':'Morning','p_gender':None}).encode(),headers);assert data['status']==200;assert json.loads(data['body'])['students' if DISABLED else 'children']==1;checks.append('KPI and chart filtered population agree with the independently requested scoped SQL aggregate')
  page.locator('[data-chart="23"] [data-gender="Girl"]').click();assert page.locator('[data-filter=gender]').input_value()=='Girl';page.locator('[data-chart="23"] [data-gender="Girl"]').click();assert page.locator('[data-filter=gender]').input_value()=='';checks.append('Original gender chart quick filters toggle the shared population and clear on repeated click')
  assert B not in values('centre');checks.append('Teacher filter options never include another centre')
  page.locator('[data-nav=learning]').first.click();choose('academicYear',PAST);page.wait_for_function('(y)=>globalThis.__massLiveReviewData.academicYear===y&&!globalThis.__massDataLoading',arg=PAST);page.wait_for_function("[...document.querySelectorAll('[data-filter=grade] option')].filter(o=>o.value).length===0");assert page.locator('[data-filter=shift]').input_value()=='';checks.append('Academic year reload clears invalid Grade/Shift using actual historical assignment dates')
  page.locator('[data-action=reset-filters]').click();assert page.locator('[data-filter=academicYear]').input_value()==PAST;assert 'roster as of 2023-04-30' in page.locator('#app').inner_text();assert values('grade')==[];checks.append('Reset stays inside selected historical academic year and preserves an accurate empty state')
  choose('academicYear',Y);page.wait_for_function('(y)=>globalThis.__massLiveReviewData.academicYear===y&&!globalThis.__massDataLoading',arg=Y);choose('centre',A);choose('shift','Evening');assert '9' in values('grade');checks.append('Academic Year → Centre → Shift → Grade recovers current source-backed options')
  page.locator('[data-nav=morarji]').first.click();page.wait_for_selector('[data-chart="16"] svg[viewBox="0 0 640 260"]');page.locator('[data-chart="15"] [data-year]').first.click();assert page.locator('[data-filter=morarjiYear]').input_value()=='Synthetic reviewed Grade5 cohort';checks.append('Original grouped cohort columns and clickable pass-year selection are restored with verified synthetic source')
  loaded('leadership');choose('donor',DA);assert values('centre')==[A];choose('centre',A);choose('shift','Evening');assert '9' in values('grade');choose('grade','9');checks.append('Donor → Centre → Shift → Grade keeps original dependent dropdown structure')
  choose('donor',DB);assert page.locator('[data-filter=centre]').input_value()=='';assert page.locator('[data-filter=grade]').input_value()=='';assert page.locator('[data-filter=shift]').input_value()=='';assert values('centre')==[B];checks.append('Changing donor clears invalid centre/shift/grade without stale values')
  choose('donor',DA);choose('centre',A);choose('shift','Morning')
  page.wait_for_function("[...document.querySelectorAll('[data-filter=gender] option')].some(o=>o.value==='Girl')")
  choose('gender','Girl')
  aggregate=post('/rpc/programme_aggregate' if DISABLED else '/rpc/reviewed_chart_metrics',json.dumps(({'p_centre':A} if DISABLED else {'p_centres':[A],'p_earlier':1,'p_later':2})|{'p_on':'2026-10-29','p_from':'2026-10-01','p_until':'2026-11-01','p_year':Y,'p_grade':None,'p_shift':'Morning','p_gender':'Girl'}).encode(),{'Authorization':'Bearer '+token('00000000-0000-4000-8000-000000000004'),'Content-Type':'application/json','Content-Profile':'mass_api'})
  assert aggregate['status']==200;expected=sorted(json.loads(aggregate['body'])['grades'],key=int)
  page.wait_for_function("(xs)=>JSON.stringify([...document.querySelectorAll('[data-filter=grade] option')].map(o=>o.value).filter(Boolean))===JSON.stringify(xs)",arg=expected)
  assert not page.locator('[data-nav=children]').count();checks.append('Masked Leadership gender→Grade options use only authorized aggregates, never private profile inference')
  page.locator('[data-action=reset-filters]').click();assert set(values('centre'))=={A,B};assert page.locator('[data-filter=donor]').input_value()=='';checks.append('Clear/reset restores the full authorized filter scope')
  page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(pathlib.Path(os.environ['MASS_RELEASE_TEST_OUTPUT'])/'dependent-mobile.png'));checks.append('Original dropdown styling and responsive shell remain usable on mobile')
  page.locator('.mobile-menu').click();page.locator('.sidebar [data-nav=attendance]').click();assert page.get_by_role('heading',name='Attendance',exact=True).count()==1;checks.append('Mobile drawer navigation remains clickable above sticky filter controls')
  assert not errors,errors
  print(json.dumps({'suite':'dependent filters original UI / actual isolated PostgreSQL','checks':len(checks),'passed':len(checks),'failed':0,'scenarios':checks,'boundary':'Synthetic local Auth and isolated PostgREST; not hosted staff writes or Preview evidence.'}),flush=True);browser.close()
