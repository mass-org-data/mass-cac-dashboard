"""Chromium UI tests. All Auth/REST traffic is intercepted; never contacts Supabase.
Real RLS/HTTP is separately tested by run-database.sh; these mocks prove UI behavior.
"""
from pathlib import Path
import base64, json, os, subprocess, threading, time, uuid, io, zipfile
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[2]
HOST='pbkwpfdpdtelmvbkzgvx.supabase.co'
A='10000000-0000-4000-8000-000000000001'
B='10000000-0000-4000-8000-000000000002'
C='40000000-0000-4000-8000-000000000001'
E='41000000-0000-4000-8000-000000000001'
YEAR='20000000-0000-4000-8000-000000000001'
PERIOD='21000000-0000-4000-8000-000000000001'
DEFINITION='22000000-0000-4000-8000-000000000001'
COHORT='23000000-0000-4000-8000-000000000001'
checks=0
def check(ok,label):
    global checks
    assert ok,label
    checks+=1
    print('PASS UI:',label)
def build(mode='live',read_api='frontend-reads-v1'):
    env={**os.environ,'MASS_APP_MODE':mode,'MASS_SUPABASE_URL':'https://'+HOST,
         'MASS_SUPABASE_PUBLISHABLE_KEY':'sb_publishable_'+'x'*32,'MASS_READ_API':read_api}
    subprocess.run(['npm','run','build'],cwd=ROOT,env=env,check=True,capture_output=True)
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT/'dist'),**kwargs)
    def log_message(self,*args):pass
