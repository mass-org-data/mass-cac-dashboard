"""Private, atomic SQL batches. Callers must retain their private review/key."""
from common import canonical,ident
from students import sql_literal

def batch_provenance(batch_id,source_count,accepted_rows,held_rows,files,exceptions):
    """Already registered directory rows may be referenced by a new student batch."""
    payload=sql_literal(canonical({'files':files,'exceptions':exceptions}))
    return f"""
SET LOCAL ROLE mass_foundation_ingestor;
DO $provenance$
DECLARE b uuid:='{batch_id}'; r jsonb; s jsonb; x jsonb; state text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(b::text,0));
 SELECT import_batches.state INTO state FROM mass_foundation.import_batches WHERE id=b;
 IF FOUND THEN
  IF state<>'complete' OR NOT EXISTS(SELECT 1 FROM mass_foundation.import_batches WHERE id=b
   AND extracted_count={source_count} AND accepted_count={accepted_rows} AND quarantined_count={held_rows} AND excluded_count=0) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='import batch reconciliation conflict'; END IF;
  RETURN;
 END IF;
 INSERT INTO mass_foundation.import_batches(id,mapping_version,extractor_version) VALUES(b,'approved-scoped-import-20261028','private-import-v2');
 UPDATE mass_foundation.import_batches SET state='validated',extracted_count={source_count} WHERE id=b;
 UPDATE mass_foundation.import_batches SET state='approved' WHERE id=b;
 UPDATE mass_foundation.import_batches SET state='running' WHERE id=b;
 FOR r IN SELECT * FROM jsonb_array_elements({payload}::jsonb->'files') LOOP
  INSERT INTO mass_foundation.source_files(id,sha256,storage_ref,source_version)
   VALUES((r->>'id')::uuid,r->>'sha256',(r->>'id')::uuid,'reviewed-history-20261028') ON CONFLICT DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM mass_foundation.source_files WHERE id=(r->>'id')::uuid AND sha256=r->>'sha256') THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='source file reconciliation conflict'; END IF;
  FOR s IN SELECT * FROM jsonb_array_elements(r->'sheets') LOOP
   INSERT INTO mass_foundation.source_sheets(id,file_id,ordinal,classification,header_version)
    VALUES((s->>'id')::uuid,(r->>'id')::uuid,(s->>'ordinal')::int,s->>'classification',1) ON CONFLICT DO NOTHING;
   IF NOT EXISTS(SELECT 1 FROM mass_foundation.source_sheets WHERE id=(s->>'id')::uuid AND file_id=(r->>'id')::uuid AND ordinal=(s->>'ordinal')::int AND classification=s->>'classification') THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='source sheet reconciliation conflict'; END IF;
   FOR x IN SELECT * FROM jsonb_array_elements(s->'rows') LOOP
    INSERT INTO mass_foundation.source_rows(id,sheet_id,first_batch_id,row_number,content_hash)
     VALUES((x->>'id')::uuid,(s->>'id')::uuid,b,(x->>'row_number')::int,x->>'content_hash') ON CONFLICT DO NOTHING;
    IF NOT EXISTS(SELECT 1 FROM mass_foundation.source_rows WHERE id=(x->>'id')::uuid AND sheet_id=(s->>'id')::uuid AND row_number=(x->>'row_number')::int AND content_hash=x->>'content_hash') THEN
     RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='source row reconciliation conflict'; END IF;
   END LOOP;
  END LOOP;
 END LOOP;
 FOR x IN SELECT * FROM jsonb_array_elements({payload}::jsonb->'exceptions') LOOP
  INSERT INTO mass_foundation.import_exceptions(id,batch_id,source_row_id,field_ordinal,reason_code)
   VALUES((x->>'id')::uuid,b,(x->>'source_row_id')::uuid,(x->>'slot')::int,'unverified_record') ON CONFLICT DO NOTHING;
 END LOOP;
 UPDATE mass_foundation.import_batches SET state='complete',accepted_count={accepted_rows},quarantined_count={held_rows} WHERE id=b;
END;
$provenance$;
RESET ROLE;
"""

def student_provenance(plan):
    b=ident('approved-student-batch',plan['staging_sha256'])
    exceptions=[{'id':ident('student-exception',b,r['source_row_id']),'source_row_id':r['source_row_id'],'slot':None} for r in plan['held']]
    return batch_provenance(b,plan['counts']['source'],plan['counts']['accepted'],plan['counts']['held'],[],exceptions)

def provenance(plan):
    # Technical staging only; successful canonical facts are accounted by receipts,
    # not falsely claimed by completing the source registration batch.
    sql='BEGIN;\n'
    for f in plan['files']:
        n=sum(len(s['rows']) for s in f['sheets']);b=ident('history-observations-batch',f['sha256'])
        held=[x for x in plan['held'] if any(x['source_row_id']==r['id'] for s in f['sheets'] for r in s['rows'])]
        exceptions=[{'id':ident('history-exception',b,x['source_row_id'],x['slot']),'source_row_id':x['source_row_id'],'slot':x['slot']} for x in held]
        # All observations are registered, with accepted=0 until independently
        # imported; no claim that a source row's facts are completely resolved.
        sql+=batch_provenance(b,n,0,n,[f],exceptions)
    return sql+'COMMIT;\n'

