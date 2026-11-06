import unittest
from scripts.audits.permissions_plan import plan
U='90000000-0000-4000-8000-000000000001';C='90000000-0000-4000-8000-000000000002'
class PermissionsPlan(unittest.TestCase):
 def setUp(self):
  self.auth=[{'id':U,'email':'synthetic@example.invalid','confirmed':True}];self.directory={'centres':[{'id':C}],'assignments':[],'scope_grants':[]};self.row={'user_id':U,'email':'synthetic@example.invalid','centre_id':C,'role_code':'Teacher','shift_scope':'Whole centre','starts_at':'2026-04-01T00:00:00Z','ends_at':None,'can_read_profiles':False,'verification_ref':'synthetic/approval/1',**{k:True for k in ['identity_verified','centre_verified','role_verified','scope_verified','profile_access_verified']}}
 def test_verified_existing_identity_only_and_no_side_effects(self):
  r=plan([self.row],self.auth,self.directory);self.assertEqual(r['rows'][0]['status'],'ready_for_separate_administrator_application');self.assertEqual(r['summary']['grants_applied'],0);self.assertFalse(r['summary']['sql_generated'])
 def test_missing_identity_shift_and_profile_never_default(self):
  row={**self.row,'user_id':None,'shift_scope':None,'can_read_profiles':None};r=plan([row],self.auth,self.directory);self.assertEqual(r['rows'][0]['status'],'held');self.assertIsNone(r['rows'][0]['proposal'])
 def test_no_name_match_or_email_alias_or_new_account(self):
  r=plan([{**self.row,'email':'different@example.invalid'}],self.auth,self.directory);self.assertIn('verified_email_identity_mismatch',r['rows'][0]['issues'])
 def test_narrow_shift_cannot_become_both_shifts(self):
  r=plan([{**self.row,'shift_scope':'Morning'}],self.auth,self.directory);self.assertEqual(r['rows'][0]['status'],'held')
 def test_existing_exact_grant_no_duplicate_and_mixed_role_blocks(self):
  self.directory['scope_grants']=[{k:self.row[k] for k in ['user_id','centre_id','role_code','starts_at','ends_at','can_read_profiles']}];self.assertEqual(plan([self.row],self.auth,self.directory)['rows'][0]['status'],'already_configured');self.assertEqual(plan([{**self.row,'role_code':'Leadership'}],self.auth,self.directory)['rows'][0]['status'],'held')
 def test_leadership_profile_and_free_text_provenance_are_not_accepted(self):
  r=plan([{**self.row,'role_code':'Leadership','can_read_profiles':True,'source_ref':{'name':'Synthetic sensitive name'}}],self.auth,self.directory);self.assertEqual(r['rows'][0]['status'],'held');self.assertIsNone(r['rows'][0]['source_ref']);self.assertNotIn('Synthetic sensitive name',str(r))
 def test_unsupplied_end_is_not_an_infinite_grant(self):
  row={**self.row};row.pop('ends_at');self.assertEqual(plan([row],self.auth,self.directory)['rows'][0]['status'],'held')
 def test_equivalent_timezone_representation_is_idempotent(self):
  self.directory['scope_grants']=[{**self.row,'starts_at':'2026-04-01T00:00:00+00:00'}];self.assertEqual(plan([self.row],self.auth,self.directory)['rows'][0]['status'],'already_configured')
 def test_null_reference_cannot_become_string_none(self):
  r=plan([{**self.row,'verification_ref':None}],self.auth,self.directory);self.assertIn('opaque_verification_reference_required',r['rows'][0]['issues']);self.assertIsNone(r['rows'][0]['proposal'])
 def test_shared_existing_email_does_not_pick_an_auth_identity(self):
  self.auth.append({**self.auth[0],'id':'90000000-0000-4000-8000-000000000009'});r=plan([self.row],self.auth,self.directory);self.assertIn('unambiguous_existing_email_identity_required',r['rows'][0]['issues'])
 def test_mixed_roles_and_duplicate_requests_hold_every_row_in_any_order(self):
  leader={**self.row,'role_code':'Leadership'}
  for rows in [[self.row,leader],[leader,self.row],[self.row,self.row]]:self.assertTrue(all(r['status']=='held' for r in plan(rows,self.auth,self.directory)['rows']))
 def test_officer_scope_needs_separate_explicit_assignment_dates(self):
  assignment='90000000-0000-4000-8000-000000000003';self.directory['assignments']=[{'id':assignment,'centre_id':C,'role_code':'Cluster Officer'}]
  row={**self.row,'role_code':'Cluster Officer','directory_assignment_id':assignment,'staff_link_verified':True,'officer_dates_verified':True,'officer_starts_on':'2026-04-01','officer_ends_before':None}
  self.assertEqual(plan([row],self.auth,self.directory)['rows'][0]['status'],'ready_for_separate_administrator_application');self.assertEqual(plan([{**row,'officer_ends_before':'2026-03-31'}],self.auth,self.directory)['rows'][0]['status'],'held')
 def test_officer_needs_verified_auth_directory_link(self):
  r=plan([{**self.row,'role_code':'Cluster Officer'}],self.auth,self.directory);self.assertIn('verified_officer_directory_auth_link_required',r['rows'][0]['issues'])
if __name__=='__main__':unittest.main()