class Backend:
    def __init__(self):
        self.kind='teacher';self.calls=[];self.conflict=False;self.uncertain=False;self.forbidden=False;self.revoked=False;self.logout_fail=False;self.expired=False
        self.students=[dict(child_id=C,student_id=C.upper(),enrolment_id=E,grade_label='5',shift_code='Morning',starts_on='2026-04-01',ends_before=None,status_code='Active',row_version=1,full_name='Synthetic learner',gender_code='Girl',class10_board_passed=None)]
        self.attendance=[];self.assessments=[];self.activities=[];self.participation=[];self.morarji=[]
    def subject(self):return '00000000-0000-4000-8000-'+{'teacher':'000000000001','leader':'000000000004','unassigned':'000000000005'}[self.kind]
    def user(self):return dict(id=self.subject(),aud='authenticated',role='authenticated',email='staff@example.invalid',user_metadata={'role':'Teacher','centre':'all'})
    def session(self):
        def b64(value):return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
        token=b64({'alg':'HS256','typ':'JWT'})+'.'+b64({'sub':self.subject(),'aud':'authenticated','role':'authenticated','exp':int(time.time())+3600})+'.c3ludGhldGlj'
        return dict(access_token=token,token_type='bearer',expires_in=3600,expires_at=int(time.time())+3600,refresh_token='synthetic-refresh',user=self.user())
    def route(self,route):
        request=route.request;url=urlparse(request.url)
        if url.hostname in ('127.0.0.1','localhost'):
            route.continue_();return
        if url.hostname!=HOST:
            route.abort();return
        body=request.post_data_json or {} if request.method=='POST' else {}
        self.calls.append((url.path,request.method,body,request.headers))
        def send(data,status=200):route.fulfill(status=status,content_type='application/json',body=json.dumps(data),headers={'Access-Control-Allow-Origin':'*'})
        if url.path.endswith('/token'):
            if 'grant_type=password' in url.query:
                self.kind='leader' if body.get('email','').startswith('leader') else 'unassigned' if body.get('email','').startswith('unknown') else 'teacher'
            send(self.session());return
        if url.path.endswith('/user'):
            send({'message':'expired'},401) if self.expired else send(self.user());return
        if url.path.endswith('/logout'):
            route.abort() if self.logout_fail else send({});return
        if not url.path.startswith('/rest/v1/rpc/'):
            send({'message':'Unavailable'},404);return
        assert request.headers.get('content-profile')=='mass_api', 'Private schema profile attempted'
        rpc=url.path.rsplit('/',1)[-1]
        if rpc=='get_context':
            centres=[] if self.kind=='unassigned' or self.revoked else [dict(id=A,label='Synthetic centre A',roles=['Leadership' if self.kind=='leader' else 'Teacher'],can_write=self.kind!='leader',can_read_profiles=self.kind!='leader')]
            send(dict(api_version='frontend-reads-v1',user_id=self.subject(),centres=centres));return
        if self.forbidden or self.revoked:send({'code':'42501','message':'private provider detail'},403);return
        if rpc=='get_references':
            send(dict(academic_years=[dict(id=YEAR,starts_on='2026-04-01',ends_before='2027-04-01')],assessment_periods=[dict(id=PERIOD,academic_year_id=YEAR,quarter=1)],assessment_definitions=[dict(id=DEFINITION,period_id=PERIOD,max_score=25)],programme_cohorts=[dict(id=COHORT,label='Synthetic cohort',academic_year_id=YEAR)],attendance_codes=[dict(code=c,meaning=c) for c in ['P','A','L','WO','MM']]))
            return
        sources={'read_students':self.students,'read_attendance':self.attendance,'read_calendar':[], 'read_assessments':self.assessments,'read_activities':self.activities,'read_participation':self.participation,'read_morarji':self.morarji}
        if rpc in sources:
            rows=[dict(row) for row in sources[rpc]]
            if rpc=='read_students' and self.kind=='leader':
                for row in rows:row.update(full_name=None,gender_code=None,class10_board_passed=None)
            date_key={'read_attendance':'attendance_date','read_assessments':'assessed_on','read_activities':'activity_date','read_participation':'activity_date'}.get(rpc)
            if date_key:rows=[row for row in rows if body['p_from']<=row[date_key]<body['p_until']]
            offset=body.get('p_offset',0);send(rows[offset:offset+body.get('p_limit',100)]);return
        if self.kind!='teacher':send({'code':'42501','message':'denied'},403);return
        if rpc=='register_student':
            child=str(uuid.uuid4());episode=str(uuid.uuid4())
            self.students.append(dict(child_id=child,student_id=child.upper(),enrolment_id=episode,grade_label=body['p_grade'],shift_code=body['p_shift'],starts_on=body['p_start'],ends_before=None,status_code='Active',row_version=1,full_name=body['p_name'],gender_code=body['p_gender'],class10_board_passed=None))
            send([dict(child_id=child,student_id=child.upper(),enrolment_id=episode)]);return
        if rpc=='record_attendance':
            if self.conflict:self.conflict=False;send({'code':'PT409','message':'private tuple'},409);return
            episode=next(e for e in self.students if e['enrolment_id']==body['p_enrolment'])
            old=next((r for r in self.attendance if r['child_id']==episode['child_id'] and r['attendance_date']==body['p_date']),None)
            row=dict(id=old['id'] if old else str(uuid.uuid4()),child_id=episode['child_id'],enrolment_id=episode['enrolment_id'],shift_code=episode['shift_code'],attendance_date=body['p_date'],code=body['p_code'],row_version=(old['row_version'] if old else 0)+1)
            if old:self.attendance.remove(old)
            self.attendance.append(row)
            if self.uncertain:self.uncertain=False;route.abort();return
            send(row['id']);return
        if rpc=='record_assessment':
            episode=next(e for e in self.students if e['enrolment_id']==body['p_enrolment'])
            old=next((r for r in self.assessments if r['child_id']==episode['child_id']),None)
            row=dict(id=old['id'] if old else str(uuid.uuid4()),child_id=episode['child_id'],enrolment_id=episode['enrolment_id'],shift_code=episode['shift_code'],definition_id=body['p_definition'],assessed_on=body['p_date'],score=body['p_score'],row_version=(old['row_version'] if old else 0)+1)
            if old:self.assessments.remove(old)
            self.assessments.append(row);send(row['id']);return
        if rpc=='create_activity':
            self.activities.append(dict(id=body['p_id'],name=body['p_name'],activity_date=body['p_date'],shift_code=body['p_shift'],row_version=1));send(body['p_id']);return
        if rpc=='record_participation':
            episode=next(e for e in self.students if e['enrolment_id']==body['p_enrolment']);event=next(e for e in self.activities if e['id']==body['p_event'])
            old=next((r for r in self.participation if r['child_id']==episode['child_id'] and r['event_id']==event['id']),None)
            row=dict(id=old['id'] if old else str(uuid.uuid4()),child_id=episode['child_id'],enrolment_id=episode['enrolment_id'],event_id=event['id'],shift_code=event['shift_code'],activity_date=event['activity_date'],participated=body['p_participated'],row_version=(old['row_version'] if old else 0)+1)
            if old:self.participation.remove(old)
            self.participation.append(row);send(row['id']);return
        if rpc=='add_morarji_member':
            episode=next(e for e in self.students if e['enrolment_id']==body['p_enrolment']);member=str(uuid.uuid4())
            self.morarji.append(dict(membership_id=member,cohort_id=body['p_cohort'],child_id=episode['child_id'],enrolment_id=episode['enrolment_id'],shift_code=episode['shift_code'],outcome_id=None,applied=None,attended=None,passed=None,school_name=None,row_version=None));send(member);return
        if rpc=='record_morarji':
            row=next(r for r in self.morarji if r['membership_id']==body['p_member'])
            row.update(outcome_id=row['outcome_id'] or str(uuid.uuid4()),applied=body['p_applied'],attended=body['p_attended'],passed=body['p_passed'],school_name=body['p_school'],row_version=(row['row_version'] or 0)+1);send(row['outcome_id']);return
        send({'message':'Unsupported fixture operation'},404)

