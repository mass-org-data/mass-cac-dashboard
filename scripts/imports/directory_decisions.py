"""Approved 28-Oct directory associations; staff names never establish identities.
All plans, staff candidate names and SQL outputs stay private. No database access.
"""
from collections import Counter,defaultdict
from common import Invalid,ident,uid,digest,token
from review import scaffold,preview

def canonical_donor(value):
 key=' '.join(str(value or '').split()).casefold()
 labels={'mpockket':'Mpokket','mpokket':'Mpokket','fanuc':'Fanuc','mcafee':'McAfee',
 'dasar uk':'Dasra UK','dasra uk':'Dasra UK',
 'j.f - hukkeri':'J.F - Hukkeri','j.f - chikkodi':'J.F - Chikkodi',
 'j.f - raibag':'J.F - Raibag','j.f - athani':'J.F - Athani'}
 if key not in labels:raise Invalid('Unapproved donor label; preserve source and request review.')
 return labels[key]

def association_review(plan,decision_ref):
 """Directory-only proposed canonical review; all named staff remain deferred.
 This is an executable preparation proposal, never production execution approval.
 """
 if plan.get('kind')!='directory':raise Invalid('Expected a directory source plan.')
 token(decision_ref);mapping=scaffold(plan);donors={};centres={};candidates=[]
 issues_by_centre=defaultdict(Counter)
 for o in plan['observations']:
  v=o['values'];raw=o['raw'];row=o['source_row_id']
  label=canonical_donor(v.get('donor'));donor_id=ident('mass-approved-directory-donor',label)
  centre_label=v.get('centre')
  if not centre_label:raise Invalid('Missing centre evidence; do not silently import unresolved association.')
  centre_key=(donor_id,centre_label.casefold())
  centre_id=ident('mass-approved-donor-centre',*centre_key)
  donor_slot=o['source_columns'].get('donor');centre_slot=o['source_columns'].get('centre')
  if not donor_slot or not centre_slot or not raw.get('donor'):raise Invalid('Physical donor and centre source evidence required.')
  donors.setdefault(donor_id,{'id':donor_id,'label':label,'source_label':str(raw['donor']),'source_row_id':row,'source_slot':donor_slot})
  centres.setdefault(centre_id,{'id':centre_id,'label':centre_label,'donor_id':donor_id,'source_row_id':row,'source_slot':centre_slot})
  mapping['dispositions'][row]='accepted'
  mapping['row_identities'][row]={'centre_id':centre_id,'donor_id':donor_id,'teacher_id':None,'officer_id':None}
  holds={}
  for field in ('teacher','officer'):
   if not v.get(field):continue
   holds[field]={'reason_code':'unverified_record','decision_ref':decision_ref}
   candidates.append({'candidate_id':ident('staff-source-occurrence',row,o['source_columns'][field]),'canonical_staff_id':None,'source_row_id':row,'source_slot':o['source_columns'][field],'worksheet_ordinal':o['worksheet_ordinal'],'row_number':o['row_number'],'role_code':'Teacher' if field=='teacher' else 'Cluster Officer','source_name':raw[field],'normalized_name_candidate':v[field],'centre_id':centre_id,'donor_id':donor_id,'shift_code':v.get('shift'),'status':'identity_verification_pending'})
  if holds:mapping['deferred_staff'][row]=holds
  deferred=[i for i in o['issues'] if i in ('staff_identity_review','student_name_identity_review','duplicate_source_observation','missing_teacher','missing_officer','contact_detail_in_staff_cell','possible_multiple_staff_in_cell')]
  resolved=[i for i in o['issues'] if i not in deferred]
  # Unknown shifts, formulas and missing donor evidence cannot be blanket resolved.
  if set(resolved)-{'centre_identity_review','possible_multiple_donors','regional_identity_collision','masaraguppi_review'}:raise Invalid('Unapproved source quality issue blocks association preparation.')
  mapping['resolutions'][row]={'resolved_issues':resolved,'deferred_issues':deferred,'decision_ref':decision_ref}
  issues_by_centre[centre_id].update(o['issues'])
 mapping['entities']['donors']=sorted(donors.values(),key=lambda e:e['label'])
 mapping['entities']['centres']=sorted(centres.values(),key=lambda e:(e['donor_id'],e['label']))
 by_name=defaultdict(list)
 for c in candidates:by_name[(c['role_code'],c['normalized_name_candidate'].casefold())].append(c['candidate_id'])
 report={'format':'mass-directory-identity-exceptions-v1','plan_digest':digest(plan),'mapping_digest':digest(mapping),'decision_ref':decision_ref,
 'source_row_exceptions':[{'source_row_id':o['source_row_id'],'worksheet_ordinal':o['worksheet_ordinal'],'exact_worksheet_name':plan['sheets'][o['worksheet_ordinal']-1]['original_name'],'physical_row_number':o['row_number'],'source_columns':o['source_columns'],'issues':o['issues'],'resolution':mapping['resolutions'][o['source_row_id']],'source_student_name_for_identity_review':o['raw'].get('student_name') if set(o['issues']) & {'student_name_identity_review','duplicate_source_observation'} else None} for o in plan['observations'] if o['issues']],
 'staff_candidates':candidates,'name_candidate_groups':[{'role_code':role,'normalized_name_candidate':name,'source_candidate_ids':ids,'identity_merge_approved':False} for (role,name),ids in by_name.items()],
 'centre_source_issue_counts':{k:dict(v) for k,v in issues_by_centre.items()},
 'summary':{**preview(plan,mapping),'staff_source_occurrences':len(candidates),'normalized_staff_name_groups_not_people':len(by_name),
 'verified_staff_import_count':0,'verified_staff_assignment_import_count':0,
 'centre_counts_by_canonical_donor':dict(Counter(donors[c['donor_id']]['label'] for c in centres.values())),
 'masaraguppi_centres':[{'id':c['id'],'donor_label':donors[c['donor_id']]['label']} for c in centres.values() if c['label'].casefold()=='masaraguppi']}}
 return mapping,report