def chunk(rows):
    compact=[]
    for r in rows:
        s=r['student']; compact.append({k:v for k,v in r.items() if k!='student'}|{k:s[k] for k in ('child_id','enrolment_id','centre_id','shift')})
    data=sql_literal(canonical(compact))
    return f"""BEGIN;
SET LOCAL statement_timeout='180s';
SELECT pg_advisory_xact_lock(hashtextextended('mass.approved.history.import',0));
GRANT mass_data_importer TO CURRENT_USER WITH SET TRUE, INHERIT FALSE;
SET LOCAL ROLE mass_data_importer;
DO $history$
DECLARE r jsonb; t text; existing mass_import.receipts; y uuid; q uuid; d uuid;
BEGIN
 FOR r IN SELECT * FROM jsonb_array_elements({data}::jsonb) LOOP
  t:=CASE r->>'kind' WHEN 'attendance' THEN 'attendance_records' WHEN 'assessment' THEN 'assessment_results' ELSE NULL END;
  IF t IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='unsupported historical import'; END IF;
  SELECT * INTO existing FROM mass_import.receipts WHERE source_row_id=(r->>'source_row_id')::uuid AND source_slot=(r->>'slot')::int AND target_table=t;
  IF FOUND THEN
   IF existing.target_id<>(r->>'id')::uuid OR existing.payload_hmac<>r->>'payload_hmac' OR existing.staging_sha256<>r->>'sha256' THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='historical retry receipt conflict'; END IF;
   IF t='attendance_records' THEN
    IF NOT EXISTS(SELECT 1 FROM mass_core.attendance_records WHERE id=existing.target_id AND child_id=(r->>'child_id')::uuid
     AND enrolment_id=(r->>'enrolment_id')::uuid AND centre_id=(r->>'centre_id')::uuid AND shift_code=r->>'shift'
     AND attendance_date=(r->>'date')::date AND code=r->>'code') THEN
     RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='historical attendance reconciliation conflict'; END IF;
   ELSE
    IF NOT EXISTS(SELECT 1 FROM mass_core.assessment_results a JOIN mass_core.assessment_definitions d ON d.id=a.definition_id
     JOIN mass_core.assessment_periods p ON p.id=d.period_id JOIN mass_core.academic_years y ON y.id=p.academic_year_id
     WHERE a.id=existing.target_id AND a.child_id=(r->>'child_id')::uuid AND a.enrolment_id=(r->>'enrolment_id')::uuid
     AND a.centre_id=(r->>'centre_id')::uuid AND a.shift_code=r->>'shift' AND a.assessed_on IS NOT DISTINCT FROM (r->>'date')::date
     AND a.score=(r->>'score')::numeric AND p.quarter=(r->>'quarter')::int AND y.starts_on='2026-04-01') THEN
     RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='historical assessment reconciliation conflict'; END IF;
   END IF;
   CONTINUE;
  END IF;
  IF t='attendance_records' THEN
   INSERT INTO mass_core.attendance_records(id,child_id,enrolment_id,centre_id,shift_code,attendance_date,code)
    VALUES((r->>'id')::uuid,(r->>'child_id')::uuid,(r->>'enrolment_id')::uuid,(r->>'centre_id')::uuid,r->>'shift',(r->>'date')::date,r->>'code');
  ELSE
   INSERT INTO mass_core.academic_years(starts_on) VALUES('2026-04-01') ON CONFLICT DO NOTHING;
   SELECT id INTO y FROM mass_core.academic_years WHERE starts_on='2026-04-01';
   INSERT INTO mass_core.assessment_periods(academic_year_id,quarter) VALUES(y,(r->>'quarter')::smallint) ON CONFLICT DO NOTHING;
   SELECT id INTO q FROM mass_core.assessment_periods WHERE academic_year_id=y AND quarter=(r->>'quarter')::int;
   INSERT INTO mass_core.assessment_definitions(period_id) VALUES(q) ON CONFLICT DO NOTHING;
   SELECT id INTO d FROM mass_core.assessment_definitions WHERE period_id=q AND max_score=25;
   IF d IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='assessment scale conflict'; END IF;
   INSERT INTO mass_core.assessment_results(id,child_id,enrolment_id,centre_id,shift_code,definition_id,assessed_on,score)
    VALUES((r->>'id')::uuid,(r->>'child_id')::uuid,(r->>'enrolment_id')::uuid,(r->>'centre_id')::uuid,r->>'shift',d,(r->>'date')::date,(r->>'score')::numeric);
  END IF;
  INSERT INTO mass_import.receipts(source_row_id,source_slot,target_table,target_id,payload_hmac,staging_sha256)
   VALUES((r->>'source_row_id')::uuid,(r->>'slot')::int,t,(r->>'id')::uuid,r->>'payload_hmac',r->>'sha256');
 END LOOP;
END;
$history$;
RESET ROLE;
REVOKE SET OPTION FOR mass_data_importer FROM CURRENT_USER;
COMMIT;
"""
