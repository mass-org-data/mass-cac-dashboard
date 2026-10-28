"""Private, source-checked student staging. No network or database execution."""
import collections, hashlib, json, re
from pathlib import Path
import openpyxl
from common import Invalid, canonical, ident, row_hash, uid

HEADERS=('student_id','child_uuid','donor','centre','name','grade','shift','state','sheet','row','start_date','end_exclusive')
def norm(v): return ' '.join(str(v or '').split()).casefold()
def prefix(v): return re.sub('[^A-Za-z]','',v).upper()[:2]
def grade(v):
    s=str(v or '').strip()
    m=re.fullmatch(r'(?:Grade )?(10|[1-9])(?:\.0)?',s)
    return m.group(1) if m else None

def prepare(staging, directory, source_plan, live_centres, live_rows, key):
    """A workbook READY marker never substitutes for source/target validation."""
    w=openpyxl.load_workbook(staging,read_only=True,data_only=False)
    if w.sheetnames!=['Student import staging']: raise Invalid('Unexpected staging sheets.')
    values=list(w.active.values)
    if tuple(values[0])!=HEADERS: raise Invalid('Unexpected staging headers.')
    source=openpyxl.load_workbook(directory,read_only=True,data_only=True)
    source_values={s.title:list(s.values) for s in source}
    if hashlib.sha256(Path(directory).read_bytes()).hexdigest()!=source_plan['source']['sha256']:
        raise Invalid('Directory source checksum mismatch.')
    plan_rows={(s['original_name'],r['row_number']):r for s in source_plan['sheets'] for r in s['rows']}
    ordinals={s['original_name']:s['ordinal'] for s in source_plan['sheets']}
    actual={(r['sheet_ordinal'],r['row_number']):r for r in live_rows if r['sha256']==source_plan['source']['sha256']}
    centres=collections.defaultdict(list)
    for c in live_centres: centres[norm(c['donor_label']),norm(c['centre_label'])].append(c['centre_id'])
    accepted=[];held=[];seen_source=set();seen_ids=set();seen_uuids=set();seen_identity=set()
    sha=hashlib.sha256(Path(staging).read_bytes()).hexdigest()
    for line,cells in enumerate(values[1:],2):
        r=dict(zip(HEADERS,cells)); ref=(r['sheet'],r['row']); reasons=[]
        if ref in seen_source: raise Invalid('Repeated staging source reference.')
        seen_source.add(ref)
        original=plan_rows.get(ref)
        if not original or ref[0] not in source_values or not isinstance(ref[1],int): raise Invalid('Unrecognized physical source row.')
        sr=source_values[ref[0]][ref[1]-1]
        live=actual.get((ordinals[ref[0]],ref[1]))
        if not live or live['content_hash']!=original['content_hash'] or live['source_row_id']!=original['id']:
            raise Invalid('Hosted source provenance mismatch.')
        if norm(sr[1])!=norm(r['name']) or norm(sr[2])!=norm(r['centre']) or grade(sr[4])!=grade(r['grade']):
            raise Invalid('Staging name, centre or grade differs from source.')
        if r['state']!='READY_FOR_DATABASE_MATCH':
            held.append({'staging_row':line,'source_row_id':original['id'],'reason':r['state']});continue
        g=grade(r['grade']); candidates=centres[norm(r['donor']),norm(r['centre'])]
        if len(candidates)!=1: reasons.append('ambiguous_or_missing_centre')
        if g is None: reasons.append('unsupported_grade')
        if r['shift'] not in ('Morning','Evening') or norm(r['shift'])!=norm(sr[6]): reasons.append('unverified_shift')
        if r['start_date']!='2026-04-01' or r['end_exclusive']!='2027-04-01': reasons.append('unexpected_assumed_interval')
        display=r['student_id']; child=uid(r['child_uuid'])
        if not isinstance(display,str) or not re.fullmatch('ST_'+prefix(r['centre'])+'_'+str(g)+r'_[0-9]{2,}',display): reasons.append('invalid_student_id')
        if display in seen_ids or child in seen_uuids: raise Invalid('Duplicate staged identity.')
        seen_ids.add(display);seen_uuids.add(child)
        identity=(norm(r['donor']),norm(r['centre']),norm(r['name']),g,r['shift'])
        if identity in seen_identity: raise Invalid('Uncertain repeated student identity.')
        seen_identity.add(identity)
        if reasons:
            held.append({'staging_row':line,'source_row_id':original['id'],'reason':','.join(reasons)});continue
        data={'child_id':child,'student_id':display,'enrolment_id':ident('student-enrolment',child,candidates[0],'2026-04-01'),
              'profile_id':ident('student-profile',child),'centre_id':candidates[0],'full_name':str(sr[1]).strip(),
              'grade':g,'shift':r['shift'],'gender':{'Female':'Girl','Male':'Boy'}.get(str(sr[3]).strip()),
              'source_row_id':original['id'],'staging_sha256':sha,'donor':r['donor'],'centre':r['centre']}
        data['payload_hmac']=row_hash(data,key);accepted.append(data)
    return {'format':'mass-approved-students-v1','staging_sha256':sha,'rows':accepted,'held':held,
            'counts':{'source':len(values)-1,'accepted':len(accepted),'held':len(held),
                      'held_reasons':dict(collections.Counter(x['reason'] for x in held))}}

