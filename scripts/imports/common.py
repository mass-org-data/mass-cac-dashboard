"""Private import artifacts, deterministic fingerprints and strict validation."""
import hashlib,hmac,json,os,re,uuid
from datetime import date,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
NAMESPACE=uuid.UUID('3aff6083-4f21-45f4-93a6-a76618fa85a0')
class Invalid(ValueError):pass
def json_value(v):
 if isinstance(v,(datetime,date)):return v.isoformat()
 if isinstance(v,(str,int,float,bool)) or v is None:return v
 return str(v)
def canonical(v):return json.dumps(v,ensure_ascii=True,sort_keys=True,separators=(',',':'),allow_nan=False)
def digest(v):return hashlib.sha256(canonical(v).encode()).hexdigest()
def ident(*parts):return str(uuid.uuid5(NAMESPACE,canonical(parts)))
def uid(v):
 try:
  result=str(uuid.UUID(v))
  if result!=v or result==str(uuid.UUID(int=0)):raise ValueError()
  return result
 except (ValueError,TypeError,AttributeError):raise Invalid('Expected an explicit canonical UUID.') from None
def text(v,max_length=200):
 if not isinstance(v,str) or not v.strip() or len(v)>max_length or '\x00' in v:raise Invalid('Invalid reviewed text value.')
 return v
def private_path(p):
 p=Path(p).resolve()
 if p==ROOT or ROOT in p.parents:raise Invalid('Private artifacts must remain outside the repository/archive checkout.')
 return p
def write_private(p,data):
 p=private_path(p);p.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
 if p.parent.stat().st_mode&0o077:raise Invalid('Private artifact directory must have mode 0700.')
 fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:f.write(data)
 return p
def read_private(p):
 p=private_path(p)
 if p.stat().st_mode&0o077:raise Invalid('Private artifact must have mode 0600.')
 return p

def token(v):
 if not isinstance(v,str) or not re.fullmatch(r'[A-Za-z0-9_.-]{1,64}',v):raise Invalid('Invalid technical version/reviewer token.')
 return v

def row_hash(values,key):return hmac.new(key,canonical(values).encode(),hashlib.sha256).hexdigest()
