"""Prepare monthly source evidence without inventing event dates. No network calls."""
import argparse,collections,hashlib,json,re
from datetime import date,datetime
from pathlib import Path
import openpyxl
from common import canonical,ident,row_hash,write_private
from history_sql import batch_provenance
from students import norm,grade,sql_literal

def project(label):
    s=norm(label)
    if s.startswith('mpok'):return 'mpokket'
    if s.startswith('fanuc'):return 'fanuc'
    if s.startswith('mcafee'):return 'mcafee'
    if s.startswith('dasar') or s.startswith('dasra'):return 'dasra uk'
    if s.startswith('j.f'):return 'jf'
    raise ValueError('Unmapped source project')

def prepare(workbook,roster,key):
    sha=hashlib.sha256(Path(workbook).read_bytes()).hexdigest();fid=ident('monthly-activity-source',sha)
    accepted=[];held=[];sheets=[];index=collections.defaultdict(list)
    for e in roster:index[norm(e['donor']),norm(e['centre']),norm(e['full_name']),e['grade']].append(e)
    for ordinal,s in enumerate(openpyxl.load_workbook(workbook,read_only=True,data_only=True),1):
        values=list(s.values);sid=ident('monthly-activity-sheet',sha,ordinal);source_rows=[]
        if len(values)<4 or tuple(values[3][:7])!=('Center Name','Student Name','Class','Cultural Activity 1','Cultural Activity 2','Sports Activity 1','Sports Activity 2'):raise ValueError('Unrecognized activity headers')
        m=values[1][1]
        if isinstance(m,datetime):m=m.date()
        if not isinstance(m,date) or m.day!=1 or m>date.today():raise ValueError('Explicit completed/current reporting month required')
        for physical,r in enumerate(values[4:],5):
            if len(r)<2 or not r[1] or 'example' in norm(r[1]):continue
            rid=ident('monthly-activity-row',sid,physical);source_rows.append({'id':rid,'row_number':physical,'content_hash':row_hash([str(v) if isinstance(v,(date,datetime)) else v for v in r],key)})
            g=grade(r[2]);possible=index[project(s.title),norm(r[0]),norm(r[1]),g];reason=None
            if not g:reason='unsupported_grade'
            elif len(possible)!=1:reason='unresolved_or_ambiguous_identity'
            slots=[]
            for v in r[3:7]:
                if norm(v) not in ('yes','no',''):reason=reason or 'unsupported_response'
                slots.append({'yes':True,'no':False}.get(norm(v)))
            if reason:held.append({'source_row_id':rid,'reason':reason});continue
            e=possible[0];end=date(m.year+(m.month==12),m.month%12+1,1)
            if date.fromisoformat(e['starts_on'])>m or e['ends_before'] and date.fromisoformat(e['ends_before'])<end:
                held.append({'source_row_id':rid,'reason':'month_outside_enrolment'});continue
            data={'id':ident('monthly-activity-history',e['child_id'],m.isoformat()),'source_row_id':rid,'source_sha256':sha,'reporting_month':m.isoformat(),'child_id':e['child_id'],'enrolment_id':e['enrolment_id'],'centre_id':e['centre_id'],'shift_code':e['shift'],'grade_label':g,**dict(zip(['cultural_1','cultural_2','sports_1','sports_2'],slots))}
            data['payload_hmac']=row_hash(data,key);accepted.append(data)
        sheets.append({'id':sid,'ordinal':ordinal,'classification':'input','rows':source_rows})
    groups=collections.defaultdict(list)
    for r in accepted:groups[r['child_id'],r['reporting_month']].append(r)
    rows=[]
    for group in groups.values():
        if len(group)>1:held.extend({'source_row_id':r['source_row_id'],'reason':'duplicate_source_claim'} for r in group)
        else:rows.extend(group)
    return {'format':'mass-monthly-activities-v1','files':[{'id':fid,'sha256':sha,'sheets':sheets}],'rows':rows,'held':held,'source_count':sum(len(s['rows']) for s in sheets)}