def sql_literal(v):
    return "'"+str(v).replace("'","''")+"'"

def render(plan):
    """Insert-only, exact-retry transaction. No Auth, application impersonation or grants to staff."""
    from history_sql import student_provenance
    rows=sql_literal(canonical(plan['rows']))
    return f"""BEGIN;
SET LOCAL statement_timeout='180s';
SELECT pg_advisory_xact_lock(hashtextextended('mass.approved.student.import',0));
{student_provenance(plan)}
GRANT mass_data_importer TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;
SET LOCAL ROLE mass_data_importer;
DO $import$
DECLARE r jsonb; receipt mass_import.receipts; t text; target uuid;
BEGIN
 FOR r IN SELECT * FROM jsonb_array_elements({rows}::jsonb) LOOP
  SELECT * INTO receipt FROM mass_import.receipts WHERE source_row_id=(r->>'source_row_id')::uuid AND source_slot=1 AND target_table='children';
  IF FOUND THEN
   IF receipt.payload_hmac<>r->>'payload_hmac' OR receipt.staging_sha256<>r->>'staging_sha256' OR receipt.target_id<>(r->>'child_id')::uuid
    OR NOT EXISTS(SELECT 1 FROM mass_core.children c JOIN mass_core.private_child_profiles p ON p.child_id=c.id JOIN mass_core.enrolments e ON e.child_id=c.id
       WHERE c.id=receipt.target_id AND c.student_id=r->>'student_id' AND p.full_name=r->>'full_name' AND p.gender_code IS NOT DISTINCT FROM r->>'gender'
       AND e.id=(r->>'enrolment_id')::uuid AND e.centre_id=(r->>'centre_id')::uuid AND e.grade_label=r->>'grade' AND e.shift_code=r->>'shift'
       AND e.starts_on='2026-04-01' AND e.ends_before='2027-04-01' AND e.status_code='Active')
    OR (SELECT count(*) FROM mass_import.receipts WHERE source_row_id=receipt.source_row_id AND source_slot=1 AND target_table IN ('children','private_child_profiles','enrolments'))<>3 THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='student retry reconciliation conflict'; END IF;
   CONTINUE;
  END IF;
  -- Reserve the same prefix/class lock as runtime registration; unique constraints
  -- remain authoritative if a supplied reviewed ID collides with another identity.
  PERFORM pg_advisory_xact_lock(hashtextextended('mass.student.'||split_part(r->>'student_id','_',2)||'.'||(r->>'grade'),0));
  INSERT INTO mass_core.children(id,student_id) VALUES((r->>'child_id')::uuid,r->>'student_id');
  INSERT INTO mass_core.private_child_profiles(id,child_id,full_name,gender_code)
   VALUES((r->>'profile_id')::uuid,(r->>'child_id')::uuid,r->>'full_name',r->>'gender');
  INSERT INTO mass_core.enrolments(id,child_id,centre_id,grade_label,shift_code,starts_on,ends_before,status_code)
   VALUES((r->>'enrolment_id')::uuid,(r->>'child_id')::uuid,(r->>'centre_id')::uuid,r->>'grade',r->>'shift','2026-04-01','2027-04-01','Active');
  FOREACH t IN ARRAY ARRAY['children','private_child_profiles','enrolments'] LOOP
   target:=CASE t WHEN 'children' THEN (r->>'child_id')::uuid WHEN 'private_child_profiles' THEN (r->>'profile_id')::uuid ELSE (r->>'enrolment_id')::uuid END;
   INSERT INTO mass_import.receipts(source_row_id,source_slot,target_table,target_id,payload_hmac,staging_sha256,assumed_enrolment_dates)
    VALUES((r->>'source_row_id')::uuid,1,t,target,r->>'payload_hmac',r->>'staging_sha256',t='enrolments');
  END LOOP;
 END LOOP;
END;
$import$;
RESET ROLE;
REVOKE SET OPTION FOR mass_data_importer FROM CURRENT_USER;
COMMIT;
"""
