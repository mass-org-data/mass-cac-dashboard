import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/activation'))
spec = importlib.util.spec_from_file_location('provider_prepare', ROOT / 'scripts/activation/prepare_provider.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProviderPrepareTests(unittest.TestCase):
    def test_provider_owns_one_history_entry_and_all_four_seals(self):
        with tempfile.TemporaryDirectory() as output:
            entries = module.prepare_provider(output)
            self.assertEqual(len(entries), 4)
            for i, entry in enumerate(entries):
                body = (Path(output) / entry['envelope']).read_text()
                self.assertNotIn('INSERT INTO supabase_migrations.schema_migrations', body)
                self.assertNotIn('COMMIT;', body)
                self.assertNotIn('\nBEGIN;\n', body)
                self.assertIn('MASS_ACTIVATION_GUARD_V1', body)
                self.assertIn('MASS_CANONICAL_SHA256:' + entry['source_sha256'], body)
                self.assertIn('DEFERRABLE INITIALLY DEFERRED', body)
                self.assertIn('exactly one matching migration receipt atomically', body)
                self.assertLess(body.index('CREATE TEMP TABLE mass_provider_receipt'), body.index('SET LOCAL ROLE mass_core_owner'))
                self.assertIn('count(*) FROM supabase_migrations.schema_migrations)<>' + str(19 + i), body)
                for predecessor in entries[:i]:
                    self.assertIn("name='" + predecessor['provider_name'] + "'", body)
                self.assertTrue(entry['requires_atomic_provider_transaction'])

    def test_proposal_is_separate_and_output_is_deterministic(self):
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            a = module.prepare_provider(first, True)
            self.assertEqual(a, module.prepare_provider(second, True))
            self.assertEqual(len(a), 5)
            self.assertTrue(a[-1]['separate_proposal'])

    def test_generated_execution_files_never_enter_repository(self):
        with self.assertRaises(ValueError):
            module.prepare_provider(ROOT / 'unsafe-provider-output')

    def test_private_catalog_cannot_inject_sql_or_skip_a_preserved_table(self):
        relations = [{'schema': 'mass_core', 'table': 'fixture_' + str(i), 'columns': ['id']} for i in range(27)]
        fingerprints = [{'relation': r['schema'] + '.' + r['table'], 'rows': 0, 'fingerprint': 'a' * 64} for r in relations]
        baseline = {'catalog': {'relations': relations}, 'fingerprints': fingerprints}
        guard = module.preservation_guard(baseline)
        self.assertIn('IN SHARE ROW EXCLUSIVE MODE', guard)
        self.assertIn('Pre-existing MASS data or grants changed', guard)
        relations[0]['columns'] = ['id); SELECT 1;--']
        with self.assertRaises(ValueError):
            module.preservation_guard(baseline)
        relations[0]['columns'] = ['id']
        fingerprints[0]['rows'] = -1
        with self.assertRaises(ValueError):
            module.preservation_guard(baseline)
