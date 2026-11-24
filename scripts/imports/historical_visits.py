"""Reviewed visit history; no invented login identities, access grants or dates."""
import collections,hashlib,json,re
from datetime import date,datetime
from pathlib import Path
import openpyxl
from common import canonical,digest,ident,json_value,row_hash,write_private
from history_sql import batch_provenance
from students import norm,sql_literal

def donor(tab):
    for fragment,label in [('mpok','Mpokket'),('fanuc','Fanuc'),('mcafee','McAfee'),('dasar','Dasra UK'),('chikkodi','J.F - Chikkodi'),('hukkeri','J.F - Hukkeri'),('raibag','J.F - Raibag'),('athani','J.F - Athani')]:
        if fragment in norm(tab):return label
    raise ValueError('Unknown visit project')

def prepare(workbook,review,database,key):
    sha=hashlib.sha256(Path(workbook).read_bytes()).hexdigest();review_sha=digest(review)
    files=[{'id':ident('visit-source',sha),'sha256':sha,'sheets':[]},{'id':ident('visit-review',review_sha),'sha256':review_sha,'sheets':[]}]
    review_sid=ident('visit-review-sheet',review_sha);reviews=[];centre_alias={};centre_labels={};officer_alias={};officer_labels={}
    centres=database['centres'];staff=database['staff']
    def unique(items):
        if len(items)!=1:raise ValueError('Review identity is missing or ambiguous')
        return items[0]
    rows=review['values']
    if rows[0][0]!='Issue ID' or rows[0][6]!='Correct value — MASS':raise ValueError('Unknown review headers')
    for physical,cells in enumerate(rows[1:],7):
        r=(cells+[None]*9)[:9]
        if not r[0]:continue
        if not r[6] or not str(r[6]).strip():raise ValueError('Unresolved review item')
        rid=ident('visit-review-row',review_sha,physical);reviews.append({'id':rid,'row_number':physical,'content_hash':row_hash(r,key)})
        tabs=[x.split('!')[0] for x in r[3].splitlines()];final=re.sub(r'\s*\((?:Visit Log|Monthly Summary)\)\s*$','',str(r[6])).strip()
        if r[1]=='Centre spelling':
            project=donor(tabs[0]);target=unique([c for c in centres if c['donor']==project and norm(c['name'])==norm(r[5])]);other=[c for c in centres if c['donor']==project and norm(c['name'])==norm(final)]
            if other and any(c['id']!=target['id'] for c in other):raise ValueError('Review redirects to another centre')
            centre_labels[target['id']]=final
            for tab in tabs:centre_alias[tab,norm(r[4])]=target
        elif r[1] in ('Officer spelling','Officer conflict'):
            candidates=[s for s in staff if norm(s['name'])==norm(final)]
            if not candidates and r[1]=='Officer spelling':candidates=[s for s in staff if norm(s['name'])==norm(r[5])]
            target=unique(candidates);officer_labels[target['id']]=final
            for tab in tabs:officer_alias[tab]=target
        else:raise ValueError('Unsupported review type')
    files[1]['sheets']=[{'id':review_sid,'ordinal':1,'classification':'input','rows':reviews}]
    if not reviews:raise ValueError('Reviewed mapping evidence required')
    candidates=[];held=[];excluded=0
    for ordinal,sheet in enumerate(openpyxl.load_workbook(workbook,read_only=True,data_only=True),1):
        if 'Visit Log' not in sheet.title:continue
        values=list(sheet.values);project=donor(sheet.title);sid=ident('visit-sheet',sha,ordinal);source=[];officer=officer_alias.get(sheet.title)
        if officer is None:officer=unique([s for s in staff if norm(s['name'])==norm(values[1][1])])
        if tuple(values[5][:4])!=('Visit Date','Center Name','Shift','Remarks'):raise ValueError('Unknown visit headers')
        for physical,raw in enumerate(values[6:],7):
            r=(list(raw)+[None]*4)[:4]
            if not any(r[:3]):continue
            if 'example' in norm(str(r)):excluded+=1;continue
            rid=ident('visit-row',sha,ordinal,physical);source.append({'id':rid,'row_number':physical,'content_hash':row_hash([json_value(v) for v in raw],key)})
            reason=None;dt=r[0].date() if isinstance(r[0],datetime) else r[0]
            if not isinstance(dt,date):reason='missing_or_invalid_date'
            elif dt>date.today():reason='future_date'
            centre=centre_alias.get((sheet.title,norm(r[1])))
            if centre is None:
                matches=[c for c in centres if c['donor']==project and norm(c['name'])==norm(r[1])]
                if len(matches)!=1:reason=reason or 'unresolved_centre'
                else:centre=matches[0]
            if r[2] not in ('Morning','Evening'):reason=reason or 'invalid_shift'
            if r[3] is not None and (not isinstance(r[3],str) or len(r[3])>2000):reason=reason or 'unsupported_remarks'
            if reason:held.append({'source_row_id':rid,'sheet':sheet.title,'row':physical,'reason':reason});continue
            month=dt.replace(day=1).isoformat();aid=ident('historical-officer-assignment',month,officer['id'],centre['id'])
            candidates.append({'id':ident('historical-officer-visit',officer['id'],centre['id'],dt.isoformat(),r[2]),'assignment_id':aid,'reporting_month':month,'officer_id':officer['id'],'centre_id':centre['id'],'source_row_id':rid,'source_sha256':sha,'review_sha256':review_sha,'visit_date':dt.isoformat(),'shift_code':r[2],'remarks':r[3]})
        files[0]['sheets'].append({'id':sid,'ordinal':ordinal,'classification':'input','rows':source})
    groups=collections.defaultdict(list)
    for r in candidates:groups[r['id']].append(r)
    accepted=[]
    for group in groups.values():
        if len(group)>1:
            held.extend({'source_row_id':r['source_row_id'],'reason':'duplicate_visit_key'} for r in group)
        else:accepted.extend(group)
    assignments={}
    for r in accepted:
        if r['assignment_id'] not in assignments:
            a={k:r[k] for k in ['reporting_month','officer_id','centre_id','source_row_id','source_sha256','review_sha256']};a.update(id=r['assignment_id'],confirmed_officer_name=officer_labels.get(r['officer_id'],unique([s for s in staff if s['id']==r['officer_id']])['name']),confirmed_centre_name=centre_labels.get(r['centre_id'],unique([c for c in centres if c['id']==r['centre_id']])['name']),review_file_id=files[1]['id']);a['payload_hmac']=row_hash(a,key);assignments[a['id']]=a
        r['payload_hmac']=row_hash(r,key)
    return {'format':'mass-historical-visits-v1','files':files,'source_count':sum(len(s['rows']) for f in files for s in f['sheets']),'assignments':list(assignments.values()),'visits':accepted,'held':held,'excluded_examples':excluded}

