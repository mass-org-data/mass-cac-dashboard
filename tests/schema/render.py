"""Render implemented schema documentation from an isolated PostgreSQL catalog.
--check verifies the export, SQL checksums and generated docs without changing files.
The export contains metadata only; this program accepts no database URL/credentials.
"""
import argparse,hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('catalog',type=Path);p.add_argument('--check',action='store_true');args=p.parse_args()
snapshot=json.loads(args.catalog.read_text())
snapshot['migrations']=[{'file':str(f.relative_to(ROOT)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in sorted((ROOT/'supabase/migrations').glob('*.sql'))]
assert len(snapshot['migrations'])==17
assert len(snapshot['tables'])==26
assert sum(t['schema']=='mass_foundation' for t in snapshot['tables'])==6
assert sum(t['schema']=='mass_core' for t in snapshot['tables'])==20
assert all(t['rls'] and t['force_rls'] for t in snapshot['tables'])
def qualified(t):return t['schema']+'.'+t['name']
byname={qualified(t):t for t in snapshot['tables']}
def esc(s):return str(s).replace('|','\\|').replace('\n',' ')
def code(s):return '`'+esc(s)+'`'
purposes={
'donors':'Verified donor association directory, not financial funding. Original source label and row/slot provenance are owner-only.',
'staff_members':'Source-backed directory identity only; names are not unique and never establish Auth identity or permissions.',
'centre_staff_assignments':'Verified centre/person/role/nullable shift association; no fabricated validity dates or appointments.',
'source_files':'Immutable source snapshot fingerprint and opaque artifact reference; no filename or source contents.',
'source_sheets':'Immutable sheet occurrence/ordinal and versioned header reference; no raw header JSON or sheet display name.',
'import_batches':'Technical execution state, progress, counts and optimistic revision; not a business-data approval.',
'source_rows':'Immutable physical row occurrence and private fingerprint; not a person identity or raw payload.',
'import_exceptions':'Restricted, allowlisted issue/review metadata; no copied invalid values or free-text personal detail.',
'audit_events':'Append-only minimized operation/revision history; core Auth subject is optional and separately attributed.',
'centres':'Confirmed centre identity/reference; labels are not automatically merged or globally unique.',
'user_scope_grants':'Verified, server-controlled, time-bounded per-centre business role/private-profile grant; no real grants seeded.',
'children':'One explicitly registered person, internal UUID and immutable generated display ID; no name-only matching.',
'private_child_profiles':'Minimal restricted name, controlled gender and nullable Class-10 result projection; no household/contact data.',
'enrolments':'Explicit dated child/centre/grade/shift episode; historical context cannot be overwritten.',
'academic_years':'April 1 academic-year start and generated next-April-1 exclusive end.',
'assessment_periods':'Quarter 1–4 within an explicit academic year; Q/F alias is not inferred.',
'attendance_codes':'Confirmed P/A/L/WO/MM reference definitions; no unapproved H code.',
'cac_sessions':'Explicit confirmed scheduled/non-scheduled calendar entry, not frontend Held/Cancelled delivery status.',
'attendance_records':'One accepted child/centre/shift/day mark tied to a verified episode; no automatic absence.',
'assessment_definitions':'Current-process 25-mark quarter definition; conflicted historical maxima are not accepted here.',
'assessment_results':'One recorded result per child/definition with verified date/context; no routine repeat attempts.',
'activity_events':'Explicit named, dated single-shift event; no invented catalogue/category or historical slot bridge.',
'activity_participation':'One child response per event, including unknown NULL, with matching episode/context.',
'programme_cohorts':'Explicit Morarji cohort reference in the current scope; no inferred year or other programme activation.',
'cohort_memberships':'Unique cohort/child membership with verified centre/shift/episode linkage.',
'morarji_outcomes':'Nullable applied/attended/passed and supplied school text only; no additional outcomes inferred.'}
common={
'donor_id':'Nullable single verified donor association; conflicting or multi-donor centres require review, not overwrite.',
'donor_source_row_id':'Restricted source-row provenance for the first donor association.',
'source_row_id':'Restricted physical source-row FK; no raw record payload or person identity inference.',
'source_slot':'Positive physical source field/slot occurrence used with source row for retry identity.',
'source_label':'Preserved original donor source spelling; owner-only.',
'source_name':'Preserved original staff name spelling; owner-only.',
'display_name':'Reviewed display spelling; no inferred staff merge or Auth account.',
'staff_member_id':'Explicit reviewed directory identity FK, distinct from Supabase Auth.',
'id':'Stable technical UUID.', 'row_version':'Server-managed optimistic revision; RPC expected-version conflicts return PT409/HTTP409.',
'child_id':'Registered child reference; never a name-derived identity.', 'centre_id':'Verified centre scope; not inferred residence.',
'shift_code':'Morning/Evening controlled applicability.', 'enrolment_id':'Verified historical episode; composite FK preserves child/centre/shift context.',
'original_file_id':'Known opaque original identifier only; no invented Drive ID.', 'sha256':'Private immutable file fingerprint, not an identity key.',
'storage_ref':'Opaque artifact UUID; no public/signed URL or embedded credential.', 'source_version':'Known technical source version token.',
'exported_at':'Known source export time only.', 'received_at':'Actual server receipt time, not a fabricated source event.',
'file_id':'Immutable source snapshot FK.', 'native_sheet_id':'Known native sheet token, not automatically a Google ID.', 'ordinal':'Positive physical sheet ordinal.',
'classification':'Technical source classification from the exact CHECK below.', 'header_version':'Positive mapping/header definition version; no raw content.',
'mapping_version':'Reviewed mapping token.', 'extractor_version':'Extractor implementation token.', 'state':'Technical execution state; see exact transition trigger in migration 3.',
'created_at':'Actual server creation time.', 'started_at':'Server time when run enters running; NULL until then.', 'completed_at':'Server terminal-state time.',
'checkpoint_position':'Nonnegative monotonic numeric checkpoint, not arbitrary personal JSON.',
'extracted_count':'Extracted source-occurrence count.', 'accepted_count':'Accepted occurrence category, not a unique-child count or import permission.',
'quarantined_count':'Held occurrence category.', 'excluded_count':'Excluded occurrence category; issue flags may overlap and are separate.',
'sheet_id':'Immutable source sheet occurrence FK.', 'first_batch_id':'First extraction context, not rewritten on retries.',
'row_number':'Positive physical row number in frozen source sheet.', 'content_hash':'Private row fingerprint; equal hashes do not merge people/occurrences.',
'batch_id':'Technical batch association; optional for non-import audit events.', 'source_row_id':'Restricted physical source-row reference, not raw payload or a person identity key.',
'field_ordinal':'Optional positive physical field ordinal; NULL-aware issue uniqueness applies.',
'reason_code':'Allowlisted non-personal issue category.', 'review_state':'Technical open/resolved/rejected state; terminal closure is guarded.',
'resolution_code':'Allowlisted resolution category; no free-text rationale.', 'resolved_by':'Actual database principal (PostgreSQL name), not an asserted Auth user.',
'resolved_at':'Actual server review time.', 'actor_database_principal':'Actual database login/session principal.',
'actor_database_role':'Actual active database role.', 'actor_user_id':'Optional trusted core request Auth UID; no fabricated historical actor.',
'entity_type':'Allowlisted durable audit target type.', 'entity_id':'Durable audit UUID locator; intentionally not a polymorphic business FK.',
'operation':'INSERT/UPDATE only in current audit scope.', 'changed_at':'Actual operation time.',
'change_metadata':'Revision-only JSON object; no personal values, free-text notes or before/after dump.',
'label':'Explicit supplied non-personal reference label; no automatic fuzzy identity.',
'user_id':'Verified managed Auth principal; role labels alone never establish this link.',
'role_code':'Leadership/Teacher/Cluster Officer; server-controlled grant only.',
'starts_at':'Explicit grant validity start.', 'ends_at':'Optional exclusive grant end; no null/global centre scope.',
'verified_by':'Authorized verifier Auth principal reference; no actual person inferred.', 'verified_at':'Explicit verification timestamp; actual evidence/authority required before real use.',
'can_read_profiles':'Explicit additional profile-read capability; Leadership still cannot read profiles.',
'student_id':'Permanent generated uppercase UUID display representation; not a fabricated source/student numbering scheme.',
'full_name':'Minimal private display identity, not an automatic identity key.', 'gender_code':'Girl/Boy/unknown; no invented controlled options.',
'class10_board_passed':'Private Yes/No/unknown projection; live correction/year/history contract still pending.',
'grade_label':'Controlled grade 1–10 for this episode.', 'starts_on':'Explicit verified business start date; no source year/date fill.',
'ends_before':'Exclusive interval end; do not assume frontend exit-date equivalence.',
'status_code':'Active/CAC dropout/Left programme vocabulary; no automatic dropout classification.',
'academic_year_id':'Explicit academic-year FK; unknown historical years are not inferred.', 'quarter':'Quarter 1–4; Apr–Jun/Jul–Sep/Oct–Dec/Jan–Mar.',
'code':'Exact P/A/L/WO/MM status reference.', 'meaning':'Confirmed status meaning.',
'session_date':'Explicit confirmed calendar date.', 'is_scheduled':'Confirmed calendar fact; missing row never proves holiday.',
'confirmation_ref':'Opaque reference to verification evidence; no evidence payload or authority invented.',
'attendance_date':'Explicit distinct, verified day.', 'period_id':'Approved quarter/year definition FK.',
'max_score':'Exactly 25 for current confirmed process; never historical rescaling.', 'definition_id':'Approved current quarter/scale definition FK.',
'assessed_on':'Actual verified date within quarter and episode.', 'score':'Recorded numeric 0..25; zero valid, missing is no accepted result row.',
'activity_date':'Explicit event date; no generated Saturday or historical slot date.', 'name':'Explicit non-personal activity name.',
'event_id':'Explicit event FK; scope/date checked against enrolment.', 'participated':'True/false/NULL; unknown is never automatically false.',
'cohort_id':'Explicit Morarji cohort FK.', 'membership_id':'Verified cohort membership FK.',
'applied':'Nullable supplied indicator; NULL remains unknown.', 'attended':'Nullable supplied indicator; training/exam context is not inferred.',
'passed':'Nullable supplied indicator; no extra outcome/status inferred.', 'school_name':'Supplied school observation only; not inferred admission or award.'}
lines=['# Implemented database data dictionary', '',
'Directory migration 017, 28 October 2026. **26 locally implemented relations: six foundation and 20 core; 17 migrations. Locally verified; 017 not applied to hosted Supabase.**', '',
'This dictionary is generated from PostgreSQL catalog metadata after all 17 committed migrations are applied to an isolated empty database. SQL is authoritative. The machine-readable [inventory](DATABASE-SCHEMA-INVENTORY.json) includes migration SHA-256 checksums, exact columns/defaults/constraints, indexes, policies, triggers, functions and ACL metadata. Reproduce with `bash tests/schema/run-local.sh`.', '',
'The earlier **43-relation proposal** is preserved byte-for-byte in [the Phase 2E dictionary snapshot](DATABASE-PROPOSED-DATA-DICTIONARY-PHASE-2E.md); see [deferred relations](DATABASE-DEFERRED-RELATIONS.md). Historical decision documents retain their original context. This current dictionary makes no claim that every proposal is implemented.', '',
'`auth.users` is an existing managed dependency, not a 27th relation created by these migrations. All 26 local relations enable and force RLS. NULL means unknown/optional, not absent/false/zero. Business dates are explicit dates; timestamptz operation metadata is not a fabricated source date. `PK/FK/UK` below describe exact keys; a composite FK must be read as a whole in its constraint definition. Nullable reports the catalog NOT NULL declaration; generated student_id/year-end values are nevertheless non-null under the current strict expressions over required inputs. No generic shared timestamp/origin columns are implied.', '',
'## Inventory','', '| Relation | Columns | PK | Creation migration |','| --- | --- | --- | --- |']
creation={}
for f in sorted((ROOT/'supabase/migrations').glob('*.sql')):
 for name in re.findall(r'CREATE TABLE\s+(mass_(?:core|foundation)\.\w+)',f.read_text()):creation[name]=f.name
for t in snapshot['tables']:
 pk=next(k['columns'] for k in t['constraints'] if k['type']=='p')
 lines.append(f"| {code(qualified(t))} | {len(t['columns'])} | {code(', '.join(pk))} | {code(creation[qualified(t)])} |")
for t in snapshot['tables']:
 lines+=['',f"## {qualified(t)}",'',purposes[t['name']],'', '| Column | PostgreSQL type | Nullable | Keys | Default / generated expression | Meaning |','| --- | --- | --- | --- | --- | --- |']
 for c in t['columns']:
  keys=[]
  for k in t['constraints']:
   if c['name'] in (k['columns'] or []):
    if k['type']=='p':keys.append('PK')
    elif k['type']=='f':keys.append('FK')
    elif k['type']=='u':keys.append('UK' if len(k['columns'])==1 else 'composite UK')
  meaning=common[c['name']]
  if t['name']=='academic_years' and c['name']=='starts_on':meaning='Explicit April 1 for a verified academic year.'
  if t['name']=='academic_years' and c['name']=='ends_before':meaning='Generated next April 1; inclusive business end is March 31.'
  default=c['default'];expr=('GENERATED ALWAYS STORED: ' if c['generated'] else '')+(default or 'none')
  lines.append('| '+' | '.join([code(c['name']),code(c['type']),'yes' if c['nullable'] else 'no',', '.join(dict.fromkeys(keys)) or '—',code(expr),esc(meaning)])+' |')
 lines+=['','Exact final constraints (including composite FK columns/actions and CHECKs):','', '```sql']+[k['name']+': '+k['definition'] for k in t['constraints']]+['```','',f"RLS enabled: **{t['rls']}**; forced: **{t['force_rls']}**. Access and trigger enforcement are in [implemented security](DATABASE-SECURITY-IMPLEMENTED.md)."]
lines+=['','## Important implementation boundaries','',
'Current-process scalar corrections retain attributable revision metadata, not a recoverable business-value archive. Profile corrections, general clears/deletes, bulk/offline workflows, historical provenance promotion, friendly-ID aliases and deferred modules require follow-up contracts. Exit-date mapping, calendar authority/H, Q/F aliases, assessment precision and historical ambiguities remain unresolved to their recorded extent. See [Phase 3C deployment gates](PHASE-3C-DEPLOYMENT-READINESS.md). No personal record, retention duration, real grant or historical source correction is approved by this catalog.','']
dictionary='\n'.join(lines)
# Split ERDs preserve complete columns for each owning domain and explicit referenced-key stubs.
groups=[('Foundation and managed Auth',[t for t in snapshot['tables'] if t['schema']=='mass_foundation']),
 ('Core identity, access and academic references',[byname['mass_core.'+n] for n in ['centres','user_scope_grants','children','private_child_profiles','enrolments','academic_years','assessment_periods']]),
 ('Attendance, assessments, activities and Morarji',[t for t in snapshot['tables'] if t['schema']=='mass_core' and t['name'] not in ['centres','user_scope_grants','children','private_child_profiles','enrolments','academic_years','assessment_periods']])]
def eid(name):return name.replace('.','_')
erd=['# Implemented entity–relationship diagrams','',
'Directory migration 017, 28 October 2026. **26 local relations, 17 migrations, 017 not hosted-applied.** Generated from the same isolated PostgreSQL catalog as the [dictionary](DATABASE-DATA-DICTIONARY.md) and [machine inventory](DATABASE-SCHEMA-INVENTORY.json). Earlier proposed ERDs remain in [the preserved Phase 2E snapshot](DATABASE-PROPOSED-ERD-PHASE-2E.md).','',
'Entity IDs use `mass_core_` / `mass_foundation_` instead of schema dots for Mermaid compatibility. Every column of each owning-domain relation is shown once; referenced parents repeat as key-only stubs. `auth_users` is the existing managed `auth.users` dependency, not a created table. Optional parent associations reflect FK nullability; child zero-or-one reflects FK columns containing a UNIQUE/PK. Composite keys/NULL behavior and runtime temporal checks are specified by the dictionary and migrations.','']
for title,tables in groups:
 own={qualified(t) for t in tables};stubs={};edges=[]
 for t in tables:
  for k in t['constraints']:
   if k['type']!='f':continue
   parent=k['ref_schema']+'.'+k['ref_table'];cols=k['columns'];optional=any(c['nullable'] for c in t['columns'] if c['name'] in cols)
   unique=any(q['type'] in ['p','u'] and set(q['columns']).issubset(set(cols)) for q in t['constraints'])
   edges.append(f'    {eid(parent)} '+('|o' if optional else '||')+'--'+('o|' if unique else 'o{')+f' {eid(qualified(t))} : "'+', '.join(cols)+'"')
   if parent not in own:
    for col in k['ref_columns']:
     typ=next((c['type'] for c in byname.get(parent,{}).get('columns',[]) if c['name']==col),'uuid')
     stubs.setdefault(parent,{})[col]=typ
 erd+=['## '+title,'','```mermaid','erDiagram']
 for t in tables:
  erd+=['    '+eid(qualified(t))+' {']
  for c in t['columns']:
   keys=[]
   for k in t['constraints']:
    if c['name'] in (k['columns'] or []):
     if k['type']=='p':keys.append('PK')
     elif k['type']=='f':keys.append('FK')
     elif k['type']=='u' and len(k['columns'])==1:keys.append('UK')
   suffix=' '+','.join(dict.fromkeys(keys)) if keys else ''
   erd.append('        '+c['type'].replace(' ','_')+' '+c['name']+suffix)
  erd+=['    }']
 for name,cols in sorted(stubs.items()):
  erd+=['    '+eid(name)+' {']+['        '+typ.replace(' ','_')+' '+col for col,typ in cols.items()]+['    }']
 erd+=edges+['```','']
erd+=['## Relationships that are deliberately absent','',
'No person/name join, polymorphic audit business FK, historical source-slot/event bridge, automatic year/quarter alias or derived staff/funder relationship is implied. Audit entity_id is a durable locator, while actor_user_id and batch_id are real FKs. New directory relations are locally implemented, not asserted deployed. No unimplemented proposed relation is drawn as deployed. All actual FK edges, including Auth and composite contextual keys, appear above.','']
# Full effective policy expressions and grants: evidence, not invented role permissions.
security=['# Implemented database security and RLS','',
'Directory migration 017, 28 October 2026. Generated policy/ACL evidence from the isolated local schema, not hosted Supabase certification. Read with [the core handover](PHASE-3B-CORE-HANDOVER.md) and [deployment gates](PHASE-3C-DEPLOYMENT-READINESS.md). No real users/scopes are provisioned.','',
'## Access boundary','',
'- All 26 relations enable and force RLS. Private schemas are mass_foundation and mass_core; mass_api contains curated functions and no tables. The local API exposes only mass_api; actual hosted exposure must be reviewed before any apply/enablement.',
'- Leadership has programme reads only within explicit valid grants and no business writes. Teachers and Cluster Officers need verified centre scopes; explicit can_read_profiles is additional and still excludes Leadership. No null/global centre or browser role claim grants access.',
'- Authenticated direct mutations are not granted. Typed definer RPCs enforce scope and optimistic revisions; centred owner write policies add scope enforcement. Scoped invoker read projections preserve RLS and private-field filtering.',
'- Technical foundation roles and core admin/owner are NOLOGIN and NOBYPASSRLS. Only the trusted deployment principal receives explicit SET/INHERIT owner memberships; no application-role owner memberships or actual staff scope rows are installed. Actor UID is trusted only behind a real validated Auth issuer/gateway; test stubs do not certify managed Auth.',
'- Managed Auth privileges are not delegated to owner roles. The deployment principal installs auth.users foreign keys using its own direct REFERENCES rights. The private request_user_id wrapper is SECURITY INVOKER with a SQL-standard body bound to managed auth.uid(); runtime EXECUTE is still enforced. No manual JWT parser or new SECURITY DEFINER is introduced.',
'- Runtime audit is append-only minimized revision metadata, atomic with writes; DB administrator tampering and generic runtime/error logging are separate operational controls. No PII-rich before/after payload, retention duration or end-user exception-review API is introduced.', '',
'## Technical roles','', '| Role | Login | Superuser | Bypass RLS | Create role |','| --- | --- | --- | --- | --- |']
for role in snapshot['roles']:security.append('| '+' | '.join([code(role['name'])]+[str(role[k]) for k in ['login','superuser','bypass_rls','create_role']])+' |')
security+=['','## Exact RLS policies','',
'Commands: r SELECT, a INSERT, w UPDATE, * ALL. Multiple applicable permissive policies combine with OR; owner helper read policies are intentional and are not grants to application users. Table/column ACLs also apply. Every expression below comes from pg_policy.','']
for t in snapshot['tables']:
 security+=['### '+qualified(t),'','| Policy | Command | Roles | USING | WITH CHECK |','| --- | --- | --- | --- | --- |']
 for policy in t['policies']:security.append('| '+' | '.join([code(policy['name']),policy['command'],code(', '.join(policy['roles'])),code(policy['using'] or 'none'),code(policy['check'] or 'none')])+' |')
 security+=['', 'Table ACL: '+code(t['acl'] or 'PostgreSQL owner/default ACL')+'.','']
 for c in t['columns']:
  if c['acl']:security+=['Column ACL '+code(c['name'])+': '+code(c['acl'])+'.','']
security+=['## Function boundary','', '| Function / identity arguments | Returns | Definer | Settings | ACL |','| --- | --- | --- | --- | --- |']
for f in snapshot['functions']:security.append('| '+' | '.join([code(f['schema']+'.'+f['name']+'('+f['arguments']+')'),code(f['returns']),str(f['security_definer']),code(', '.join(f['settings'] or [])),code(f['acl'] or 'PostgreSQL defaults')])+' |')
security+=['','ACL notation: r SELECT, a INSERT, w UPDATE, d DELETE, D TRUNCATE, x REFERENCES, t TRIGGER, X EXECUTE. PostgreSQL owner rights and role inheritance must also be reviewed; NULL ACL text is not proof of no rights. Foundation helpers use explicit PUBLIC EXECUTE revokes (a schema-local default revoke alone does not remove global function defaults). Core-owner global function defaults revoke PUBLIC EXECUTE. Check effective privileges on the real target, including service_role inheritance and grant options.','',
'Exact constraints, trigger definitions, indexes and default ACLs are retained in DATABASE-SCHEMA-INVENTORY.json; their executable implementation is the 17 migrations. The existing 207 tests exercise allowed/denied roles, forced RLS, invalid signatures, centre isolation, profile masking, immutable metadata, transactional audit and expected-version conflicts. Actual managed Auth sessions and hosted migration-role/ownership grants remain unverified.','']
outputs={ROOT/'docs/DATABASE-DATA-DICTIONARY.md':dictionary,ROOT/'docs/DATABASE-ERD.md':'\n'.join(erd),ROOT/'docs/DATABASE-SECURITY-IMPLEMENTED.md':'\n'.join(security),ROOT/'docs/DATABASE-SCHEMA-INVENTORY.json':json.dumps(snapshot,indent=2,sort_keys=True)+'\n'}
for path,text in outputs.items():
 if args.check:
  if path.suffix=='.json':
   old=json.loads(path.read_text());current=json.loads(text);old.pop('server_version',None);current.pop('server_version',None);assert old==current,path
  else:assert path.read_text()==text,path
 else:path.write_text(text)
print(('Verified' if args.check else 'Rendered')+': 26 tables, every column/key/constraint/FK, all policies, ERDs and 17 migration checksums against isolated catalog.')
