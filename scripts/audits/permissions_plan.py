"""Private dry-run only. Never provisions Auth users, grants roles or emits SQL."""
import argparse,collections,datetime as dt,json,re,sys,uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from scripts.audits.staff_register import email_valid
ROLES={'Teacher','Cluster Officer','Leadership'}
def stamp(value):
    d=dt.datetime.fromisoformat(str(value).replace('Z','+00:00'))
    if d.tzinfo is None:raise ValueError('timezone required')
    return d.astimezone(dt.timezone.utc)
def valid_uuid(value):
    try:return str(uuid.UUID(str(value)))==value
    except (ValueError,TypeError,AttributeError):return False
def overlap(a,b):
    end=lambda r:stamp(r['ends_at']) if r.get('ends_at') else dt.datetime.max.replace(tzinfo=dt.timezone.utc)
    return stamp(a['starts_at'])<end(b) and stamp(b['starts_at'])<end(a)
def plan(rows,auth,directory):
    accounts=collections.defaultdict(list);emails=collections.defaultdict(set)
    for a in auth:
        accounts[a['id']].append(a)
        if email_valid(a.get('email')):emails[a['email'].strip().casefold()].add(a['id'])
    centres={c['id'] for c in directory['centres']};assignments={a['id']:a for a in directory.get('assignments',[])};existing=directory.get('scope_grants') or [];results=[]
    for i,r in enumerate(rows):
        errors=[];u=r.get('user_id');centre=r.get('centre_id');role=r.get('role_code');email=r.get('email','')
        def fail(code):errors.append(code)
        for key in ['identity_verified','centre_verified','role_verified','scope_verified','profile_access_verified']:
            if r.get(key) is not True:fail(key+'_required')
        if not valid_uuid(u):fail('existing_auth_uuid_required')
        matching=accounts.get(u,[])
        if len(matching)!=1 or not matching[0].get('confirmed'):fail('one_confirmed_existing_auth_account_required')
        if not email_valid(email) or len(matching)==1 and str(matching[0].get('email','')).strip().casefold()!=email.strip().casefold():fail('verified_email_identity_mismatch')
        if email_valid(email) and len(emails[email.strip().casefold()])!=1:fail('unambiguous_existing_email_identity_required')
        if centre not in centres:fail('existing_centre_required')
        if role not in ROLES:fail('approved_role_required')
        if role=='Leadership' and r.get('can_read_profiles') is True:fail('leadership_profile_access_not_supported')
        if r.get('shift_scope')!='Whole centre':fail('current_centre_policy_cannot_grant_unverified_or_shift_limited_scope')
        if type(r.get('can_read_profiles')) is not bool:fail('explicit_profile_capability_required')
        if not isinstance(r.get('verification_ref'),str) or not re.fullmatch(r'[A-Za-z0-9_./:#-]{1,160}',r['verification_ref']):fail('opaque_verification_reference_required')
        try:
            start=stamp(r.get('starts_at'));end=stamp(r['ends_at']) if r.get('ends_at') else None
            if end and end<=start:raise ValueError()
        except (ValueError,TypeError):fail('verified_timezone_aware_dates_required')
        if 'ends_at' not in r:fail('explicit_end_or_verified_open_interval_required')
        if role=='Cluster Officer':
            try:
                start_day=dt.date.fromisoformat(r.get('officer_starts_on',''))
                if r.get('officer_dates_verified') is not True or 'officer_ends_before' not in r:raise ValueError()
                if r.get('officer_ends_before') and dt.date.fromisoformat(r['officer_ends_before'])<=start_day:raise ValueError()
            except (ValueError,TypeError):fail('separately_verified_officer_assignment_dates_required')
            a=assignments.get(r.get('directory_assignment_id'))
            if r.get('staff_link_verified') is not True or not a or a['centre_id']!=centre or a['role_code']!='Cluster Officer':fail('verified_officer_directory_auth_link_required')
        candidates=([g for g in existing if g['user_id']==u]+[x for j,x in enumerate(rows) if j!=i and x.get('user_id')==u]) if valid_uuid(u) else []
        if not any('dates_required' in e for e in errors):
            for g in candidates:
                try:
                    if overlap(r,g) and (role=='Leadership')!=(g.get('role_code')=='Leadership'):fail('mixed_leadership_write_role_interval')
                except (ValueError,TypeError,KeyError):fail('existing_or_proposed_scope_interval_unverified')
        def same_grant(g):
            try:return all(g.get(k)==r.get(k) for k in ['user_id','centre_id','role_code','can_read_profiles']) and stamp(g['starts_at'])==stamp(r['starts_at']) and (stamp(g['ends_at']) if g.get('ends_at') else None)==(stamp(r['ends_at']) if r.get('ends_at') else None)
            except (ValueError,TypeError,KeyError):return False
        exact=[g for g in existing if same_grant(g)]
        # Overlapping grants or capability changes require explicit review, not
        # additive duplicate rows or an inferred permission upgrade.
        for g in candidates:
            try:
                if g.get('centre_id')==centre and g.get('role_code')==role and overlap(r,g) and g not in exact:fail('overlapping_scope_or_permission_change_requires_review')
            except (ValueError,TypeError,KeyError):pass
        source=r.get('source_ref')
        if source is not None and (not isinstance(source,dict) or set(source)!={'sha256','sheet','row'} or not re.fullmatch(r'[0-9a-f]{64}',str(source.get('sha256',''))) or source.get('sheet') not in ('Teachers','Cluster Officers','Senior Leadership') or type(source.get('row')) is not int or source['row']<1):
            fail('minimized_source_reference_required');source=None
        results.append({'row_index':i,'source_ref':source,'status':'held' if errors else 'already_configured' if exact else 'ready_for_separate_administrator_application','issues':sorted(set(errors)),'proposal':None if errors else {k:r.get(k) for k in ['user_id','centre_id','role_code','starts_at','ends_at','can_read_profiles','verification_ref','directory_assignment_id','officer_starts_on','officer_ends_before']}})
    summary={'rows':len(rows),'by_status':dict(collections.Counter(r['status'] for r in results)),'issue_counts':dict(collections.Counter(e for r in results for e in r['issues'])),'accounts_created':0,'grants_applied':0,'sql_generated':False}
    return {'summary':summary,'rows':results}
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('verified_manifest',type=Path);p.add_argument('--auth',type=Path,required=True);p.add_argument('--directory',type=Path,required=True);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
    if args.output.resolve().is_relative_to(Path(__file__).resolve().parents[2]):raise SystemExit('Private output must be outside checkout')
    data=json.loads(args.directory.read_text());directory=data[0]['data'] if isinstance(data,list) else data
    result=plan(json.loads(args.verified_manifest.read_text())['rows'],json.loads(args.auth.read_text()),directory)
    args.output.parent.mkdir(parents=True,exist_ok=True,mode=0o700);args.output.write_text(json.dumps(result,indent=2));args.output.chmod(0o600);print(json.dumps(result['summary']))
