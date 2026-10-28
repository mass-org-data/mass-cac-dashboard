"""Render private, transactional data SQL. No connection or hosted execution code."""
from common import canonical,digest,ident
from review import validate

def render(plan,mapping,approval):
 validate(plan,mapping,approval)
 batch=ident('batch',digest(plan),digest(mapping))
 sheets=[];exceptions=[];counts={'accepted':0,'quarantined':0,'excluded':0}
 for s in plan['sheets']:
  rs=[]
  for r in s['rows']:
   disposition=mapping['dispositions'].get(r['id'],'excluded');counts[disposition]+=1
   rs.append({k:r[k] for k in ('id','row_number','content_hash','classification')})
   if disposition=='quarantined':exceptions.append({'row_id':r['id'],'reason':'unverified_record'})
  # Exact original names are preserved only in the private, checksum-linked plan.
  sheets.append({k:s[k] for k in ('id','ordinal','classification','header_version')}|{'rows':rs})
 payload={'source':{k:plan['source'][k] for k in ('id','sha256','storage_ref','original_file_id')},'sheets':sheets,'entities':mapping['entities'],'batch_id':batch,'mapping_version':plan['mapping_version'],'extractor_version':plan['extractor_version'],'counts':counts,'exceptions':exceptions}
 literal="'"+canonical(payload).replace("'","''")+"'::jsonb"
 # No raw source rows, observations, child names, original sheet names or keys enter SQL.
 delimiter='$mass_import_'+digest(payload)[:16]+'$'
 while delimiter in literal:delimiter=delimiter[:-1]+'x$'
 sql='''-- PRIVATE DATA SQL. Separately approved execution only; contains directory names.
-- Run with psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=terse --file=<private file>.
-- No DDL, grants, account creation, scope grants or migration replay.
BEGIN;
SET LOCAL standard_conforming_strings=on;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
DO $mass_import$
DECLARE d jsonb := '''+literal+'''; f jsonb; s jsonb; r jsonb; e jsonb; old jsonb; n bigint;
 batch uuid; old_state text; complete_retry boolean; actual bigint;
BEGIN
 IF NOT pg_has_role(session_user,'mass_foundation_ingestor','SET') OR NOT pg_has_role(session_user,'mass_core_owner','SET') THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='approved import principal requires existing technical role SET rights'; END IF;
 EXECUTE 'SET LOCAL ROLE mass_foundation_ingestor';
 batch:=(d->>'batch_id')::uuid;f:=d->'source';
 -- Batch row locking serializes identical concurrent retries; all value collisions fail.
 INSERT INTO mass_foundation.import_batches(id,mapping_version,extractor_version)
 VALUES(batch,d->>'mapping_version',d->>'extractor_version') ON CONFLICT(id) DO NOTHING;
 SELECT state INTO STRICT old_state FROM mass_foundation.import_batches WHERE id=batch FOR UPDATE;
 IF old_state NOT IN ('staged','complete') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='unexpected import batch state; manual reconciliation required';END IF;
 complete_retry:=old_state='complete';
 IF NOT EXISTS(SELECT 1 FROM mass_foundation.import_batches WHERE id=batch AND mapping_version=d->>'mapping_version' AND extractor_version=d->>'extractor_version') THEN RAISE EXCEPTION 'batch fingerprint mismatch';END IF;
 IF complete_retry AND NOT EXISTS(SELECT 1 FROM mass_foundation.source_files WHERE id=(f->>'id')::uuid) THEN RAISE EXCEPTION 'completed batch source is missing; manual recovery required';END IF;
 INSERT INTO mass_foundation.source_files(id,original_file_id,sha256,storage_ref)
 VALUES((f->>'id')::uuid,f->>'original_file_id',f->>'sha256',(f->>'storage_ref')::uuid) ON CONFLICT DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM mass_foundation.source_files WHERE id=(f->>'id')::uuid AND sha256=f->>'sha256' AND storage_ref=(f->>'storage_ref')::uuid AND original_file_id IS NOT DISTINCT FROM f->>'original_file_id') THEN RAISE EXCEPTION 'source file identity/hash collision';END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(d->'sheets') LOOP
  IF complete_retry AND NOT EXISTS(SELECT 1 FROM mass_foundation.source_sheets WHERE id=(s->>'id')::uuid) THEN RAISE EXCEPTION 'completed batch worksheet missing';END IF;
  INSERT INTO mass_foundation.source_sheets(id,file_id,ordinal,classification,header_version)
  VALUES((s->>'id')::uuid,(f->>'id')::uuid,(s->>'ordinal')::integer,s->>'classification',(s->>'header_version')::integer) ON CONFLICT DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM mass_foundation.source_sheets WHERE id=(s->>'id')::uuid AND file_id=(f->>'id')::uuid AND ordinal=(s->>'ordinal')::int AND classification=s->>'classification' AND header_version=(s->>'header_version')::int) THEN RAISE EXCEPTION 'source worksheet identity collision';END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(s->'rows') LOOP
   IF complete_retry AND NOT EXISTS(SELECT 1 FROM mass_foundation.source_rows WHERE id=(r->>'id')::uuid) THEN RAISE EXCEPTION 'completed batch row missing';END IF;
   INSERT INTO mass_foundation.source_rows(id,sheet_id,first_batch_id,row_number,content_hash,classification)
   VALUES((r->>'id')::uuid,(s->>'id')::uuid,batch,(r->>'row_number')::int,r->>'content_hash',r->>'classification') ON CONFLICT DO NOTHING;
   IF NOT EXISTS(SELECT 1 FROM mass_foundation.source_rows WHERE id=(r->>'id')::uuid AND sheet_id=(s->>'id')::uuid AND row_number=(r->>'row_number')::int AND content_hash=r->>'content_hash' AND classification=r->>'classification') THEN RAISE EXCEPTION 'source row fingerprint collision';END IF;
  END LOOP;
 END LOOP;
 FOR e IN SELECT value FROM jsonb_array_elements(d->'exceptions') LOOP
  IF complete_retry AND NOT EXISTS(SELECT 1 FROM mass_foundation.import_exceptions WHERE batch_id=batch AND source_row_id=(e->>'row_id')::uuid AND field_ordinal IS NULL AND reason_code=e->>'reason') THEN RAISE EXCEPTION 'completed batch exception missing';END IF;
  INSERT INTO mass_foundation.import_exceptions(batch_id,source_row_id,reason_code) VALUES(batch,(e->>'row_id')::uuid,e->>'reason') ON CONFLICT DO NOTHING;
 END LOOP;
 IF NOT complete_retry THEN
  UPDATE mass_foundation.import_batches SET state='validated' WHERE id=batch;
  UPDATE mass_foundation.import_batches SET state='approved' WHERE id=batch;
  UPDATE mass_foundation.import_batches SET state='running',extracted_count=(d#>>'{counts,accepted}')::bigint+(d#>>'{counts,quarantined}')::bigint+(d#>>'{counts,excluded}')::bigint WHERE id=batch;
 END IF;
 EXECUTE 'SET LOCAL ROLE mass_core_owner';
 FOR e IN SELECT value FROM jsonb_array_elements(d#>'{entities,donors}') LOOP
  IF complete_retry AND NOT EXISTS(SELECT 1 FROM mass_core.donors WHERE id=(e->>'id')::uuid) THEN RAISE EXCEPTION 'completed batch directory object missing';END IF;
  INSERT INTO mass_core.donors(id,label,source_label,source_row_id,source_slot) VALUES((e->>'id')::uuid,e->>'label',e->>'source_label',(e->>'source_row_id')::uuid,(e->>'source_slot')::int) ON CONFLICT DO NOTHING;
  SELECT to_jsonb(x) INTO old FROM mass_core.donors x WHERE id=(e->>'id')::uuid;
  IF old IS DISTINCT FROM e THEN RAISE EXCEPTION 'donor/source mapping mismatch';END IF;
 END LOOP;
 FOR e IN SELECT value FROM jsonb_array_elements(d#>'{entities,centres}') LOOP
  IF complete_retry AND NOT EXISTS(SELECT 1 FROM mass_core.centres WHERE id=(e->>'id')::uuid) THEN RAISE EXCEPTION 'completed batch directory object missing';END IF;
  INSERT INTO mass_core.centres(id,label,donor_id,donor_source_row_id) VALUES((e->>'id')::uuid,e->>'label',(e->>'donor_id')::uuid,(e->>'source_row_id')::uuid) ON CONFLICT DO NOTHING;
  SELECT to_jsonb(x) INTO old FROM mass_core.centres x WHERE id=(e->>'id')::uuid FOR UPDATE;
  IF old IS NULL OR old->>'label' IS DISTINCT FROM e->>'label' THEN RAISE EXCEPTION 'centre identity mismatch';END IF;
  IF complete_retry AND old->>'donor_id' IS NULL THEN RAISE EXCEPTION 'completed batch donor association missing';END IF;
  IF old->>'donor_id' IS NULL THEN
   UPDATE mass_core.centres SET donor_id=(e->>'donor_id')::uuid,donor_source_row_id=(e->>'source_row_id')::uuid WHERE id=(e->>'id')::uuid;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM mass_core.centres WHERE id=(e->>'id')::uuid AND donor_id=(e->>'donor_id')::uuid AND donor_source_row_id=(e->>'source_row_id')::uuid) THEN RAISE EXCEPTION 'conflicting single-donor centre association';END IF;
 END LOOP;
 FOR e IN SELECT value FROM jsonb_array_elements(d#>'{entities,staff_members}') LOOP
  IF complete_retry AND NOT EXISTS(SELECT 1 FROM mass_core.staff_members WHERE id=(e->>'id')::uuid) THEN RAISE EXCEPTION 'completed batch directory object missing';END IF;
  INSERT INTO mass_core.staff_members(id,display_name,source_name,source_row_id,source_slot) VALUES((e->>'id')::uuid,e->>'display_name',e->>'source_name',(e->>'source_row_id')::uuid,(e->>'source_slot')::int) ON CONFLICT DO NOTHING;
  SELECT to_jsonb(x) INTO old FROM mass_core.staff_members x WHERE id=(e->>'id')::uuid;
  IF old IS DISTINCT FROM e THEN RAISE EXCEPTION 'staff identity/source mapping mismatch';END IF;
 END LOOP;
 FOR e IN SELECT value FROM jsonb_array_elements(d#>'{entities,centre_staff_assignments}') LOOP
  IF complete_retry AND NOT EXISTS(SELECT 1 FROM mass_core.centre_staff_assignments WHERE id=(e->>'id')::uuid) THEN RAISE EXCEPTION 'completed batch directory object missing';END IF;
  INSERT INTO mass_core.centre_staff_assignments(id,centre_id,staff_member_id,role_code,shift_code,source_row_id,source_slot)
  VALUES((e->>'id')::uuid,(e->>'centre_id')::uuid,(e->>'staff_member_id')::uuid,e->>'role_code',e->>'shift_code',(e->>'source_row_id')::uuid,(e->>'source_slot')::int) ON CONFLICT DO NOTHING;
  SELECT to_jsonb(x) INTO old FROM mass_core.centre_staff_assignments x WHERE id=(e->>'id')::uuid;
  IF old IS DISTINCT FROM e THEN RAISE EXCEPTION 'staff relationship/source mapping mismatch';END IF;
 END LOOP;
 EXECUTE 'SET LOCAL ROLE mass_foundation_ingestor';
 IF NOT complete_retry THEN
  UPDATE mass_foundation.import_batches SET state='complete',accepted_count=(d#>>'{counts,accepted}')::bigint,quarantined_count=(d#>>'{counts,quarantined}')::bigint,excluded_count=(d#>>'{counts,excluded}')::bigint,checkpoint_position=(d#>>'{counts,accepted}')::bigint+(d#>>'{counts,quarantined}')::bigint+(d#>>'{counts,excluded}')::bigint WHERE id=batch;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM mass_foundation.import_batches WHERE id=batch AND accepted_count=(d#>>'{counts,accepted}')::bigint AND quarantined_count=(d#>>'{counts,quarantined}')::bigint AND excluded_count=(d#>>'{counts,excluded}')::bigint) THEN RAISE EXCEPTION 'completed batch reconciliation mismatch';END IF;
 END IF;
END;
$mass_import$;
COMMIT;
'''
 sql=sql.replace('DO $mass_import$','DO '+delimiter,1)
 closing=sql.rfind('$mass_import$')
 return sql[:closing]+delimiter+sql[closing+len('$mass_import$'):]
