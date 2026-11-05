"""Offline envelopes for a transactional, provider-owned migration ledger.

The provider must execute the whole query and its ONE ledger insert atomically.
Never send the fixed-ledger envelopes to apply_migration: that would double-log
the stage. No database connection, implicit activation, or canonical SQL edit.
"""
import argparse
import hashlib
import json
import re
import tempfile
from pathlib import Path
from prepare import ROOT, literal, prepare


def preservation_guard(baseline):
    relations = baseline['catalog']['relations']
    fingerprints = baseline['fingerprints']
    expected_names = {r['schema'] + '.' + r['table'] for r in relations}
    if len(relations) != 27 or len(expected_names) != 27 or expected_names != {r['relation'] for r in fingerprints}:
        raise ValueError('Expected exact original 27-table baseline')
    for row in fingerprints:
        if not isinstance(row['rows'], int) or row['rows'] < 0 or not re.fullmatch('[0-9a-f]{64}', row['fingerprint']):
            raise ValueError('Invalid preservation fingerprint')
    def identifier(value):
        if not re.fullmatch('[a-z][a-z0-9_]*', value):
            raise ValueError('Unexpected catalog identifier')
        return '"' + value + '"'
    parts, tables = [], []
    for relation in relations:
        if relation['schema'] not in ('mass_core', 'mass_foundation', 'mass_import'):
            raise ValueError('Unexpected preservation schema')
        table = identifier(relation['schema']) + '.' + identifier(relation['table'])
        tables.append(table)
        projection = 'jsonb_build_array(' + ','.join('t.' + identifier(c) for c in relation['columns']) + ')'
        digest = "encode(sha256(convert_to(" + projection + "::text,'UTF8')),'hex')"
        parts.append('select ' + literal(relation['schema'] + '.' + relation['table']) +
                     " as relation, count(*) as rows, encode(sha256(convert_to(coalesce(string_agg(" +
                     digest + ",'' order by " + digest + "),''),'UTF8')),'hex') as fingerprint from " + table + ' t')
    query = 'select jsonb_agg(to_jsonb(q) order by relation) INTO actual from (' + ' union all '.join(parts) + ') q;'
    expected = literal(json.dumps(fingerprints, separators=(',', ':')))
    return 'LOCK TABLE supabase_migrations.schema_migrations,' + ','.join(tables) + ' IN SHARE ROW EXCLUSIVE MODE;\n' + \
        'DO $preservation$ DECLARE actual jsonb; BEGIN ' + query + ' IF actual IS DISTINCT FROM ' + expected + \
        "::jsonb THEN RAISE EXCEPTION 'Pre-existing MASS data or grants changed; installation stopped'; END IF; END;$preservation$;\n"


def prepare_provider(output, include_proposal=False, baseline=None):
    output = Path(output).resolve()
    if output.is_relative_to(ROOT):
        raise ValueError('Generated envelopes stay outside checkout')
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    manifest = []
    with tempfile.TemporaryDirectory() as temporary:
        entries = prepare(temporary, include_proposal)
        for i, entry in enumerate(entries):
            source = Path(entry['source'])
            stage = '024' if entry['separate_proposal'] else source.stem.split('_')[0][-3:]
            name = 'mass_' + stage + '_' + source.stem.split('_', 1)[1] + '_sealed'
            body = (Path(temporary) / entry['envelope']).read_text()
            # Remove ONLY the outer executable transaction and explicit ledger
            # insert. The canonical SQL/control/seal are unchanged inside it.
            start = body.index('BEGIN;')
            body = body[:start] + body[start + len('BEGIN;'):]
            end = body.rindex('RESET ROLE;\nINSERT INTO supabase_migrations.schema_migrations')
            body = body[:end] + 'RESET ROLE;\n'
            for previous in manifest:
                original = Path(previous['source']).stem
                version, original_name = original.split('_', 1)
                body = body.replace('version=' + literal(version) + ' AND name=' + literal(original_name),
                                    'name=' + literal(previous['provider_name']))
            # Reject a stage previously applied under a provider alias too.
            needle = "RAISE EXCEPTION 'Unexpected migration ledger; stop and reconcile, never replay';END IF;"
            body = body.replace(needle, needle + '\n IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE name=' + literal(name) + ") THEN RAISE EXCEPTION 'Provider stage already recorded';END IF;", 1)
            marker = 'MASS_CANONICAL_SHA256:' + entry['source_sha256']
            # A deferred check makes the transport contract executable: if the
            # provider commits DDL before inserting its history entry, COMMIT
            # fails and rolls back the entire stage. It also rejects a provider
            # that splits individual statements into autocommit transactions.
            receipt = """CREATE TEMP TABLE mass_provider_receipt(
 expected_name text NOT NULL,canonical_marker text NOT NULL,expected_count integer NOT NULL
) ON COMMIT DROP;
CREATE OR REPLACE FUNCTION pg_temp.mass_provider_history_check() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $receipt$
BEGIN
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>NEW.expected_count
 OR (SELECT count(*) FROM supabase_migrations.schema_migrations
     WHERE name=NEW.expected_name AND position(NEW.canonical_marker IN array_to_string(statements,E'\\n'))>0)<>1 THEN
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Provider must commit sealed DDL and exactly one matching migration receipt atomically';
 END IF;
 RETURN NEW;
END;$receipt$;
CREATE CONSTRAINT TRIGGER mass_provider_history_check AFTER INSERT ON mass_provider_receipt
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pg_temp.mass_provider_history_check();
"""
            receipt += 'INSERT INTO mass_provider_receipt VALUES(' + literal(name) + ',' + literal(marker) + ',' + str(20 + i) + ');\n'
            body = "-- Provider transaction owns commit AND migration history.\n" + receipt + "DO $provenance$ BEGIN PERFORM " + literal(marker) + '; END;$provenance$;\n' + body
            if baseline is not None:
                needle = "SELECT pg_advisory_xact_lock(hashtextextended('MASS.reviewed.installation',0));"
                body = body.replace(needle, needle + '\n' + preservation_guard(baseline), 1)
            destination = output / entry['envelope']
            destination.write_text(body)
            destination.chmod(0o600)
            manifest.append({**entry, 'provider_name': name,
                             'envelope_sha256': hashlib.sha256(body.encode()).hexdigest(),
                             'ledger_owner': 'provider', 'requires_atomic_provider_transaction': True})
    (output / 'PROVIDER-ENVELOPES.json').write_text(json.dumps({'files': manifest}, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    parser.add_argument('--include-proposal-024', action='store_true')
    parser.add_argument('--baseline', type=Path, help='Private original-column fingerprint/catalog JSON, outside Git')
    args = parser.parse_args()
    baseline = json.loads(args.baseline.read_text()) if args.baseline else None
    print(json.dumps(prepare_provider(args.output, args.include_proposal_024, baseline), indent=2))