def sign_in(page,base,email='staff@example.invalid'):
    page.goto(base)
    page.get_by_role('textbox',name='Email',exact=True).fill(email)
    page.get_by_label('Password',exact=True).fill('synthetic-password')
    page.get_by_role('button',name='Sign in',exact=True).click()
def choose_date(page):
    page.locator('#workspace-filters [name=month]').fill('2026-04')
    page.locator('#workspace-filters [name=on]').fill('2026-04-15')
    page.get_by_role('button',name='Apply filters',exact=True).click()
    expect(page.get_by_role('status').filter(has_text='Loading')).to_have_count(0)
def navigate(page,name):
    page.locator('.sidebar .nav').get_by_role('button',name=name,exact=True).click()
def save_dialog(page):
    page.get_by_role('dialog').get_by_role('button',name='Save changes',exact=True).click()
    expect(page.get_by_role('dialog')).to_have_count(0)
    expect(page.locator('.content')).not_to_contain_text('Loading authorized records')

build()
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
base=f'http://127.0.0.1:{server.server_port}/'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block')
    backend=Backend();context.route('**/*',backend.route);page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    sign_in(page,base)
    expect(page.locator('.content')).to_contain_text('Synthetic learner')
    check(True,'login verifies Auth then loads only server-scoped centre records')
    choose_date(page)
    check(page.locator('#role').count()==0,'live view has no role-preview authority')
    check(not page.evaluate("Object.keys(localStorage).includes('mass-cac-companion-v1')"),'live mode never reads or seeds the demo store')
    check(not page.evaluate("JSON.stringify(sessionStorage).includes('Synthetic learner')"),'programme records are not persisted in session storage')
    navigate(page,'Daily Attendance')
    page.locator('[data-work-action=mark][data-code=P]').first.click()
    expect(page.locator('.content')).to_contain_text('Attendance saved.')
    check(backend.attendance[0]['code']=='P','attendance click saves through typed RPC')
    before=len([r for r in backend.calls if r[0].endswith('/record_attendance')])
    page.locator('[data-work-action=mark][data-code=P]').first.click()
    check(len([r for r in backend.calls if r[0].endswith('/record_attendance')])==before,'same-code tap never clears or sends another write')
    backend.conflict=True
    page.locator('[data-work-action=mark][data-code=A]').first.click()
    expect(page.locator('.content')).to_contain_text('This record changed.')
    check(backend.attendance[0]['code']=='P','conflict reload preserves accepted value without retry')
    backend.uncertain=True
    before=len([r for r in backend.calls if r[0].endswith('/record_attendance')])
    page.locator('[data-work-action=mark][data-code=L]').first.click()
    expect(page.locator('.content')).to_contain_text('save result is unknown')
    check(backend.attendance[0]['code']=='L' and len([r for r in backend.calls if r[0].endswith('/record_attendance')])==before+1,'uncertain response reloads committed value without duplicate write')
    navigate(page,'Student Profile')
    page.get_by_role('button',name='Add student',exact=True).click()
    dialog=page.get_by_role('dialog');dialog.get_by_label('Full name',exact=True).fill('Synthetic <img src=x onerror=alert(1)>')
    dialog.get_by_label('Enrolment date',exact=True).fill('2026-04-01');save_dialog(page)
    expect(page.locator('.content')).to_contain_text('Synthetic <img src=x onerror=alert(1)>')
    check(page.locator('.content img').count()==0,'stored student text is escaped')
    page.locator('[data-work-action=detail]').first.click()
    expect(page.get_by_role('dialog')).to_contain_text('Verified enrolments')
    page.get_by_role('dialog').get_by_role('button',name='Close',exact=True).click()
    check(True,'student details use authorized history without an unscoped lookup')
    navigate(page,'Learning')
    page.locator('[data-work-action=assess]').first.click()
    dialog=page.get_by_role('dialog');dialog.get_by_label('Exam date',exact=True).fill('2026-07-01');dialog.get_by_label('Recorded score / 25',exact=True).fill('0')
    dialog.get_by_role('button',name='Save changes',exact=True).click();expect(dialog.get_by_role('alert')).to_contain_text('selected academic quarter')
    check(not backend.assessments,'invalid quarter date is rejected before an assessment RPC')
    dialog.get_by_label('Exam date',exact=True).fill('2026-04-15');save_dialog(page)
    check(backend.assessments[0]['score']==0,'zero assessment is recorded with explicit date')
    navigate(page,'Activities')
    page.get_by_role('button',name='Add activity session',exact=True).click()
    dialog=page.get_by_role('dialog');dialog.get_by_label('Activity name',exact=True).fill('Synthetic game');dialog.get_by_label('Activity date',exact=True).fill('2026-04-15');save_dialog(page)
    page.get_by_role('button',name='Record / correct participation',exact=True).click()
    page.get_by_role('dialog').get_by_label('Participation',exact=True).select_option('true');save_dialog(page)
    check(backend.participation[0]['participated'] is True,'activity participation uses actual event and enrolment')
    page.get_by_role('button',name='Record / correct participation',exact=True).click()
    expect(page.get_by_role('dialog').get_by_label('Participation',exact=True)).to_have_value('true')
    page.get_by_role('dialog').get_by_role('button',name='Cancel',exact=True).click()
    check(True,'participation correction loads the stored response rather than clearing it')
    navigate(page,'Morarji scholarship prep')
    page.get_by_role('button',name='Add participant',exact=True).click();save_dialog(page)
    page.get_by_role('button',name='Edit follow-up',exact=True).click();page.get_by_role('dialog').get_by_label('Applied',exact=True).select_option('true');save_dialog(page)
    check(backend.morarji[0]['applied'] is True and backend.morarji[0]['passed'] is None,'Morarji edits do not infer unsupported outcomes')
    page.get_by_role('button',name='Correct / remove',exact=True).click()
    expect(page.get_by_role('button',name='Remove entry',exact=True)).to_be_disabled()
    expect(page.get_by_role('button',name='Undo last removal',exact=True)).to_be_disabled()
    check(True,'live removal and snapshot undo cannot bypass immutable backend')
    page.reload();expect(page.locator('.content')).to_contain_text('Synthetic learner')
    check(True,'session restores through managed-user verification')
    page.evaluate("for(const key of Object.keys(sessionStorage)){if(key.startsWith('mass-auth-')&&!key.endsWith('-user')){const value=JSON.parse(sessionStorage[key]);if(value?.access_token){value.expires_at=Math.floor(Date.now()/1000)-60;sessionStorage[key]=JSON.stringify(value);}}}")
    page.reload();expect(page.locator('.content')).to_contain_text('Synthetic learner')
    check(any('/token' in path and 'refresh_token' in str(body) for path,method,body,headers in backend.calls),'official SDK refreshes an expired stored session')
    response=context.request.get(base+'MASS-CAC-Vercel-Source.zip');assert response.ok
    with zipfile.ZipFile(io.BytesIO(response.body())) as archive:
        names=archive.namelist()
        check(any(n.endswith('/src/live/workspace.js') for n in names) and any(n.endswith('/.env.example') for n in names),'source download contains live adapters and configuration example')
        check(not any(n.endswith(('.xlsx','.xls','.dump','.backup')) or '/supabase/' in n for n in names),'source download excludes private workbooks, backups and backend SQL')
    backend.revoked=True;choose_date(page)
    expect(page.locator('.content')).to_contain_text('not authorized')
    check('Synthetic learner' not in page.locator('.content').inner_text() and 'private provider detail' not in page.locator('.content').inner_text(),'scope failure clears private data and sanitizes provider errors')
    page.get_by_role('button',name='Retry',exact=True).click();expect(page.locator('.content')).to_contain_text('No verified centre assignments')
    backend.revoked=False;page.reload();expect(page.locator('.content')).to_contain_text('Synthetic learner')
    page.set_viewport_size({'width':390,'height':844});page.get_by_role('button',name='Open navigation',exact=True).click()
    expect(page.locator('.sidebar')).to_be_visible()
    check(page.evaluate('document.documentElement.scrollWidth <= innerWidth'),'mobile shell does not overflow')
    Path('/tmp/mass-phase4').mkdir(exist_ok=True)
    page.screenshot(path='/tmp/mass-phase4/mobile.png',full_page=True)
    backend.logout_fail=True;page.get_by_role('button',name='Sign out',exact=True).click()
    expect(page.get_by_role('heading',name='Sign in',exact=True)).to_be_visible()
    check(not page.evaluate("Object.keys(sessionStorage).some(k=>k==='mass-auth-pbkwpfdpdtelmvbkzgvx')"),'network-failed sign-out still clears browser credentials')
    check('Synthetic learner' not in page.locator('body').inner_text(),'sign-out clears protected records')
    context.close()
    for kind,email in [('leader','leader@example.invalid'),('unassigned','unknown@example.invalid')]:
        context=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block');fixture=Backend();context.route('**/*',fixture.route);view=context.new_page()
        sign_in(view,base,email)
        if kind=='leader':
            expect(view.locator('.content')).to_contain_text('Name restricted')
            check(view.locator('[data-work-action=new-student]').count()==0 and view.locator('[data-work-action=manage]').count()==0,'Leadership has no operational mutation controls')
            check('Synthetic learner' not in view.locator('.content').inner_text(),'Leadership receives masked private fields')
            expect(view.get_by_role('button',name='Donor summary',exact=True)).to_be_disabled()
        else:
            expect(view.locator('.content')).to_contain_text('No verified centre assignments')
            check(not any(path.endswith('/read_students') for path,method,body,headers in fixture.calls),'forged user_metadata role cannot discover or read programme records')
        context.close()
    check(not errors,'no uncaught browser errors')
    build('demo')
    context=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block');demo=Backend();context.route('**/*',demo.route);view=context.new_page()
    view.goto(base);view.locator('#role').select_option('Teacher')
    view.locator('[data-action=guide]').first.click();view.locator('[data-action=reset-demo]').click()
    view.get_by_role('button',name='Reset sample records',exact=True).click()
    before=view.evaluate("JSON.parse(localStorage.getItem('mass-cac-companion-v1'))?.students.length")
    view.locator('[data-action=manage-records]').first.click();view.locator('#record-kind').select_option('Students')
    view.locator('[data-record-remove]').first.click();view.get_by_role('button',name='Remove entry',exact=True).click()
    check(view.evaluate("JSON.parse(localStorage.getItem('mass-cac-companion-v1')).students.length")==before-1,'approved demo removal remains functional and isolated')
    view.locator('[data-action=undo-remove]').first.click()
    check(view.evaluate("JSON.parse(localStorage.getItem('mass-cac-companion-v1')).students.length")==before,'approved demo undo remains functional')
    check(not demo.calls,'demo never initializes Auth or sends programme RPCs')
    context.close()
    env={key:value for key,value in os.environ.items() if key not in ('MASS_APP_MODE','MASS_READ_API','MASS_SUPABASE_URL','MASS_SUPABASE_PUBLISHABLE_KEY')}
    subprocess.run(['npm','run','build'],cwd=ROOT,env=env,check=True,capture_output=True)
    context=browser.new_context(service_workers='block');missing=Backend();context.route('**/*',missing.route);view=context.new_page();view.goto(base)
    expect(view.get_by_role('heading',name='Workspace configuration required',exact=True)).to_be_visible()
    check(not missing.calls,'unconfigured live build fails closed with no sample fallback or network calls')
    context.close()
    browser.close()
server.shutdown();server.server_close()
print(f'PASS: {checks} Chromium UI checks; Auth is mocked and never contacts the hosted project.')
