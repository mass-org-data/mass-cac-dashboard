"""Conservative historical matching. Only explicit dates and full scoped keys.

Names are compared with whitespace/case normalization only. No fuzzy matching,
year propagation, date fabrication, household fields, or outcome implication.
"""
import collections,hashlib
from datetime import date,datetime
from decimal import Decimal,InvalidOperation
from pathlib import Path
import openpyxl
from common import ident,row_hash,json_value,Invalid
from students import norm,grade

def day(v):
    if isinstance(v,datetime):return v.date()
    if isinstance(v,date):return v
    if isinstance(v,str):
        try:return date.fromisoformat(v)
        except ValueError:pass
    return None

def prepare(paths,students,key):
    index=collections.defaultdict(list)
    for s in students:
        index[(norm(s['donor']),norm(s['centre']),norm(s['full_name']),s['grade'],s['shift'])].append(s)
    accepted=[];held=[];source_files=[];summary={}
    for kind,path in paths.items():
        sha=hashlib.sha256(Path(path).read_bytes()).hexdigest();file_id=ident('history-source',sha)
        workbook=openpyxl.load_workbook(path,read_only=True,data_only=True)
        file={'id':file_id,'sha256':sha,'kind':kind,'sheets':[]};counts=collections.Counter()
        for ordinal,sheet in enumerate(workbook,1):
            rs=list(sheet.values); sh={'id':ident('history-sheet',sha,ordinal),'ordinal':ordinal,'original_name':sheet.title,
                                      'header_row':3 if kind=='attendance' else 6 if kind=='assessment' else 4,
                                      'classification':'input','rows':[]};file['sheets'].append(sh)
            if kind=='attendance':
                if len(rs)<3 or not rs[2] or rs[2][0]!='Name of Child' or sheet.title=='MasterSheet2026':
                    sh['classification']='report';counts['excluded_derived_or_non_input_sheets']+=1;continue
                header=rs[2];columns={i:day(v) for i,v in enumerate(header) if day(v)}
                dates=collections.Counter(columns.values());start=3
            elif kind=='assessment':start=7
            else:
                headers=[i for i,r in enumerate(rs[:10]) if len(r)>2 and str(r[2]).strip()=='Student Name']
                if len(headers)!=1:raise Invalid('Morarji worksheet requires one verified Student Name header')
                start=headers[0]+1;sh['header_row']=start
            for physical,r in enumerate(rs[start:],start+1):
                name=r[0] if kind=='attendance' else r[2] if len(r)>2 else None
                if not name or str(name).lower().startswith('example'):continue
                source_id=ident('history-row',sha,ordinal,physical)
                sh['rows'].append({'id':source_id,'row_number':physical,'content_hash':row_hash([json_value(v) for v in r],key)})
                counts['source_rows']+=1
                if kind=='morarji':
                    held.append({'kind':kind,'source_row_id':source_id,'slot':1,'reason':'missing_verified_centre_grade_identity','source':[json_value(v) for v in r[:7]]});counts['held_rows']+=1;continue
                if kind=='attendance':
                    g=grade(r[1]);shift=r[4];centre=r[3];donor='Mpokket';gender=r[2]
                else:
                    g=grade(r[3]);centre=r[7];shift='Morning' if 'Morning' in sheet.title else 'Evening';gender=r[4]
                    donor='Mpokket' if sheet.title.startswith('Mpokket') else 'Fanuc' if sheet.title.startswith('Fanuc') else 'McAfee' if sheet.title.startswith('McAfee') else 'Dasra UK'
                candidates=index[norm(donor),norm(centre),norm(name),g,shift]
                student=candidates[0] if len(candidates)==1 else None
                mapped_gender={'Female':'Girl','Male':'Boy','Girl':'Girl','Boy':'Boy'}.get(str(gender).strip())
                if student and mapped_gender and student['gender'] and mapped_gender!=student['gender']:student=None
                if kind=='attendance':
                    for i,d in columns.items():
                        code=r[i] if i<len(r) else None
                        if code is None or str(code).strip()=='':counts['unrecorded_unknown_cells']+=1;continue
                        code=str(code).strip();reason=None
                        if not student:reason='unresolved_scoped_identity'
                        elif dates[d]>1:reason='duplicate_source_date'
                        elif code not in ('P','A','L','WO','MM'):reason='unsupported_attendance_status'
                        elif not date(2026,4,1)<=d<date(2027,4,1):reason='outside_assumed_enrolment'
                        elif code=='WO' and d.weekday()!=6:reason='sunday_code_on_non_sunday'
                        if reason:
                            held.append({'kind':kind,'source_row_id':source_id,'slot':i+1,'reason':reason,'source':{'name':name,'centre':centre,'grade':g,'shift':shift,'date':d.isoformat(),'code':code}});counts['held_observations']+=1;continue
                        accepted.append({'kind':kind,'source_row_id':source_id,'slot':i+1,'student':student,'date':d.isoformat(),'code':code,'id':ident('history-attendance',student['child_id'],d.isoformat()),'sha256':sha})
                        counts['accepted_observations']+=1
                else:
                    d=day(r[6]);year=str(r[0] or '').strip();quarter=str(r[1] or '').strip();reason=None
                    if not student:reason='unresolved_scoped_identity'
                    elif d is None and (year!='2026-27' or quarter not in ('Q1','Q2','Q3','Q4')):reason='missing_observed_assessment_date_and_year'
                    elif quarter not in ('Q1','Q2','Q3','Q4'):reason='unverified_assessment_quarter'
                    else:
                        actual_year=(d.year if d.month>=4 else d.year-1) if d else 2026
                        q=(d.month-4)%12//3+1 if d else int(quarter[1])
                        if actual_year!=2026 or quarter!='Q'+str(q) or (year and year!='2026-27'):reason='assessment_period_conflict'
                    try:
                        score=Decimal(str(r[5]))
                        if not score.is_finite() or not 0<=score<=25:reason=reason or 'score_outside_confirmed_scale'
                    except InvalidOperation:reason=reason or 'missing_or_unsupported_score'
                    if reason:
                        held.append({'kind':kind,'source_row_id':source_id,'slot':6,'reason':reason,'source':[json_value(v) for v in r[:8]]});counts['held_rows']+=1;continue
                    accepted.append({'kind':kind,'source_row_id':source_id,'slot':6,'student':student,'date':d.isoformat() if d else None,'quarter':q,'score':str(score),'id':ident('history-assessment',student['child_id'],2026,q),'sha256':sha});counts['accepted_rows']+=1
        source_files.append(file);summary[kind]=dict(counts)
    # Any conflicting or repeated source claim is withheld, never last-write-wins.
    grouped=collections.defaultdict(list)
    for r in accepted:grouped[(r['kind'],r['id'])].append(r)
    final=[]
    for group in grouped.values():
        if len(group)>1:
            for r in group:
                held.append({'kind':r['kind'],'source_row_id':r['source_row_id'],'slot':r['slot'],'reason':'multiple_source_claims_same_fact'})
                counts=summary[r['kind']];k='accepted_observations' if r['kind']=='attendance' else 'accepted_rows';counts[k]-=1
                k='held_observations' if r['kind']=='attendance' else 'held_rows';counts[k]=counts.get(k,0)+1
        else:final+=group
    for r in final:r['payload_hmac']=row_hash({k:v for k,v in r.items() if k!='student'}|{'child_id':r['student']['child_id']},key)
    return {'files':source_files,'accepted':final,'held':held,'summary':summary}
