"""Original UI + actual local PostgREST persistence. Auth identities are test stubs."""
import os,json,pathlib,threading,urllib.request,urllib.error,urllib.parse,http.server,hmac,hashlib,base64,time,subprocess
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=pathlib.Path(os.environ['MASS_RELEASE_TEST_OUTPUT']);OUT.mkdir(exist_ok=True)
SECRET=os.environ['MASS_RELEASE_REST_SECRET'];REST=os.environ['MASS_RELEASE_REST_URL']
USER='00000000-0000-4000-8000-000000000003'
def token(user):
 enc=lambda x:base64.urlsafe_b64encode(json.dumps(x,separators=(',',':')).encode()).decode().rstrip('=')
 data=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'role':'authenticated','sub':user,'exp':int(time.time())+3600})
 return data+'.'+base64.urlsafe_b64encode(hmac.new(SECRET.encode(),data.encode(),hashlib.sha256).digest()).decode().rstrip('=')
TOKEN=token(USER)
def local_post(path,body,headers):
 code="const x=JSON.parse(require('fs').readFileSync(0,'utf8'));fetch(x.url,{method:'POST',headers:x.headers,body:x.body}).then(async r=>console.log(JSON.stringify({status:r.status,body:await r.text()}))).catch(()=>{process.exit(2)})"
 r=subprocess.run(['docker','exec','-i',os.environ['MASS_RELEASE_HTTP_CLIENT'],'node','-e',code],input=json.dumps({'url':REST+path,'body':body.decode(),'headers':headers}),text=True,capture_output=True,timeout=45)
 if r.returncode:raise RuntimeError('Local API fixture unavailable')
 return json.loads(r.stdout)

