# Cluster Officer source → database → frontend reconciliation

Rechecked 29 October 2026 using private original workbooks and authorized read-only hosted SQL. No source contents or names are reproduced. A keyword/coordinate sweep identifies structural candidates, not officer identities or authentic events.

|Workbook|Worksheets checked|Officer-labelled sheets|Visit-labelled sheets|Interpretation|
|---|---:|---:|---:|---|
|Cluster_Officer_Visit_Sheet (1).xlsx|14|14|14|Visit logs and formula-based monthly summaries; detailed review below|
|Morarji Training.xlsx|5|0|0|No explicit officer/visit-labelled fields found; no visit inference from student attendance, assessments, activities or Morarji data|
|MASS-2026-27-student-import-staging.xlsx|1|0|0|No explicit officer/visit-labelled fields found; no visit inference from student attendance, assessments, activities or Morarji data|
|Mass_MPokket_Attendance2026-27.xlsx|19|0|0|No explicit officer/visit-labelled fields found; no visit inference from student attendance, assessments, activities or Morarji data|
|All CAC_s Information_.xlsx|5|5|0|Source directory officer/centre observations; not visit events|
|Center_Assessment_Score_Entry (1).xlsx|8|0|0|No explicit officer/visit-labelled fields found; no visit inference from student attendance, assessments, activities or Morarji data|
|Monthly activity.xlsx|5|0|0|No explicit officer/visit-labelled fields found; no visit inference from student attendance, assessments, activities or Morarji data|
|SVP_ChildListUpdate.xlsx|2|0|0|No explicit officer/visit-labelled fields found; no visit inference from student attendance, assessments, activities or Morarji data|

## Exact visit source layout

File: `Cluster_Officer_Visit_Sheet (1).xlsx`. SHA-256: `4fa39ef486f37033fa331d2fa873c1dabf415b463a8c25cd73d8c4cb4555eb12`.

Seven Visit Log sheets have row6 headers: A=Visit Date, B=Center Name, C=Shift, D=Remarks, E=Month (auto). Row7 is explicitly labelled as an example; its date is not a historical observation. Input begins at physical row8. Formula-only scaffolding is excluded. Exact whitespace in worksheet names is preserved.

|Exact sheet name|Non-example rows|Morning observations|Evening observations|Verified dated events|
|---|---:|---:|---:|---:|
|`Mpokket - Visit Log`|28|14|14|0|
|`Mpokket-Visit Log`|32|16|16|0|
|`Fanuc-Visit Log`|32|8|24|0|
|`Fanuc - Visit Log`|28|10|18|0|
|`McAfee-Visit Log`|28|14|14|0|
|`McAfee - Visit Log`|32|16|16|0|
|`Dasar UK- Visit Log`|20|0|20|0|

Total: **200 non-example rows, all undated;78 Morning / 122 Evening observations;7 dated examples excluded**. The count is source rows, not people or completed visits. Remarks repeat template-like patterns; no dated event authenticity is established. No per-row officer identity or follow-up column exists. Officer labels/metadata are not verified Auth-to-person links. No missing date, officer or shift is inferred.

The seven Monthly Summary sheets have row7 A=Center Name (enter this officer's centers), B=Morning Visits, C=Evening Visits, D=Total Visits, E=Status. Formula/cached totals and header month are template/report metadata, not proof of individual dated visits. They must not be summed into a historical completion KPI or used to manufacture events. The approved current target policy comes from MASS instructions:2 Morning + 2 Evening per applicable centre/month. A theoretical 92-centre month is 368; applicability and assignments must be verified. Four Morning/zero Evening does not meet both shift targets.

## Hosted reconciliation

Read-only production inspection found **no cluster_officer_visits or officer_assignments table**, and no source_files/source_rows registration for the exact visit-workbook checksum. Consequently no original visit events are displayed in the current production application. Migrations020–023 remain unapplied. The directory has93 Cluster Officer centre-assignment records; these are directory observations, not93 officers, visit events or runtime officer links. Existing runtime scopes remain unchanged.

The private workbook and row numbers remain available for adjudication; none of the200 rows was imported as a completed event. Source correction must supply verified date, actual officer identity/link, canonical centre, observed shift and authenticity. Historical summary-only observations would need an approved separate representation before display; they are not inserted into the new event table.

## Frontend and operational implementation

Migration021 provides verified dated officer links, scoped visit entry/corrections, idempotent request IDs, optimistic concurrency, restricted revision snapshots and aggregate counts. Monthly trends use the same scoped monthly summary RPC with bounded concurrency and explicit load/refresh; they do not query private tables or turn absent coverage into zero. Targets, planned records and completed counts remain distinct. Public anonymous views show Access approval pending; sensitive feedback/history never has an anonymous path.

Reproduce the structural check privately: `python scripts/audits/officer_sources.py /private/visit-workbook.xlsx --output /private/officer-reconciliation.json`. The output is forced outside the checkout, mode0600, and emits coordinates/counts rather than officer names or remarks. Keep source-derived detailed coordinates private. The seven other workbooks were checked for officer/visit fields using the same private coordinate inventory.
