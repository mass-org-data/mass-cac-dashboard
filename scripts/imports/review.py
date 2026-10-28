"""Explicit review gates; never creates real-world canonical identity mappings."""
from collections import Counter
from common import Invalid,digest,uid,text,token,ident
import re
KINDS=('donors','centres','staff_members','centre_staff_assignments')
FIELDS={
 'donors':{'id','label','source_label','source_row_id','source_slot'},
 'centres':{'id','label','donor_id','source_row_id','source_slot'},
 'staff_members':{'id','display_name','source_name','source_row_id','source_slot'},
 'centre_staff_assignments':{'id','centre_id','staff_member_id','role_code','shift_code','source_row_id','source_slot'},
}
def scaffold(plan):
 return {'format':'mass-canonical-review-v1','plan_digest':digest(plan),'entities':{k:[] for k in KINDS},'dispositions':{},'row_identities':{},'resolutions':{}}
def preview(plan,mapping=None):
 observations=plan['observations'];allrows=[r for s in plan['sheets'] for r in s['rows']]
 return {'plan_digest':digest(plan),'mapping_digest':digest(mapping) if mapping else None,'populated_student_rows':sum(bool(o.get('values',{}).get('student_name')) for o in observations),'distinct_normalized_centre_labels':len({o.get('values',{}).get('centre','').casefold() for o in observations if o.get('values',{}).get('centre')}),'per_sheet':[{'ordinal':s['ordinal'],'observations':sum(o['worksheet_ordinal']==s['ordinal'] for o in observations),'populated_student_rows':sum(o['worksheet_ordinal']==s['ordinal'] and bool(o.get('values',{}).get('student_name')) for o in observations)} for s in plan['sheets']],'source_available':True,'kind':plan['kind'],'sheets':len(plan['sheets']),'registered_source_rows':len(allrows),'candidate_source_rows':sum(r['classification']=='candidate' for r in allrows),'observations':len(observations),'flagged_observations':sum(bool(o['issues']) for o in observations),'issue_counts':dict(Counter(i for o in observations for i in o['issues'])),'proposed_entities':{k:len((mapping or {}).get('entities',{}).get(k,[])) for k in KINDS},'approved_for_execution':False}
