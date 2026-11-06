"""Proxy-aware read-only Management query. Credentials only from environment."""
import json, os, sys, urllib.request
payload=json.load(sys.stdin)
if payload.get('read_only') is not True: raise SystemExit('Read-only payload required')
request=urllib.request.Request('https://api.supabase.com/v1/projects/pbkwpfdpdtelmvbkzgvx/database/query',data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+os.environ['SUPABASE_ACCESS_TOKEN'],'Content-Type':'application/json'})
try:
    with urllib.request.urlopen(request,timeout=90) as response: sys.stdout.write(response.read().decode())
except Exception as error:
    print('Read-only query unavailable: '+type(error).__name__,file=sys.stderr)
    raise SystemExit(1)
