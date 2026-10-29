"""Original interface against actual isolated 001–019 RPCs, not mocked RPC responses.

Only failure-injection cases use route overrides. Auth is a synthetic local stub.
"""
import json
from playwright.sync_api import sync_playwright

def run(origin,post,token):
    checks=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        page=browser.new_page();errors=[];requests=[];responses=[];failures=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:requests.append(r.url.rsplit('/',1)[-1]) if '/rpc/' in r.url else None)
        page.on('response',lambda r:responses.append((r.url.rsplit('/',1)[-1],r.status)) if '/rpc/' in r.url else None)
        page.on('requestfailed',lambda r:failures.append(r.failure))
        page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
        page.goto(origin+'/?role=teacher')
        page.wait_for_function("document.querySelector('[data-nav=overview]')||document.querySelector('h1')?.textContent==='Programme data could not be loaded'",timeout=60000)
        if page.locator('[data-nav=overview]').count()==0 and 'net::ERR_NETWORK_CHANGED' in failures:
            page.get_by_role('button',name='Retry verified load').click()
        page.wait_for_selector('[data-nav=overview]',timeout=60000)
        assert ('get_original_capabilities',404) in responses
        assert ('get_context',200) in responses and ('get_references',200) in responses
        assert 'backend activation' in page.locator('#app').inner_text().lower()
        checks.append('Actual missing capability RPC returns HTTP404/PGRST202; verified baseline reads still render the original UI')
        students=page.evaluate('globalThis.__massLiveReviewData.students')
        headers={'Authorization':'Bearer '+token('00000000-0000-4000-8000-000000000001'),'Content-Type':'application/json','Content-Profile':'mass_api'}
        probe=post('/rpc/get_original_capabilities',b'{}',headers)
        assert probe['status']==404 and json.loads(probe['body'])['code']=='PGRST202'
        result=post('/rpc/read_students',json.dumps({'p_centre':'10000000-0000-4000-8000-000000000001','p_on':None,'p_limit':100,'p_offset':0}).encode(),headers)
        assert result['status']==200
        assert {r['enrolment_id'] for r in json.loads(result['body'])}=={s['id'] for s in students}
        checks.append('Loaded historical episode IDs exactly match an independent scoped API read')
        assert not set(requests)&{'read_delivery','read_activity_details','read_enrolment_basis','programme_aggregate','visit_summary','read_assessments'}
        checks.append('Undeployed supplements and incomplete dated-only assessment reads are not requested')
        before=len(requests);page.locator('[data-nav=children]').first.click();page.locator('[data-action=new-child]').click()
        page.wait_for_function("document.querySelector('#toast')?.textContent.includes('Backend activation pending')")
        assert not any(name.startswith(('register_','record_','correct_')) for name in requests[before:])
        checks.append('Operational controls remain present but unavailable mutations never reach an RPC')
        page.locator('[data-nav=learning]').first.click()
        assert 'Quarter-inclusive assessment API activation pending' in page.locator('#app').inner_text()
        checks.append('Quarter-inclusive assessment limitation is explicit, not a misleading zero or partial score chart')
        page.goto(origin+'/?role=leadership');page.wait_for_selector('[data-nav=overview]',timeout=60000)
        page.wait_for_function("document.querySelector('.metric-value')?.textContent!=='—'")
        assert page.locator('[data-nav=children]').count()==0
        assert 'Synthetic record' not in page.locator('#app').inner_text()
        assert 'Private-profile-safe gender aggregate API activation pending' in page.locator('#app').inner_text()
        checks.append('Leadership loads scoped counts without private names or fabricated gender counts')
        for rpc,status,code in [('get_context',403,'42501'),('get_original_capabilities',401,'PGRST301'),('get_original_capabilities',406,'PGRST106')]:
            pattern='**/rest/v1/rpc/'+rpc
            def inject_failure(route):
                route.fulfill(status=status,content_type='application/json',body=json.dumps({'code':code,'message':'Synthetic injected failure'}))
            page.route(pattern,inject_failure)
            page.reload();page.get_by_role('heading',name='Programme data could not be loaded').wait_for(timeout=60000)
            body=page.locator('#app').inner_text();assert rpc in body and str(status) in body and code in body
            assert page.locator('[data-nav]').count()==0
            page.unroute(pattern)
        checks.append('403scope/401session/406schema failures stop loading and show sanitized exact RPC diagnostics')
        assert not errors,errors
        print(json.dumps({'suite':'001–019 original-interface compatibility','checks':len(checks),'passed':len(checks),'failed':0,'scenarios':checks,'boundary':'Real isolated PG17/PostgREST with synthetic local Auth only; no hosted session/Preview evidence.'}),flush=True)
        browser.close()
