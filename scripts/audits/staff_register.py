"""Private, read-only staff-register analysis. No accounts, grants or OAuth changes.

Inputs are private workbook and read-only directory/Auth snapshots. Output is
forced outside the checkout. Source values/identities remain in private reports.
"""
import argparse,collections,hashlib,json,re,unicodedata
from pathlib import Path
import openpyxl

ROLES={'Cluster Officers':'Cluster Officer','Teachers':'Teacher','Senior Leadership':'Leadership'}
def norm(value):return ' '.join(unicodedata.normalize('NFKC',str(value or '')).casefold().split())
def email_valid(value):
    if not isinstance(value,str):return False
    value=value.strip()
    if len(value)>254 or value.count('@')!=1:return False
    local,domain=value.split('@')
    return bool(local and len(local)<=64 and not local.startswith('.') and not local.endswith('.') and '..' not in local and re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+",local) and '.' in domain and all(re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?',s) for s in domain.split('.')) and re.fullmatch(r'[A-Za-z]{2,63}',domain.split('.')[-1]))
def donor_key(value):
    key=norm(value)
    return {'mpockket':'mpokket','mpokket':'mpokket','dasar uk':'dasra uk','dasra uk':'dasra uk'}.get(key,key)
def analyse(workbook,directory,auth):
    w=openpyxl.load_workbook(workbook,read_only=True,data_only=True)
    if set(w.sheetnames)!=set(ROLES):raise ValueError('Unexpected staff tabs; inspect source before mapping')
    rows=[];exceptions=[]
    def issue(row,code,level='review'):
        item={'sheet':row['sheet'],'row':row['row'],'code':code,'level':level};exceptions.append(item);row['issues'].append(code)
    for sheet in w:
        headers=[str(c.value or '').strip() for c in next(sheet.iter_rows(min_row=3,max_row=3))]
        if headers[:2]!=['Name','Email ID']:raise ValueError('Unexpected staff headers; no layout guessing')
        for values in sheet.iter_rows(min_row=4):
            if not any(c.value is not None for c in values):continue
            item={headers[i]:c.value for i,c in enumerate(values) if i<len(headers) and headers[i]}
            row={'sheet':sheet.title,'row':values[0].row,'role_proposal':ROLES[sheet.title],'name':item.get('Name'),'source_centre':item.get('Center name'),'source_officer':item.get('Cluster officer name'),'source_project':item.get('Project name'),'source':item,'issues':[],'email':str(item.get('Email ID') or '').strip(),'auth_id_proposal':None,'directory_staff_ids_proposal':[],'centre_ids_proposal':[],'starts_at':None,'ends_at':None,'shift_scope':None,'can_read_profiles':None,'authorization_ready':False}
            rows.append(row)
            if not item.get('Name'):issue(row,'missing_name')
            if not row['email']:issue(row,'missing_email')
            elif not email_valid(item.get('Email ID')):issue(row,'invalid_email_format')
            elif str(item['Email ID'])!=row['email']:issue(row,'email_outer_whitespace','info')
    w.close()
    emails=collections.defaultdict(list);names=collections.defaultdict(list)
    for row in rows:
        if email_valid(row['email']):emails[norm(row['email'])].append(row)
        if row['source'].get('Name'):names[norm(row['source']['Name'])].append(row)
    for group in emails.values():
        if len(group)<2:continue
        conflict=len({norm(r['source'].get('Name')) for r in group})>1
        for row in group:issue(row,'email_shared_by_different_names' if conflict else 'repeated_email_identity', 'review' if conflict else 'info')
    for group in names.values():
        if len({norm(r['email']) for r in group if email_valid(r['email'])})>1:
            for row in group:issue(row,'same_name_multiple_emails')
    auth_by_email=collections.defaultdict(list)
    for user in auth:auth_by_email[norm(user.get('email'))].append(user)
    staff_by_name=collections.defaultdict(list)
    for staff in directory.get('staff') or []:
        for name in {norm(staff.get('display_name')),norm(staff.get('source_name'))}:staff_by_name[name].append(staff)
    centres=directory.get('centres') or [];assignments=directory.get('assignments') or []
    for row in rows:
        if email_valid(row['email']):
            matches=auth_by_email[norm(row['email'])]
            if 'email_shared_by_different_names' in row['issues']:issue(row,'auth_link_held_for_conflicting_source_identity')
            elif len(matches)==1:
                row['auth_id_proposal']=matches[0]['id']
                if not matches[0].get('confirmed'):issue(row,'auth_email_unconfirmed')
            elif not matches:issue(row,'no_existing_auth_email_match')
            else:issue(row,'ambiguous_auth_email_match')
        candidates=staff_by_name[norm(row['source'].get('Name'))]
        row['directory_staff_ids_proposal']=sorted({s['id'] for s in candidates})
        if not candidates and row['role_proposal']!='Leadership':issue(row,'no_exact_directory_name_match')
        elif len({s['id'] for s in candidates})>1:issue(row,'ambiguous_directory_identity')
        if row['role_proposal']=='Teacher':
            matching=[c for c in centres if norm(c['label'])==norm(row['source'].get('Center name'))]
            project=donor_key(row['source'].get('Project name'))
            narrowed=[c for c in matching if donor_key(c.get('donor_label'))==project]
            if len(matching)>1 and narrowed:matching=narrowed
            if len(matching)==1:
                centre=matching[0];row['centre_ids_proposal']=[centre['id']]
                if project and donor_key(centre.get('donor_label'))!=project:issue(row,'centre_project_mismatch')
                known=[a for a in assignments if a['centre_id']==centre['id'] and a['role_code']=='Teacher' and a['staff_member_id'] in row['directory_staff_ids_proposal']]
                if not known:issue(row,'teacher_centre_directory_relationship_unverified')
            else:issue(row,'ambiguous_centre' if matching else 'centre_not_exactly_matched')
        elif row['role_proposal']=='Leadership':issue(row,'leadership_scope_not_supplied')
        # Missing dates/shift/profile authority are not filled from student FY
        # assumptions, staff names, donor projects or blank directory shifts.
        issue(row,'effective_dates_not_supplied');issue(row,'shift_authority_not_supplied')
    officers=collections.defaultdict(list)
    for row in rows:
        if row['role_proposal']=='Cluster Officer':officers[norm(row['source'].get('Name'))].append(row)
    relationships=[]
    for teacher in [r for r in rows if r['role_proposal']=='Teacher']:
        linked=officers[norm(teacher['source'].get('Cluster officer name'))]
        relation={'teacher_sheet':teacher['sheet'],'teacher_row':teacher['row'],'officer_source_name':teacher['source'].get('Cluster officer name'),'officer_rows_proposal':[r['row'] for r in linked],'centre_ids_proposal':teacher['centre_ids_proposal'],'directory_relationship_supported':False}
        if len(linked)!=1:issue(teacher,'officer_name_missing_or_ambiguous')
        elif teacher['centre_ids_proposal']:
            officer=linked[0];centre=teacher['centre_ids_proposal'][0]
            relation['directory_relationship_supported']=any(a['centre_id']==centre and a['role_code']=='Cluster Officer' and a['staff_member_id'] in officer['directory_staff_ids_proposal'] for a in assignments)
            if not relation['directory_relationship_supported']:issue(teacher,'officer_directory_relationship_mismatch')
            officer['centre_ids_proposal']=sorted(set(officer['centre_ids_proposal']+[centre]))
        relationships.append(relation)
    for officer in [r for r in rows if r['role_proposal']=='Cluster Officer']:
        if not officer['centre_ids_proposal']:issue(officer,'no_teacher_supported_centre_proposal')
        issue(officer,'project_is_not_authorization_scope')
    summary={'source_sha256':hashlib.sha256(Path(workbook).read_bytes()).hexdigest(),'tabs_read':list(ROLES),'source_rows':len(rows),'by_tab':{name:sum(r['sheet']==name for r in rows) for name in ROLES},'valid_email_rows':sum(email_valid(r['email']) for r in rows),'missing_email_rows':sum(not r['email'] for r in rows),'invalid_email_rows':sum(bool(r['email']) and not email_valid(r['email']) for r in rows),'unique_valid_emails':len(emails),'duplicate_email_groups':sum(len(v)>1 for v in emails.values()),'existing_auth_email_matches':sum(bool(r['auth_id_proposal']) for r in rows),'unique_centre_proposal_rows':sum(len(r['centre_ids_proposal'])==1 for r in rows if r['role_proposal']=='Teacher'),'directory_identity_ambiguous_rows':sum('ambiguous_directory_identity' in r['issues'] for r in rows),'officer_relationships_checked':len(relationships),'officer_directory_relationships_supported':sum(r['directory_relationship_supported'] for r in relationships),'authorization_ready_rows':0,'accounts_created':0,'permissions_granted':0,'google_sign_in_configured':False,'exception_counts':dict(collections.Counter(e['code'] for e in exceptions))}
    return {'summary':summary,'rows':rows,'exceptions':exceptions,'officer_relationships':relationships}
def safe_excel(value):
    if isinstance(value,(list,dict)):value=json.dumps(value,ensure_ascii=False)
    if isinstance(value,str) and value.lstrip().startswith(('=','+','-','@')):return "'"+value
    return value

def write_private(result,output):
    output=Path(output).resolve();repo=Path(__file__).resolve().parents[2]
    if output.is_relative_to(repo):raise ValueError('Private reports must remain outside Git checkout')
    output.mkdir(parents=True,exist_ok=True,mode=0o700)
    f=output/'staff-analysis.private.json';f.write_text(json.dumps(result,indent=2,ensure_ascii=False));f.chmod(0o600)
    w=openpyxl.Workbook();w.remove(w.active)
    tabs={'Summary':[{'measure':k,'value':v} for k,v in result['summary'].items()],'Staff rows':result['rows'],'Exceptions':result['exceptions'],'Officer relationships':result['officer_relationships']}
    for name,rows in tabs.items():
        s=w.create_sheet(name)
        if not rows:continue
        headers=list(rows[0]);s.append(headers)
        for row in rows:s.append([safe_excel(row.get(h)) for h in headers])
        s.freeze_panes='A2';s.auto_filter.ref=s.dimensions
    f=output/'STAFF-QUALITY-AND-MAPPING.private.xlsx';w.save(f);w.close();f.chmod(0o600)
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('workbook',type=Path);p.add_argument('--directory',type=Path,required=True);p.add_argument('--auth',type=Path,required=True);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
    directory=json.loads(args.directory.read_text())[0]['data'];auth=json.loads(args.auth.read_text())
    result=analyse(args.workbook,directory,auth);write_private(result,args.output);print(json.dumps(result['summary']))