def validate(plan,mapping,approval):
 if plan.get('format')!='mass-import-plan-v1' or plan.get('kind')!='directory':raise Invalid('Historical observations are review-only; operational adapter approval is still required.')
 source=plan['source'];uid(source['id']);uid(source['storage_ref'])
 if not re.fullmatch(r'[0-9a-f]{64}',source['sha256']) or source['id']!=ident('file',source['sha256']) or source['storage_ref']!=ident('storage',source['sha256']):raise Invalid('Source snapshot identity mismatch.')
 for ordinal,sheet in enumerate(plan['sheets'],1):
  if sheet['ordinal']!=ordinal or sheet['id']!=ident('sheet',source['id'],ordinal):raise Invalid('Physical sheet identity mismatch.')
  for number,row in enumerate(sheet['rows'],1):
   if row['row_number']!=number or row['id']!=ident('row',sheet['id'],number) or not re.fullmatch(r'[0-9a-f]{64}',row['content_hash']):raise Invalid('Physical source row/fingerprint mismatch.')
 if mapping.get('format')!='mass-canonical-review-v1' or mapping.get('plan_digest')!=digest(plan):raise Invalid('Canonical mapping does not match this immutable source plan.')
 if approval.get('plan_digest')!=digest(plan) or approval.get('mapping_digest')!=digest(mapping):raise Invalid('Review approval is stale or missing.')
 if approval.get('scope')!='directory-only' or approval.get('approved') is not True:raise Invalid('Explicit directory-only approval required.')
 for k in ('identity_reviewed','source_provenance_reviewed','single_donor_reviewed','regions_reviewed','shifts_reviewed','directory_privacy_approved'):
  if approval.get(k) is not True:raise Invalid('Required source/privacy/identity approval is missing.')
 token(approval.get('reviewer_ref'));token(approval.get('decision_ref'))
 rows={r['id']:r for s in plan['sheets'] for r in s['rows']};obs={o['source_row_id']:o for o in plan['observations']}
 dispositions=mapping.get('dispositions',{})
 if set(dispositions)!=set(obs):raise Invalid('Every candidate row needs an explicit accepted/quarantined/excluded disposition.')
 if any(x not in ('accepted','quarantined','excluded') for x in dispositions.values()):raise Invalid('Invalid row disposition.')
 entities=mapping.get('entities',{})
 if set(entities)!=set(KINDS):raise Invalid('Unsupported import entity set.')
 lookup={}
 for kind in KINDS:
  lookup[kind]={}
  for entity in entities[kind]:
   if set(entity)!=FIELDS[kind]:raise Invalid('Unexpected or missing reviewed entity field.')
   key=uid(entity['id']);row=uid(entity['source_row_id']);slot=entity['source_slot']
   if key in lookup[kind] or row not in obs or dispositions.get(row)!='accepted':raise Invalid('Duplicate canonical ID or unapproved source reference.')
   if not isinstance(slot,int) or isinstance(slot,bool) or slot<=0:raise Invalid('Physical source slot required.')
   o=obs[row]
   if kind=='donors':
    if slot!=o['source_columns'].get('donor') or str(o['raw'].get('donor') or '')!=entity['source_label']:raise Invalid('Donor must retain explicit physical source evidence, not inferred sheet identity.')
    text(entity['label'],160);text(entity['source_label'])
   elif kind=='centres':
    if slot!=o['source_columns'].get('centre') or not o['raw'].get('centre'):raise Invalid('Verified centre source cell required.')
    text(entity['label'],120);uid(entity['donor_id'])
   elif kind=='staff_members':
    fields=[k for k in ('teacher','officer') if o['source_columns'].get(k)==slot]
    if len(fields)!=1 or str(o['raw'].get(fields[0]) or '')!=entity['source_name']:raise Invalid('Staff original spelling/source slot mismatch.')
    if 'contact_detail_in_staff_cell' in o['issues']:raise Invalid('Corrected single-name source evidence required; do not import contact details into directory names.')
    text(entity['display_name'],160);text(entity['source_name'])
   else:
    role=entity['role_code'];shift=entity['shift_code']
    if role not in ('Teacher','Cluster Officer') or shift not in (None,'Morning','Evening'):raise Invalid('Only verified directory role/shift options are allowed.')
    field='teacher' if role=='Teacher' else 'officer'
    if slot!=o['source_columns'].get(field) or not o['raw'].get(field):raise Invalid('Assignment role/source cell mismatch.')
    if shift!= (o['values'].get('shift') or None):raise Invalid('Source shift is unknown/inconsistent; do not infer Both or dates.')
    uid(entity['centre_id']);uid(entity['staff_member_id'])
   lookup[kind][key]=entity
 for centre in entities['centres']:
  if centre['donor_id'] not in lookup['donors']:raise Invalid('Every centre donor must be included in the reviewed canonical mapping.')
 identities=mapping.get('row_identities',{})
 if set(identities)!={r for r,v in dispositions.items() if v=='accepted'}:raise Invalid('Explicit canonical identities are required for every accepted source row.')
 for row,ids in identities.items():
  if set(ids)!={'centre_id','donor_id','teacher_id','officer_id'}:raise Invalid('Incomplete reviewed row identity mapping.')
  if ids['centre_id'] not in lookup['centres'] or ids['donor_id'] not in lookup['donors']:raise Invalid('Unknown row centre/donor identity.')
  if lookup['centres'][ids['centre_id']]['donor_id']!=ids['donor_id']:raise Invalid('Source row disagrees with the reviewed single-donor centre relationship.')
  for role,field in [('teacher','teacher_id'),('officer','officer_id')]:
   if obs[row]['values'].get(role):
    if ids[field] not in lookup['staff_members']:raise Invalid('Missing reviewed source staff identity.')
   elif ids[field] is not None:raise Invalid('Do not create a staff identity from an empty source cell.')
 for a in entities['centre_staff_assignments']:
  row_ids=identities[a['source_row_id']]
  if a['centre_id']!=row_ids['centre_id'] or a['staff_member_id']!=row_ids['teacher_id' if a['role_code']=='Teacher' else 'officer_id']:raise Invalid('Staff relationship disagrees with reviewed source row identities.')
  if a['centre_id'] not in lookup['centres'] or a['staff_member_id'] not in lookup['staff_members']:raise Invalid('Reviewed assignment parent mapping missing.')
 for row,o in obs.items():
  if dispositions[row]=='accepted' and o['issues']:
   resolution=mapping.get('resolutions',{}).get(row,{})
   if set(resolution.get('resolved_issues',[]))!=set(o['issues']):raise Invalid('Accepted source row still has unresolved identity/region/quality exceptions.')
   token(resolution.get('decision_ref'))
 # Same physical origin or NULL-aware assignment key must not imply two identities.
 for kind,items in entities.items():
  keys=[(x['source_row_id'],x['source_slot'],*( (x['role_code'],x['shift_code']) if kind=='centre_staff_assignments' else ())) for x in items]
  if len(set(keys))!=len(keys):raise Invalid('Source occurrence identity collision.')
 keys=[(x['centre_id'],x['staff_member_id'],x['role_code'],x['shift_code']) for x in entities['centre_staff_assignments']]
 if len(set(keys))!=len(keys):raise Invalid('Duplicate staff/shift relationship.')
 # Approved target counts describe directory entities, never children or legal donor counts inferred from names.
 return preview(plan,mapping)
