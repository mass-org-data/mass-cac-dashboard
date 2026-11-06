"""Offline one-use cleanup envelope. Never connects; private manifest stays outside Git.

The exact-row exception exists only inside one atomic provider transaction. It
does not disable a trigger, RLS, or audit constraint. Original guard definition
and ACL are restored before commit; only immutable private receipts remain.
"""
import argparse
import hashlib
import json
import uuid
from collections import Counter
from datetime import datetime
from pathlib import Path


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def prepare(m):
    records = m['records']
    if not (len(records) == 5 and len({r['id'] for r in records}) == 5): raise ValueError("Invalid cleanup manifest")
    if not (Counter(r['original_row']['code'] for r in records) == Counter(P=2, A=2, L=1)): raise ValueError("Invalid cleanup manifest")
    if not (len({r['original_row']['centre_id'] for r in records}) == 1): raise ValueError("Invalid cleanup manifest")
    if not (len({r['actor_user_id'] for r in records}) == 1): raise ValueError("Invalid cleanup manifest")
    if not (len(m['history']) == 5): raise ValueError("Invalid cleanup manifest")
    if not ({h['entity_id'] for h in m['history']} == {r['id'] for r in records}): raise ValueError("Invalid cleanup manifest")
    for r in records:
        uuid.UUID(r['id']); uuid.UUID(r['audit_id']); uuid.UUID(r['actor_user_id'])
        if not (r['original_row']['id'] == r['id'] and r['original_row']['row_version'] == 1): raise ValueError("Invalid cleanup manifest")
        if not (r['original_row']['attendance_date'] == '2026-11-05'): raise ValueError("Invalid cleanup manifest")
        if not (r['original_row']['shift_code'] in ('Morning', 'Evening')): raise ValueError("Invalid cleanup manifest")
        for key in ('row_hash', 'audit_hash'):
            if not (len(r[key]) == 64 and all(c in '0123456789abcdef' for c in r[key])): raise ValueError("Invalid cleanup manifest")
        if not (datetime.fromisoformat(r['changed_at']).tzinfo is not None): raise ValueError("Invalid cleanup manifest")
    guard = m['guard']
    if not (hashlib.sha256(guard.encode()).hexdigest() == m['guard_hash']): raise ValueError("Invalid cleanup manifest")
    old = " IF TG_OP IN ('DELETE','TRUNCATE') THEN"
    if not (guard.count(old) == 1): raise ValueError("Invalid cleanup manifest")
    rows = ',\n'.join('('+','.join([literal(r['id'])+'::uuid',literal(r['row_hash']),literal(r['audit_id'])+'::uuid',literal(r['audit_hash']),literal(r['actor_user_id'])+'::uuid'])+')' for r in records)
    ids = ','.join(literal(r['id'])+'::uuid' for r in records)
    predicate = literal(' WHERE x.id NOT IN (' + ids + ')')
    marker = hashlib.sha256(json.dumps(m, sort_keys=True).encode()).hexdigest()
    patched = guard.replace(old,""" IF TG_OP='DELETE' AND TG_TABLE_SCHEMA='mass_core' AND TG_TABLE_NAME='attendance_records' THEN
  IF mass_maintenance.exact_cleanup_row(to_jsonb(OLD)) THEN RETURN OLD; END IF;
 END IF;
"""+old)
    return f"""-- PRIVATE EXECUTION PAYLOAD. Offline reviewed manifest SHA256: {marker}
-- Provider MUST own a single atomic transaction including its migration receipt.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
CREATE TEMP TABLE cleanup_expected(id uuid PRIMARY KEY,row_hash text,audit_id uuid,audit_hash text,actor_id uuid) ON COMMIT DROP;
INSERT INTO cleanup_expected VALUES {rows};
CREATE TEMP TABLE cleanup_state(guard text,guard_acl text,ledger_count bigint,attendance_count bigint) ON COMMIT DROP;
INSERT INTO cleanup_state SELECT pg_get_functiondef('mass_core.guard_record()'::regprocedure),proacl::text,
 (SELECT count(*) FROM supabase_migrations.schema_migrations),(SELECT count(*) FROM mass_core.attendance_records)
 FROM pg_proc WHERE oid='mass_core.guard_record()'::regprocedure;
DO $preflight$
DECLARE t record;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_setting('role')<>'none' THEN RAISE EXCEPTION 'Trusted administrative principal required'; END IF;
 IF encode(sha256(convert_to((SELECT guard FROM cleanup_state),'UTF8')),'hex')<>{literal(m['guard_hash'])} THEN RAISE EXCEPTION 'Guard drift'; END IF;
 -- Lock all original programme/audit relations in stable order. No auth mutation.
 FOR t IN SELECT format('%I.%I',n.nspname,c.relname) AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN('mass_core','mass_foundation','mass_import') AND c.relkind='r' ORDER BY 1 LOOP
  EXECUTE 'LOCK TABLE '||t.name||' IN SHARE ROW EXCLUSIVE MODE';
 END LOOP;
 IF (SELECT count(*) FROM mass_core.attendance_records r JOIN cleanup_expected e ON e.id=r.id
     JOIN mass_foundation.audit_events a ON a.id=e.audit_id
     WHERE encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex')=e.row_hash
     AND encode(sha256(convert_to(to_jsonb(a)::text,'UTF8')),'hex')=e.audit_hash
     AND a.entity_type='core.attendance_records' AND a.entity_id=r.id AND a.operation='INSERT' AND a.actor_user_id=e.actor_id)<>5
 THEN RAISE EXCEPTION 'Exact five original rows and insertion audits required'; END IF;
 IF (SELECT count(*) FROM mass_foundation.audit_events a JOIN cleanup_expected e ON e.id=a.entity_id WHERE a.entity_type='core.attendance_records')<>5
 THEN RAISE EXCEPTION 'Later history exists'; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE confrelid='mass_core.attendance_records'::regclass) THEN RAISE EXCEPTION 'Attendance has dependent relations: review required'; END IF;
END;$preflight$;
CREATE TEMP TABLE cleanup_preservation(name text PRIMARY KEY,checksum text) ON COMMIT DROP;
DO $snapshot$ DECLARE t record;s text;BEGIN
 FOR t IN SELECT format('%I.%I',n.nspname,c.relname) name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN('mass_core','mass_foundation','mass_import') AND c.relkind='r' LOOP
 EXECUTE 'SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,''[]'')) FROM '||t.name||' x'||
 CASE WHEN t.name='mass_core.attendance_records' THEN {predicate} ELSE '' END INTO s;
 INSERT INTO cleanup_preservation VALUES(t.name,s);
 END LOOP;
END;$snapshot$;
CREATE SCHEMA mass_maintenance AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA mass_maintenance FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE mass_maintenance.attendance_cleanup_20261105(
 attendance_id uuid PRIMARY KEY CHECK(attendance_id IN({ids})),
 original_row jsonb NOT NULL,
 insertion_audit_id uuid NOT NULL UNIQUE REFERENCES mass_foundation.audit_events(id) ON DELETE RESTRICT,
 insertion_audit_hash text NOT NULL,
 manifest_sha256 text NOT NULL CHECK(manifest_sha256={literal(marker)}),
 cleanup_reason text NOT NULL CHECK(cleanup_reason='User-authorized removal of five frontend test entries on 5 November 2026'),
 cleanup_transaction bigint NOT NULL,
 cleaned_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 database_principal name NOT NULL CHECK(database_principal='postgres')
);
ALTER TABLE mass_maintenance.attendance_cleanup_20261105 ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_maintenance.attendance_cleanup_20261105 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON mass_maintenance.attendance_cleanup_20261105 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION mass_maintenance.immutable_receipt() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $f$
BEGIN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Cleanup receipts are immutable'; END;$f$;
REVOKE ALL ON FUNCTION mass_maintenance.immutable_receipt() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON mass_maintenance.attendance_cleanup_20261105 FOR EACH ROW EXECUTE FUNCTION mass_maintenance.immutable_receipt();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON mass_maintenance.attendance_cleanup_20261105 FOR EACH STATEMENT EXECUTE FUNCTION mass_maintenance.immutable_receipt();
-- Narrow technical read for the existing definer guard, revoked before commit.
GRANT USAGE ON SCHEMA mass_maintenance TO mass_core_owner;
GRANT SELECT ON mass_maintenance.attendance_cleanup_20261105 TO mass_core_owner;
CREATE POLICY guard_receipt_read ON mass_maintenance.attendance_cleanup_20261105 FOR SELECT TO mass_core_owner USING(true);
CREATE FUNCTION mass_maintenance.exact_cleanup_row(r jsonb) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $f$
 SELECT session_user='postgres' AND current_setting('role')='none' AND EXISTS(
 SELECT 1 FROM mass_maintenance.attendance_cleanup_20261105 a WHERE a.attendance_id=(r->>'id')::uuid
 AND a.original_row=r AND a.cleanup_transaction=txid_current() AND a.manifest_sha256={literal(marker)});
$f$;
REVOKE ALL ON FUNCTION mass_maintenance.exact_cleanup_row(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION mass_maintenance.exact_cleanup_row(jsonb) TO mass_core_owner;
{patched};
CREATE PROCEDURE mass_maintenance.cleanup_exact_five() LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $p$
DECLARE n bigint;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_setting('role')<>'none' THEN RAISE EXCEPTION 'Trusted administrative execution required'; END IF;
 INSERT INTO mass_maintenance.attendance_cleanup_20261105(attendance_id,original_row,insertion_audit_id,insertion_audit_hash,manifest_sha256,cleanup_reason,cleanup_transaction,database_principal)
 SELECT r.id,to_jsonb(r),e.audit_id,e.audit_hash,{literal(marker)},'User-authorized removal of five frontend test entries on 5 November 2026',txid_current(),session_user
 FROM mass_core.attendance_records r JOIN pg_temp.cleanup_expected e ON e.id=r.id
 WHERE encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex')=e.row_hash;
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>5 THEN RAISE EXCEPTION 'Receipt count mismatch'; END IF;
 DELETE FROM mass_core.attendance_records WHERE id IN({ids});
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>5 THEN RAISE EXCEPTION 'Delete count mismatch'; END IF;
END;$p$;
REVOKE ALL ON PROCEDURE mass_maintenance.cleanup_exact_five() FROM PUBLIC,anon,authenticated,service_role;
CALL mass_maintenance.cleanup_exact_five();
-- Restore original guard byte-for-byte BEFORE releasing any locks/committing.
{guard};
DROP PROCEDURE mass_maintenance.cleanup_exact_five();
DROP FUNCTION mass_maintenance.exact_cleanup_row(jsonb);
DROP POLICY guard_receipt_read ON mass_maintenance.attendance_cleanup_20261105;
REVOKE SELECT ON mass_maintenance.attendance_cleanup_20261105 FROM mass_core_owner;
REVOKE USAGE ON SCHEMA mass_maintenance FROM mass_core_owner;
DO $postflight$ DECLARE t record;s text;BEGIN
 IF pg_get_functiondef('mass_core.guard_record()'::regprocedure) IS DISTINCT FROM (SELECT guard FROM cleanup_state)
 OR (SELECT proacl::text FROM pg_proc WHERE oid='mass_core.guard_record()'::regprocedure) IS DISTINCT FROM (SELECT guard_acl FROM cleanup_state)
 THEN RAISE EXCEPTION 'Original guard definition/ACL not restored'; END IF;
 IF EXISTS(SELECT 1 FROM mass_core.attendance_records WHERE id IN({ids}))
 OR (SELECT count(*) FROM mass_core.attendance_records)<>(SELECT attendance_count-5 FROM cleanup_state)
 OR (SELECT count(*) FROM mass_maintenance.attendance_cleanup_20261105)<>5 THEN RAISE EXCEPTION 'Cleanup outcome mismatch'; END IF;
 FOR t IN SELECT * FROM cleanup_preservation LOOP
 EXECUTE 'SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,''[]'')) FROM '||t.name||' x'||
 CASE WHEN t.name='mass_core.attendance_records' THEN {predicate} ELSE '' END INTO s;
 IF s IS DISTINCT FROM t.checksum THEN RAISE EXCEPTION 'Unrelated data changed: %',t.name; END IF;
 END LOOP;
END;$postflight$;
-- Same atomic provider-receipt condition used for the sealed installation.
CREATE TEMP TABLE cleanup_atomic_receipt(marker text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.check_cleanup_receipt() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>(SELECT ledger_count+1 FROM cleanup_state)
 OR (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE name='mass_20261105_attendance_test_cleanup'
 AND array_to_string(statements,E'\\n') LIKE '%{marker}%')<>1 THEN
 RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Atomic provider cleanup receipt required'; END IF;
 RETURN NULL;
END;$f$;
CREATE CONSTRAINT TRIGGER require_atomic_receipt AFTER INSERT ON cleanup_atomic_receipt DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pg_temp.check_cleanup_receipt();
INSERT INTO cleanup_atomic_receipt VALUES({literal(marker)});
"""


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--manifest', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    a = p.parse_args()
    a.output.write_text(prepare(json.loads(a.manifest.read_text())))
