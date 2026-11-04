"""Offline fictional-source visual inventory; never loads Supabase or live data.

Compare the manager-approved source with the integrated source in explicit demo
mode. Live Auth/RLS/persistence and approved chart bodies have separate tests.
"""
import http.server,json,mimetypes,pathlib,subprocess,tempfile,threading,urllib.parse
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
ORIGINAL='0b57ea193e5dd8decb9a451d0b1cea44e22322fb'
OUT=pathlib.Path(tempfile.mkdtemp(prefix='mass-original-parity-'));BASE=OUT/'original';BASE.mkdir()
for name in subprocess.check_output(['git','ls-tree','-r','--name-only',ORIGINAL,'src'],cwd=ROOT,text=True).splitlines():
 p=BASE/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(subprocess.check_output(['git','show',ORIGINAL+':'+name],cwd=ROOT))
class Handler(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  part=urllib.parse.urlsplit(self.path).path.split('/',2)
  if len(part)<2 or part[1] not in ('original','current'):self.send_error(404);return
  version=part[1];relative=part[2] if len(part)>2 else '';folder=(BASE/'src') if version=='original' else ROOT/'src'
  if not relative:
   content=b'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css">'+(b'<link rel="stylesheet" href="live.css">' if version=='current' else b'')+b'<div id="app"></div><div id="overlay"></div><div id="toast"></div><script type="module" src="app.js"></script>';mime='text/html'
  else:
   target=(folder/relative).resolve()
   if not target.is_relative_to(folder.resolve()) or not target.is_file():self.send_error(404);return
   content=target.read_bytes();mime=mimetypes.guess_type(str(target))[0] or 'application/octet-stream'
  self.send_response(200);self.send_header('Content-Type',mime);self.end_headers();self.wfile.write(content)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();origin='http://127.0.0.1:'+str(server.server_port)
cases=[('Leadership','overview'),('Leadership','attendance'),('Leadership','learning'),('Leadership','activities'),('Leadership','visits'),('Leadership','morarji'),('Leadership','donor'),('Teacher','daily'),('Teacher','children'),('Teacher','guidance')]
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for version in ['original','current']:
  for width,height in [(1280,900),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort());page.goto(origin+'/'+version+'/');page.wait_for_selector('.app')
   for role,view in cases:
    page.locator('#role').select_option(role)
    if view=='guidance':
     if width<650:
      if not page.locator('.app.menu-open').count():page.locator('.mobile-menu').click()
      guide=page.locator('.sidebar [data-action=guide]').first
      if version=='original':guide.evaluate('(el)=>el.click()')
      else:guide.click()
     else:page.locator('.top-icon[data-action=guide]').click()
     page.locator('[data-action=later-modules]').click()
    if view=='donor':page.locator('[data-action=donor]').first.click()
    else:
     nav=page.locator('[data-nav='+view+']').first
     if width<650 and not page.locator('.app.menu-open').count():page.locator('.mobile-menu').click()
     if version=='original' and width<650:nav.evaluate('(el)=>el.click()')
     else:nav.click()
    page.screenshot(path=str(OUT/f'{version}-{role}-{view}-{width}.png'),full_page=True)
    info=page.evaluate('''()=>({overflow:document.documentElement.scrollWidth>innerWidth,boxes:Object.fromEntries(['.sidebar','.topbar','.content'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,{x:r.x,width:r.width}]})),charts:[...document.querySelectorAll('[data-chart]')].filter(e=>e.dataset.chart).map(e=>({number:Number(e.dataset.chart),type:e.querySelector('.engagement-stack')?'stacked':e.querySelector('.column-chart')?'columns':e.querySelector('.bar-row')?'bars':e.querySelector('.rule-row')?'coverage':'source-state'}))})''')
    results.append({'version':version,'role':role,'view':view,'width':width,**info})
   assert not errors,errors;page.close()
 browser.close()
server.shutdown()
differences=[]
for old in [r for r in results if r['version']=='original']:
 new=next(r for r in results if r['version']=='current' and all(r[k]==old[k] for k in ['role','view','width']))
 if old['charts']!=new['charts']:differences.append({'role':old['role'],'view':old['view'],'width':old['width'],'type':'chart inventory'})
 for key,box in old['boxes'].items():
  if any(abs(box[d]-new['boxes'][key][d])>1 for d in ['x','width']):differences.append({'role':old['role'],'view':old['view'],'width':old['width'],'type':'geometry','element':key})
summary={'screenshots':len(results),'original_ref':ORIGINAL,'chart_numbers':sorted({c['number'] for r in results for c in r['charts']}),'differences':differences,'overflow_cases':sum(r['overflow'] for r in results),'reference_mobile_drawer':'Original reference has a sticky-filter stacking defect; its navigation is invoked programmatically for screenshots. Current mobile drawer must pass actual clicks.', 'boundary':'Offline fictional demo reference/screenshots. Real-data chart contracts and protected workflows verified separately; not pixel identity or deployed Preview certification.'}
(OUT/'REPORT.json').write_text(json.dumps({'summary':summary,'cases':results},indent=2));print(json.dumps({'output':str(OUT),'summary':summary}));assert not differences,differences
