"""Signed-JWT PostgREST checks on an ephemeral isolated Docker API, never hosted Supabase.
Auth issuance is test-only HS256; real GoTrue signup/session lifecycle is untested.
"""
import base64, hashlib, hmac, json, os, re, time, urllib.request, urllib.error
address=os.environ['MASS_TEST_API_ADDRESS']
assert re.fullmatch(r'mass-core-test-[0-9]+-[0-9]+-api:3000',address)
base='http://'+address
# This driver must stay on the internal network, regardless of client proxy defaults.
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
secret=os.environ['MASS_TEST_JWT_SECRET'].encode()
def token(subject,role='authenticated',signing_secret=None):
    def b64(v): return base64.urlsafe_b64encode(json.dumps(v,separators=(',',':')).encode()).rstrip(b'=')
    head=b64({'alg':'HS256','typ':'JWT'})
    body=b64({'role':role,'sub':subject,'exp':int(time.time())+300})
    raw=head+b'.'+body
    sig=base64.urlsafe_b64encode(hmac.new(signing_secret or secret,raw,hashlib.sha256).digest()).rstrip(b'=')
    return (raw+b'.'+sig).decode()
def request(path,subject=None,body=None,headers=None,role='authenticated',invalid=False):
    hs={'Content-Type':'application/json',**(headers or {})}
    if subject: hs['Authorization']='Bearer '+token(subject,role,b'invalid-synthetic-key' if invalid else None)
    req=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),headers=hs)
    try:
        with opener.open(req,timeout=8) as response: return response.status,response.read()
    except urllib.error.HTTPError as error: return error.code,error.read()
def check(ok,label):
    if not ok: raise AssertionError(label)
    print('PASS API:',label)
for attempt in range(40):
    try:
        request('/')
        break
    except (urllib.error.URLError,TimeoutError) as error:
        last_error=error
        time.sleep(.25)
else: raise RuntimeError('Local PostgREST unavailable: '+str(last_error))
a='00000000-0000-4000-8000-000000000001'
b='00000000-0000-4000-8000-000000000002'
leader='00000000-0000-4000-8000-000000000004'
unassigned='00000000-0000-4000-8000-000000000005'
centre='10000000-0000-4000-8000-000000000001'
summary={'p_centre':centre,'p_from':'2026-04-01','p_until':'2026-05-01'}
status,data=request('/rpc/attendance_summary',a,summary)
check(status==200 and json.loads(data)[0]['present_count']==2,'signed teacher request reads permitted aggregate')
status,data=request('/rpc/attendance_summary',b,summary)
check(status==200 and json.loads(data)[0]['present_count']==0,'other-centre token cannot read aggregate facts')
status,data=request('/rpc/attendance_summary',unassigned,summary)
check(status==200 and json.loads(data)[0]['percentage'] is None,'unassigned subject sees no programme facts')
status,_=request('/rpc/attendance_summary',a,summary,invalid=True)
check(status==401,'incorrect JWT signature rejected')
status,_=request('/rpc/attendance_summary',None,summary)
check(status in (401,403),'anonymous RPC denied')
status,data=request('/rpc/list_students',a,{'p_centre':centre,'p_on':'2026-04-01'})
check(status==200 and all(r['full_name']=='Synthetic record' for r in json.loads(data)) and len(json.loads(data))==2,'teacher profile projection follows explicit private-field capability')
status,data=request('/rpc/list_students',leader,{'p_centre':centre,'p_on':'2026-04-01'})
check(status==200 and all(r['full_name'] is None for r in json.loads(data)) and len(json.loads(data))==2,'Leadership receives programme IDs without private names')
status,data=request('/rpc/list_students',b,{'p_centre':centre,'p_on':'2026-04-01'})
check(status==200 and json.loads(data)==[],'student projection cannot cross centre scope')
student={'p_centre':centre,'p_grade':'1','p_shift':'Morning','p_start':'2026-04-01','p_name':'Synthetic API record','p_gender':'Girl'}
status,_=request('/rpc/register_student',leader,student)
check(status==403,'Leadership token cannot create student')
status,_=request('/rpc/register_student',b,student)
check(status==403,'teacher token cannot create student in another centre')
status,data=request('/rpc/register_student',a,student)
check(status==200 and len(json.loads(data)[0]['student_id'])==36,'signed teacher registration returns generated permanent ID')
registered=json.loads(data)[0]
status,_=request('/rpc/record_attendance',a,{'p_enrolment':registered['enrolment_id'],'p_date':'2026-04-01','p_code':'P','p_expected':0})
check(status==200,'signed API write and Auth subject attribution accepted')
status,data=request('/rpc/record_attendance',a,{'p_enrolment':registered['enrolment_id'],'p_date':'2026-04-01','p_code':'A','p_expected':0})
check(status==409 and json.loads(data).get('code')=='PT409','stale API revision cannot overwrite accepted attendance')
for schema in ('mass_core','mass_foundation','auth'):
    status,_=request('/children',a,headers={'Accept-Profile':schema})
    check(status==406,'private schema '+schema+' is not API exposed')
status,_=request('/source_rows',a)
check(status==404,'foundation table has no public API route')
status,_=request('/rpc/register_student',a,student,role='mass_core_owner')
check(status==403,'authenticator cannot assume forged privileged role')
print('PASS: isolated PostgREST signed-token suite (Auth lifecycle not tested).')
