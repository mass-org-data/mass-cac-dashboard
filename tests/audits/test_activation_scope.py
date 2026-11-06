import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('activation_scope',Path(__file__).resolve().parents[2]/'scripts/audits/activation_scope.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class ScopeAuditTests(unittest.TestCase):
 def grant(self,role='Teacher',centre='a',**other):
  return dict(id='g'+centre,user_id='synthetic-actor',centre_id=centre,role_code=role,starts_at='2000-01-01T00:00:00+00:00',ends_at=None,can_read_profiles=True,auth_exists=True,banned_until=None,deleted_at=None)|other
 def data(self,grants):return dict(captured_at='2026-11-04T00:00:00+00:00',read_only='on',owner_memberships=0,grants=grants)
 def test_leadership_veto_applies_across_all_centres(self):
  rows,summary=module.analyze(self.data([self.grant(),self.grant('Leadership','b')]));self.assertTrue(all(r['read_scope'] for r in rows));self.assertFalse(any(r['write_scope'] for r in rows));self.assertFalse(any(r['profile_scope_some_enrolment_centre'] for r in rows));self.assertEqual(summary['users_with_leadership_veto'],1)
 def test_expired_future_and_empty_grants_do_not_become_usable(self):
  rows,summary=module.analyze(self.data([self.grant(ends_at='2001-01-01T00:00:00+00:00'),self.grant(centre='b',starts_at='2099-01-01T00:00:00+00:00')]));self.assertEqual(summary['active_grants'],0);self.assertFalse(any(r['write_scope'] for r in rows));self.assertEqual(module.analyze(self.data(None))[1]['grant_rows'],0)
 def test_sealed_default_cannot_be_inferred_from_existing_teacher_grants(self):
  rows,summary=module.analyze(self.data([self.grant()]));self.assertTrue(rows[0]['write_scope']);self.assertFalse(rows[0]['post_sealed_install_writes']);self.assertEqual(summary['post_sealed_install_write_users'],0)