def render(plan):
    if plan.get('format')!='mass-monthly-activities-v1':raise ValueError('Unexpected monthly history plan')
    rows=plan['rows'];seen=set()
    for r in rows:
        key=(r['child_id'],r['reporting_month'])
        if key in seen:raise ValueError('Duplicate monthly identity')
        seen.add(key)
        if any(type(r[c]) not in (bool,type(None)) for c in ('cultural_1','cultural_2','sports_1','sports_2')):raise ValueError('Responses must be boolean or null')
    bid=ident('monthly-activity-observations',plan['files'][0]['sha256'])
    exceptions=[{'id':ident('monthly-exception',bid,r['source_row_id']),'source_row_id':r['source_row_id'],'slot':None} for r in plan['held']]
    provenance=batch_provenance(bid,plan['source_count'],0,plan['source_count'],plan['files'],exceptions).replace('approved-scoped-import-20261028','approved-monthly-activity-20261123').replace('reviewed-history-20261028','monthly-freeze-20261123')
    data=sql_literal(canonical(rows))
    return f'''BEGIN;
SET LOCAL statement_timeout='180s';
SELECT pg_advisory_xact_lock(hashtextextended('mass.monthly.activity.history.import',0));
{provenance}
GRANT mass_data_importer TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;
SET LOCAL ROLE mass_data_importer;
DO $monthly$
DECLARE r jsonb; existing mass_import.monthly_activity_history;
BEGIN
 FOR r IN SELECT * FROM jsonb_array_elements({data}::jsonb) LOOP
  SELECT * INTO existing FROM mass_import.monthly_activity_history WHERE child_id=(r->>'child_id')::uuid AND reporting_month=(r->>'reporting_month')::date;
  IF FOUND THEN
   IF (to_jsonb(existing)-ARRAY['imported_at','imported_by']) IS DISTINCT FROM r THEN RAISE EXCEPTION 'Monthly activity retry conflict';END IF;
   CONTINUE;
  END IF;
  INSERT INTO mass_import.monthly_activity_history(id,source_row_id,source_sha256,payload_hmac,reporting_month,child_id,enrolment_id,centre_id,shift_code,grade_label,cultural_1,cultural_2,sports_1,sports_2)
   SELECT v.id,v.source_row_id,v.source_sha256,v.payload_hmac,v.reporting_month,v.child_id,v.enrolment_id,v.centre_id,v.shift_code,v.grade_label,v.cultural_1,v.cultural_2,v.sports_1,v.sports_2 FROM jsonb_populate_record(NULL::mass_import.monthly_activity_history,r)v;
 END LOOP;
 IF (SELECT count(*) FROM mass_import.monthly_activity_history WHERE source_sha256='{plan['files'][0]['sha256']}')<>{len(rows)} THEN RAISE EXCEPTION 'Monthly activity reconciliation failed';END IF;
END;$monthly$;
RESET ROLE;
REVOKE SET OPTION FOR mass_data_importer FROM CURRENT_USER;
SELECT count(*) verified_students,count(*)*4 verified_slots,sum(coalesce(cultural_1::int,0)+coalesce(cultural_2::int,0)+coalesce(sports_1::int,0)+coalesce(sports_2::int,0)) positive_responses FROM mass_import.monthly_activity_history WHERE source_sha256='{plan['files'][0]['sha256']}';
COMMIT;
'''

if __name__=='__main__':
    a=argparse.ArgumentParser();a.add_argument('--workbook',required=True);a.add_argument('--roster',required=True);a.add_argument('--key',required=True);a.add_argument('--out',required=True);args=a.parse_args()
    plan=prepare(args.workbook,json.loads(Path(args.roster).read_text())['roster'],Path(args.key).read_bytes())
    write_private(args.out+'.json',json.dumps(plan,indent=2));write_private(args.out+'.sql',render(plan))
    print(json.dumps({'source_rows':plan['source_count'],'accepted':len(plan['rows']),'held':len(plan['held'])}))