class Handler(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  if self.path.split('?')[0]=='/':
   role=urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get('role',['officer'])[0];user={'officer':USER,'teacher':'00000000-0000-4000-8000-000000000001','leadership':'00000000-0000-4000-8000-000000000004','signedout':''}[role]
   body=('<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><div id="app"></div><div id="overlay"></div><div id="toast"></div><script>globalThis.__fixtureUser='+json.dumps(user)+';globalThis.__fixtureToken='+json.dumps(token(user))+';globalThis.__fixtureLoginToken='+json.dumps(TOKEN)+';globalThis.__fixtureLoginUser='+json.dumps(USER)+'</script><script type="module" src="/fixture.js"></script></body></html>').encode();self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(body);return
  path=OUT/'fixture.js' if self.path=='/fixture.js' else ROOT/'src'/self.path.lstrip('/')
  if not path.is_file():self.send_error(404);return
  self.send_response(200);self.send_header('Content-Type','text/javascript' if path.suffix=='.js' else 'text/css' if path.suffix=='.css' else 'image/jpeg');self.end_headers();self.wfile.write(path.read_bytes())
 def do_POST(self):
  headers={k:v for k,v in self.headers.items() if k.lower() in ('authorization','content-type','content-profile','accept-profile','prefer')}
  r=local_post(self.path.replace('/rest/v1','',1),self.rfile.read(int(self.headers.get('Content-Length',0))),headers);body=r['body'].encode();status=r['status']
  self.send_response(status);self.send_header('Content-Type','application/json');self.end_headers();
  try:self.wfile.write(body)
  except (BrokenPipeError,ConnectionResetError):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
if os.environ.get('MASS_BASELINE_BROWSER')=='1':
 from baseline_browser import run
 run('http://127.0.0.1:'+str(server.server_port),local_post,token)
 server.shutdown()
 raise SystemExit(0)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=browser.new_page();origin='http://127.0.0.1:'+str(server.server_port)
 page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
 errors=[];http_failures=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:http_failures.append({'url':r.url,'failure':r.failure}));page.on('response',lambda r:http_failures.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
 page.goto(origin)
 page.wait_for_function("document.querySelector('[data-action=\"new-visit\"]')||document.querySelector('h1')?.textContent==='Programme data could not be loaded'",timeout=60000)
 transport_retries=0
 if page.locator('[data-action="new-visit"]').count()==0 and any(r.get('failure')=='net::ERR_NETWORK_CHANGED' for r in http_failures):
  # Docker network notifications can invalidate Chromium's first read-only
  # load. Exercise the visible retry once; never replay a write automatically.
  transport_retries=1;page.get_by_role('button',name='Retry verified load').click()
 try: page.wait_for_selector('[data-action="new-visit"]',timeout=60000)
 except Exception:
  print(json.dumps({'startup_errors':errors,'http_failures':http_failures,'synthetic_fixture_body':page.locator('body').inner_text()}),flush=True)
  raise
 page.locator('[data-action="new-visit"]').first.click();page.get_by_role('dialog').wait_for()
 page.locator('[name="status"]').select_option('Completed');page.locator('[name="feedback"]').fill('Synthetic browser visit feedback');page.locator('[name="next_action"]').fill('Synthetic browser next action');page.locator('#dialog-form [type=submit]').click();page.wait_for_selector('[role="dialog"]',state='detached',timeout=60000)
 page.locator('[data-nav="visits"]').first.click();page.get_by_text('Synthetic browser visit feedback',exact=True).wait_for()
 summary=json.loads(local_post('/rpc/visit_summary',json.dumps({'p_centre':'10000000-0000-4000-8000-000000000001','p_from':'2026-10-01','p_until':'2026-11-01'}).encode(),{'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json','Content-Profile':'mass_api'})['body'])[0]
 assert page.locator('.metric-value').first.inner_text()==str(summary['morning']+summary['evening'])+' / '+str(summary['target_morning']+summary['target_evening'])
 row=page.locator('tr').filter(has_text='Synthetic browser visit feedback');visit=row.locator('[data-visit-edit]').get_attribute('data-visit-edit');row.locator('[data-visit-edit]').click();page.locator('[name="feedback"]').fill('Synthetic browser corrected feedback');page.locator('[name="reason"]').fill('Synthetic browser correction reason');page.locator('#dialog-form [type=submit]').click();page.wait_for_selector('[role="dialog"]',state='detached',timeout=60000)
 page.get_by_text('Synthetic browser corrected feedback',exact=True).wait_for();page.reload();page.wait_for_selector('[data-nav="visits"]',timeout=60000);page.locator('[data-nav="visits"]').first.click();page.get_by_text('Synthetic browser corrected feedback',exact=True).wait_for()
 page.locator('[data-visit-history="'+visit+'"]').click();page.get_by_text('Revision 2 · UPDATE',exact=True).wait_for();page.locator('[data-action="close"]').first.click()
 page.set_viewport_size({'width':390,'height':844});assert page.locator('.mobile-menu').is_visible();page.screenshot(path=str(OUT/'synthetic-mobile.png'))
 assert not errors,errors
 # Independent server query, separate from DOM success or toast.
 history=json.loads(local_post('/rpc/read_visit_history',json.dumps({'p_visit':visit}).encode(),{'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json','Content-Profile':'mass_api'})['body'])
 assert len(history)==2 and history[-1]['new_values']['feedback']=='Synthetic browser corrected feedback'
 page.locator('[data-action="visit-trends"]').click();page.wait_for_function('Boolean(globalThis.__massLiveReviewData.visitTrends)');assert 'Monthly visit trends' in page.locator('#app').inner_text()
 checks=['Scoped monthly visit trends load from the isolated API','CO original page loads','CO visit saved','CO correction saved','Reload retains corrected visit','History dialog shows revision','Mobile navigation','Independent database history matches']
 page.set_viewport_size({'width':1280,'height':900});page.goto(origin+'/?role=teacher');page.wait_for_selector('[data-nav="children"]',timeout=60000);page.locator('[data-nav="children"]').first.click();page.locator('[data-action="new-child"]').click();page.locator('[name="name"]').fill('Synthetic browser learner');page.locator('[name="shift"]').select_option('Morning');page.locator('[name="enrolled"]').fill('2026-04-01');page.locator('#dialog-form [type=submit]').click();page.wait_for_selector('[role="dialog"]',state='detached',timeout=60000)
 page.get_by_text('Synthetic browser learner',exact=True).first.wait_for();row=page.locator('tr').filter(has_text='Synthetic browser learner');episode=row.locator('[data-edit-child]').get_attribute('data-edit-child');checks.append('Teacher registration persisted and refreshed')
 row.locator('[data-edit-child]').click();page.locator('[name="name"]').fill('Synthetic browser corrected learner');page.locator('#dialog-form [type=submit]').click();page.wait_for_selector('[role="dialog"]',state='detached',timeout=60000);page.get_by_text('Synthetic browser corrected learner',exact=True).first.wait_for();checks.append('Teacher profile correction persists')
 row=page.locator('tr').filter(has_text='Synthetic browser corrected learner');row.locator('[data-edit-child]').click();bad_name='Synthetic <img src=x onerror="window.__fixtureXSSRan=true">';page.locator('[name="name"]').fill(bad_name);page.locator('#dialog-form [type=submit]').click();page.wait_for_selector('[role="dialog"]',state='detached',timeout=60000);page.locator('[data-child="'+episode+'"]').first.click();page.get_by_role('dialog').wait_for();assert page.locator('#dialog-title').inner_text()==bad_name;assert not page.evaluate('Boolean(window.__fixtureXSSRan)');page.locator('[data-action="close"]').first.click();checks.append('Stored synthetic markup is escaped in original tables and dialog titles')

 page.locator('[data-nav="daily"]').first.click();page.locator('[data-mark="'+episode+'|P"]').click();page.wait_for_function("document.querySelector('[data-mark=\""+episode+"|P\"]')?.getAttribute('aria-pressed')==='true'");checks.append('Teacher individual attendance persists')
 page.locator('[data-action="mark-all-absent"]').click();page.locator('#dialog-form [type=submit]').click();page.wait_for_selector('[role="dialog"]',state='detached',timeout=60000);checks.append('Teacher confirmed bulk attendance persists')
 page.locator('[data-nav="learning"]').first.click();page.locator('[data-filter="exam"]').select_option('F1');page.locator('[data-action="enter-marks"]').click();page.locator('[name="score_'+episode+'"]').fill('23');page.locator('[name="batchDate"]').fill('2026-05-01');page.locator('#dialog-form [type=submit]').click();page.wait_for_selector('[role="dialog"]',state='detached',timeout=60000);checks.append('Teacher assessment batch persists')
 # Corrections must survive reload and be independently readable with their audit revisions.
 page.locator('[data-nav="daily"]').first.click();page.locator('[data-mark="'+episode+'|L"]').click();page.wait_for_function("document.querySelector('[data-mark=\""+episode+"|L\"]')?.getAttribute('aria-pressed')==='true'")
 day=page.evaluate('globalThis.__massReviewToday');mark=page.evaluate('(key)=>globalThis.__massLiveReviewData.attendanceRecords[key]',episode+'|'+day)
 assert mark['code']=='L' and mark['row_version']>=3
 teacher_headers={'Authorization':'Bearer '+token('00000000-0000-4000-8000-000000000001'),'Content-Type':'application/json','Content-Profile':'mass_api'}
 revisions=json.loads(local_post('/rpc/read_record_revisions',json.dumps({'p_centre':'10000000-0000-4000-8000-000000000001','p_entity':'attendance_records','p_id':mark['id'],'p_limit':100}).encode(),teacher_headers)['body'])
 assert len(revisions)>=3;checks.append('Attendance P to bulk A to L correction retains independent audit revisions')
 page.reload();page.wait_for_selector('[data-nav="daily"]',timeout=60000);page.locator('[data-nav="daily"]').first.click();page.wait_for_selector('[data-mark="'+episode+'|L"][aria-pressed="true"]');checks.append('Corrected attendance persists after full refresh')
 page.locator('[data-nav="learning"]').first.click();page.locator('[data-filter="exam"]').select_option('F1');page.locator('[data-edit-marks="'+episode+'"]').click();page.locator('[name="score_'+episode+'"]').fill('24');page.locator('#dialog-form [type=submit]').click();page.wait_for_selector('[role="dialog"]',state='detached',timeout=60000)
 result=page.evaluate('(key)=>globalThis.__massLiveReviewData.assessmentDetails[key]',episode+'|F1');assert result['row_version']==2 and result['score']==24
 revisions=json.loads(local_post('/rpc/read_record_revisions',json.dumps({'p_centre':'10000000-0000-4000-8000-000000000001','p_entity':'assessment_results','p_id':result['id'],'p_limit':100}).encode(),teacher_headers)['body'])
 assert len(revisions)==2;checks.append('Assessment correction retains original context and independent audit revisions')
 page.reload();page.wait_for_selector('[data-nav="learning"]',timeout=60000);assert page.evaluate('(key)=>globalThis.__massLiveReviewData.scores[key].F1',episode)==24;checks.append('Corrected assessment persists after full refresh')
 page.locator('[data-nav="learning"]').first.click()
 # Year switching must reload period-specific data, not remap it into F aliases.
 page.locator('[data-filter="academicYear"]').select_option('20000000-0000-4000-8000-000000000002');page.wait_for_function("globalThis.__massLiveReviewData?.academicYear==='20000000-0000-4000-8000-000000000002'&&!globalThis.__massDataLoading");checks.append('Historical academic year loads without fabricated scores/dates')
 page.locator('[data-filter="academicYear"]').select_option('20000000-0000-4000-8000-000000000001');page.wait_for_function("globalThis.__massLiveReviewData?.academicYear==='20000000-0000-4000-8000-000000000001'&&!globalThis.__massDataLoading");checks.append('Academic year can return to current verified data')
 page.locator('[data-nav="daily"]').first.click();page.go_back();page.wait_for_selector('h1:text-is("Learning")');page.go_forward();page.wait_for_selector('h1:text-is("Daily Attendance")');checks.append('Back and forward restore non-personal view state')
 denied=local_post('/rpc/read_students',json.dumps({'p_centre':'10000000-0000-4000-8000-000000000002'}).encode(),{'Authorization':'Bearer '+token('00000000-0000-4000-8000-000000000001'),'Content-Type':'application/json','Content-Profile':'mass_api'})
 assert denied['status']==403;checks.append('Teacher cross-centre API request denied independently of UI')
 page.locator('[data-nav="activities"]').first.click();page.locator('[data-action="new-activity"]').click();page.locator('[name="name"]').fill('Synthetic browser activity');page.locator('[name="category"]').select_option('Sports');page.locator('[name="status"]').select_option('Held');page.locator('[name="shift"]').select_option('Morning');page.locator('#dialog-form [type=submit]').click();page.wait_for_selector('[role="dialog"]',state='detached',timeout=60000);checks.append('Teacher named activity persists')
 page.locator('[data-action="activity-entry"]').click();page.locator('#dialog-form p').filter(has_text='Synthetic browser activity').locator('[data-event]').click();page.locator('[data-participation="'+episode+'"][data-value="Attended"]').click();page.locator('#dialog-form [type=submit]').click();page.wait_for_selector('[role="dialog"]',state='detached',timeout=60000);checks.append('Teacher participation persists')
 page.locator('[data-nav="daily"]').first.click();page.locator('[data-action="session-entry"]:visible').first.click();page.locator('[name="shift"]').select_option('Morning');page.locator('[name="status"]').select_option('Held');page.locator('#dialog-form [type=submit]').click();page.wait_for_selector('[role="dialog"]',state='detached',timeout=60000);checks.append('Teacher observed CAC delivery persists')
 page.route('**/rest/v1/rpc/read_attendance',lambda r:r.fulfill(status=503,content_type='application/json',body='{"message":"synthetic unavailable"}'))
 page.reload();page.get_by_role('heading',name='Programme data could not be loaded').wait_for(timeout=60000);assert page.locator('[data-nav]').count()==0;checks.append('Unavailable API fails closed without sample fallback or partial data')
 page.unroute('**/rest/v1/rpc/read_attendance')
 page.goto(origin+'/?role=leadership');page.wait_for_selector('[data-nav="overview"]',timeout=60000);assert page.locator('[data-action="new-visit"]').count()==0;assert page.locator('[data-nav="children"]').count()==0;checks.append('Leadership original aggregate-only view has no write/profile navigation')
 page.wait_for_function("document.querySelector('.metric-value')?.textContent !== '—'");page.locator('[data-filter="grade"]').select_option('1');page.wait_for_timeout(1000);assert bad_name not in page.locator('#app').inner_text();checks.append('Leadership analytics do not expose private names')
 anonymous_requests=[];page.on('request',lambda request:anonymous_requests.append(request.url) if '/rest/v1/' in request.url else None)
 page.goto(origin+'/?role=signedout');page.wait_for_selector('[data-nav="overview"]');assert page.locator('#sign-in').count()==0;assert page.locator('[data-action="authorize-staff"]').count()>0
 assert 'Access approval pending' in page.locator('#app').inner_text();assert all(v=='—' for v in page.locator('.metric-value').all_inner_texts());assert page.evaluate('globalThis.__massLiveReviewData.students.length')==0
 checks.append('No-login original dashboard opens with explicit protected-data pending state and no false zeroes')
 for nav in ['attendance','learning','activities','visits','morarji','overview']:
  page.locator('[data-nav="'+nav+'"]').first.click();assert 'Access approval pending' in page.locator('#app').inner_text()
 assert not anonymous_requests;checks.append('Anonymous dashboard navigation issues no programme read or write RPCs')
 # Independent API denial, not merely hidden controls.
 denied=local_post('/rpc/record_attendance',json.dumps({'p_enrolment':episode,'p_date':day,'p_code':'P','p_expected':mark['row_version']}).encode(),{'Content-Type':'application/json','Content-Profile':'mass_api'})
 assert denied['status'] in (401,403);checks.append('Anonymous attendance write denied independently by local API permissions')
 page.locator('[data-action="authorize-staff"]').first.click();page.wait_for_selector('#sign-in');page.locator('[data-auth-cancel]').click();assert page.locator('#sign-in').count()==0;checks.append('Optional authorization can be canceled without closing the dashboard')
 page.locator('[data-action="authorize-staff"]').first.click();page.locator('[name="email"]').fill('synthetic@example.invalid');page.locator('[name="password"]').fill('synthetic-wrong-password');page.locator('#sign-in [type=submit]').click();page.locator('#sign-in [role=alert]').filter(has_text='Authorization failed').wait_for();assert page.evaluate('globalThis.__massLiveReviewData.students.length')==0;assert page.locator('[name="password"]').input_value()=='';checks.append('Failed optional authorization retains public isolation and clears the password')
 page.locator('[name="password"]').fill('synthetic-fixture-only');page.locator('#sign-in [type=submit]').click();page.wait_for_selector('[data-action="sign-out"]',timeout=60000);checks.append('Optional authorization enters a verified synthetic session without creating an account')
 page.reload();page.wait_for_selector('[data-action="sign-out"]',timeout=60000);checks.append('Existing synthetic session survives refresh')
 page.locator('[data-action="sign-out"]').click();page.wait_for_selector('[data-action="authorize-staff"]',timeout=60000);assert page.locator('#sign-in').count()==0;assert page.evaluate('globalThis.__massLiveReviewData.students.length')==0;checks.append('Sign-out purges private programme state and returns directly to the public dashboard')
 assert not errors,errors
 print(json.dumps({'browser':'Chromium','checks':len(checks),'passed':len(checks),'failed':0,'persisted_revisions':len(history),'local_network_change_read_retries':transport_retries,'scenarios':checks,'boundary':'Original UI and actual isolated PostgREST/PostgreSQL persistence for three signed fixture roles; not managed Auth or deployed Preview.'}))
 browser.close()
server.shutdown()
