import importlib.util,json,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('activation_prepare',ROOT/'scripts/activation/prepare.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class PrepareTests(unittest.TestCase):
 def test_builder_never_includes_024_implicitly(self):
  with tempfile.TemporaryDirectory() as out:
   rows=module.prepare(out);self.assertEqual(len(rows),4)
   for row in rows:
    sql=(Path(out)/row['envelope']).read_text();self.assertTrue(sql.rstrip().endswith('COMMIT;'));self.assertIn('MASS_ACTIVATION_GUARD_V1',sql);self.assertIn('INSERT INTO supabase_migrations.schema_migrations',sql);self.assertIn("SET LOCAL lock_timeout='5s'",sql)
 def test_separate_proposal_is_explicit_and_deterministic(self):
  with tempfile.TemporaryDirectory() as a,tempfile.TemporaryDirectory() as b:
   first=module.prepare(a,True);self.assertEqual(first,module.prepare(b,True));self.assertEqual(len(first),5);self.assertTrue(first[-1]['separate_proposal'])
 def test_never_put_execution_artifacts_in_checkout(self):
  with self.assertRaises(ValueError):module.prepare(ROOT/'unsafe-test-output')
if __name__=='__main__':unittest.main()