def render(plan):
    if plan.get('format')!='mass-historical-visits-v1':raise ValueError('Unknown historical visit plan')
    bid=ident('reviewed-historical-visits',[(f['sha256']) for f in plan['files']]);provenance=batch_provenance(bid,plan['source_count'],0,plan['source_count'],plan['files'],[])
    blocks=[]
    for table,key in [('historical_officer_assignments','assignments'),('historical_officer_visits','visits')]:
        rows=plan[key];columns=list(rows[0]) if rows else []
        if not rows:continue
        data=sql_literal(canonical(rows));cols=','.join(columns)
        blocks.append(f'''DO $batch$ DECLARE r jsonb; oldrow jsonb; BEGIN
 FOR r IN SELECT * FROM jsonb_array_elements({data}::jsonb) LOOP
  SELECT to_jsonb(t)-ARRAY['imported_at','imported_by'] INTO oldrow FROM mass_import.{table} t WHERE id=(r->>'id')::uuid;
  IF FOUND THEN IF oldrow IS DISTINCT FROM r THEN RAISE EXCEPTION 'Historical visit exact retry conflict';END IF;CONTINUE;END IF;
  INSERT INTO mass_import.{table}({cols}) SELECT {cols} FROM jsonb_populate_record(NULL::mass_import.{table},r);
 END LOOP;
 IF (SELECT count(*) FROM mass_import.{table} WHERE source_sha256='{plan['files'][0]['sha256']}' AND review_sha256='{plan['files'][1]['sha256']}')<>{len(rows)} THEN RAISE EXCEPTION 'Historical visit reconciliation failed';END IF;
END;$batch$;''')
    return "BEGIN;\nSET LOCAL statement_timeout='120s';\nSELECT pg_advisory_xact_lock(hashtextextended('mass.historical.visits.import',0));\n"+provenance+"\nGRANT mass_data_importer TO CURRENT_USER WITH SET TRUE,INHERIT FALSE;\nSET LOCAL ROLE mass_data_importer;\n"+'\n'.join(blocks)+"\nRESET ROLE;\nREVOKE SET OPTION FOR mass_data_importer FROM CURRENT_USER;\nCOMMIT;\n"
