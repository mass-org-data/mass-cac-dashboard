# Chart and KPI calculation specification

All original chart/KPI rows reference the query IDs below. Exact SQL is in [CALCULATION-QUERIES.sql](CALCULATION-QUERIES.sql). Unsupported measures intentionally return NULL plus an unavailable reason; these diagnostics are not fabricated calculations. Programme queries are read-only administrative checks; application requests must retain authorized centre scope and use approved RPCs, not expose private tables. October2026 is an explicit audit scope, not a rolling dashboard default.

## C001: Unique enrolled students

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: Distinct active child UUIDs
- Denominator: Not a rate
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": 1458}]
- Decision: No new rule approved by this audit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C002: Recorded attendance percentage

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: P marks
- Denominator: P+A+L marks; missing/WO/MM excluded
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": 77.2027373823781}]
- Decision: No new rule approved by this audit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C003: Recorded P marks

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: P marks
- Denominator: Not a rate
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": 5415}]
- Decision: No new rule approved by this audit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C004: Recorded A marks

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: A marks
- Denominator: Not a rate
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": 1308}]
- Decision: No new rule approved by this audit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C005: Recorded L marks

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: L marks
- Denominator: Not a rate
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": 291}]
- Decision: No new rule approved by this audit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C006: Recorded WO marks

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: WO marks
- Denominator: Not a rate
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": 1012}]
- Decision: No new rule approved by this audit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C007: Recorded MM marks

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: MM marks
- Denominator: Not a rate
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": 108}]
- Decision: No new rule approved by this audit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C008: Enrolled students by centre

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: Distinct child UUIDs
- Denominator: Not a rate
- Group / period: centre / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: 92 centre rows; see private calculation results
- Decision: No new rule approved by this audit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C009: Enrolled students by grade

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: Distinct child UUIDs
- Denominator: Not a rate
- Group / period: grade / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": 99, "dimension": "1"}, {"value": 45, "dimension": "10"}, {"value": 189, "dimension": "2"}, {"value": 176, "dimension": "3"}, {"value": 222, "dimension": "4"}, {"value": 226, "dimension": "5"}, {"value": 176, "dimension": "6"}, {"value": 134, "dimension": "7"}, {"value": 112, "dimension": "8"}, {"value": 79, "dimension": "9"}]
- Decision: No new rule approved by this audit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C010: Enrolled students by gender

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: Distinct child UUIDs by source-backed gender
- Denominator: All eligible distinct children, including unknown gender
- Group / period: gender / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": 589, "dimension": "Boy"}, {"value": 869, "dimension": "Girl"}]
- Decision: Leadership cannot read profile gender through the current RPC; a separately authorized aggregate demographic read is needed without broad profile grants.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C011: Recorded attendance percentage by centre

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: P marks per centre
- Denominator: P+A+L per centre
- Group / period: centre / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: 92 centre rows; see private calculation results
- Decision: No new rule approved by this audit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C012: Low-attendance children

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "No complete authoritative expected-day/held-session population; observed dates alone do not establish completeness."}]
- Decision: No complete authoritative expected-day/held-session population; observed dates alone do not establish completeness.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C013: Unmarked attendance entries

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Need authorized expected child-session calendar and verified held status; observed-centre dates cannot prove missing days."}]
- Decision: Need authorized expected child-session calendar and verified held status; observed-centre dates cannot prove missing days.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C014: Monthly CAC dropout

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "No recorded delivery calendar; P/A/L/WO/MM completeness and the original H convention need reconciliation. No dropout rate denominator is approved."}]
- Decision: No recorded delivery calendar; P/A/L/WO/MM completeness and the original H convention need reconciliation. No dropout rate denominator is approved.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C015: Good-engagement students

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "No named held/category-approved activity coverage; absence of events is unknown, not zero participation."}]
- Decision: No named held/category-approved activity coverage; absence of events is unknown, not zero participation.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C016: Engagement distribution by centre

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Good/review/low/incomplete definitions depend on complete attendance and approved activity eligibility."}]
- Decision: Good/review/low/incomplete definitions depend on complete attendance and approved activity eligibility.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C017: Attendance bands

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Thresholds count present days, but eligibility requires an approved completeness/calendar rule."}]
- Decision: Thresholds count present days, but eligibility requires an approved completeness/calendar rule.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C018: Held/planned/cancelled CAC sessions

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "is_scheduled is not delivery status; no observed held/planned/cancelled delivery dataset/API exists."}]
- Decision: is_scheduled is not delivery status; no observed held/planned/cancelled delivery dataset/API exists.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C019: Activity held/planned totals

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Named event table lacks delivery status; historical monthly responses cannot supply exact event names/dates."}]
- Decision: Named event table lacks delivery status; historical monthly responses cannot supply exact event names/dates.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C020: Students participating in 2+ activities

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Current category/delivery eligibility cannot be established; monthly response slots are preserved separately."}]
- Decision: Current category/delivery eligibility cannot be established; monthly response slots are preserved separately.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C021: Missing activity records

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Need eligible child-event opportunities and known held events; zero event rows cannot prove complete participation."}]
- Decision: Need eligible child-event opportunities and known held events; zero event rows cannot prove complete participation.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C022: Activity participation distribution

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Need named dated event identity and approved eligible categories/status; no invented Saturday events."}]
- Decision: Need named dated event identity and approved eligible categories/status; no invented Saturday events.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C023: Participation by centre

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Need scoped verified child-event records and event eligibility, not monthly slot-name inference."}]
- Decision: Need scoped verified child-event records and event eligibility, not monthly slot-name inference.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C024: School-performance comparison

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "No school-report dataset, schema, scales, comparability or matched baseline is supplied."}]
- Decision: No school-report dataset, schema, scales, comparability or matched baseline is supplied.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C025: Completed officer visits

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Source visit logs exist but are not reconciled/imported; visit operational relation and API are absent."}]
- Decision: Source visit logs exist but are not reconciled/imported; visit operational relation and API are absent.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C026: Morning officer visits

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Need verified dated officer-centre-shift visits and applicable assignments."}]
- Decision: Need verified dated officer-centre-shift visits and applicable assignments.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C027: Evening officer visits

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Need verified dated officer-centre-shift visits and applicable assignments."}]
- Decision: Need verified dated officer-centre-shift visits and applicable assignments.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C028: Centres meeting visit target

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Target four/two-per-shift is a prototype expectation requiring source-backed approval and validity dates."}]
- Decision: Target four/two-per-shift is a prototype expectation requiring source-backed approval and validity dates.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C029: Visits by officer

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "No operational visit relation/API; staff directory alone is not a visit."}]
- Decision: No operational visit relation/API; staff directory alone is not a visit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C030: Visit centre coverage

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "No verified monthly visit observations or approved target policy in the backend."}]
- Decision: No verified monthly visit observations or approved target policy in the backend.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C031: Morarji year-on-year pass counts

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "548 source rows lack approved centre/grade identity/cohort linkage; outcome API exists, but review adapter ignores returned Morarji rows."}]
- Decision: 548 source rows lack approved centre/grade identity/cohort linkage; outcome API exists, but review adapter ignores returned Morarji rows.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C032: Morarji cohort/training/exam/pending comparison

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "No imported cohort/membership/outcome rows; pending is not implied by a nullable passed flag."}]
- Decision: No imported cohort/membership/outcome rows; pending is not implied by a nullable passed flag.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C033: Morarji selection/admission/scholarship outcomes

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Only applied/attended/passed/school fields are approved; selection/admission/scholarship source and schema require separate approval."}]
- Decision: Only applied/attended/passed/school fields are approved; selection/admission/scholarship source and schema require separate approval.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C034: Career guidance participants

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "No source-backed session/cohort/participant dataset or operational module supplied."}]
- Decision: No source-backed session/cohort/participant dataset or operational module supplied.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C035: Guidance participants contacted

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "No source-backed follow-up contacts; do not invent contact outcomes."}]
- Decision: No source-backed follow-up contacts; do not invent contact outcomes.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C036: Guidance destinations recorded

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "No verified destination observation or source; unknown is not a successful transition."}]
- Decision: No verified destination observation or source; unknown is not a successful transition.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C037: Guidance verified admissions

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Needs explicit evidence reference, verification identity/date and approved restricted handling."}]
- Decision: Needs explicit evidence reference, verification identity/date and approved restricted handling.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C038: Guidance subject/course chosen

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Original controlled choices are demonstrative; actual programme catalogue and destination observations are not supplied."}]
- Decision: Original controlled choices are demonstrative; actual programme catalogue and destination observations are not supplied.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C039: Matched-round average score improvement

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Require matched child UUID, explicit year/quarter mapping, comparable papers and equal approved scales; NULL/zero baseline handling differs from unmatched round averages."}]
- Decision: Require matched child UUID, explicit year/quarter mapping, comparable papers and equal approved scales; NULL/zero baseline handling differs from unmatched round averages.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C040: Matched-round improved/unchanged/declined

Status: NOT_VALIDATED.

- Numerator: Not established
- Denominator: Not established
- Group / period: programme / October 2026 / as of 29 October
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": null, "unavailable_reason": "Need approved F-to-quarter/year mapping and comparable papers; never treat missing scores as unchanged."}]
- Decision: Need approved F-to-quarter/year mapping and comparable papers; never treat missing scores as unchanged.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C041: Quarter 2 scored students

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: Distinct eligible children with recorded results
- Denominator: Eligible children in the selected year/quarter
- Group / period: programme / FY 2026–27 Q2
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": 206}]
- Decision: No new rule approved by this audit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C042: Quarter 2 mean score

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: Sum of recorded quarter-2 scores
- Denominator: Number of recorded quarter-2 scores
- Group / period: programme / FY 2026–27 Q2
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": 21.796116504854368}]
- Decision: No new rule approved by this audit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C043: Quarter 2 eligible students without a score

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: Eligible students with no quarter-2 result
- Denominator: Not an absent-exam count
- Group / period: programme / FY 2026–27 Q2
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": 1252}]
- Decision: Eligibility must be evaluated by the assessment period, not simply today; all current imported enrolments cover this FY.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C044: Quarter 2 scores above 20

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: Distinct scored children above 20/25
- Denominator: Not a rate
- Group / period: programme / FY 2026–27 Q2
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": 144}]
- Decision: No new rule approved by this audit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C045: Quarter 2 score distribution

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: Recorded scores in approved/labelled interval
- Denominator: Eligible children/result coverage, explicitly distinguished
- Group / period: band / FY 2026–27 Q2
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": 56, "dimension": "16–20"}, {"value": 144, "dimension": "21–25"}, {"value": 6, "dimension": "9–15"}]
- Decision: The integer-labelled 9/16/21 lower bounds leave decimal gaps in original JS; precision/band semantics require approval.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C046: Quarter 2 means by centre

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: Recorded score sum per centre
- Denominator: Result count per centre
- Group / period: centre / FY 2026–27 Q2
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: 11 centre rows; see private calculation results
- Decision: No new rule approved by this audit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C047: Quarter means and coverage

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: Recorded scores per explicit academic-year quarter
- Denominator: Recorded result count, not a matched longitudinal denominator
- Group / period: quarter / FY 2026–27
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"value": 24, "dimension": 1, "result_count": 1}, {"value": 21.796116504854368, "dimension": 2, "result_count": 206}]
- Decision: No new rule approved by this audit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C048: Morarji recorded applied/attended/passed

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: Recorded TRUE flags only
- Denominator: Recorded memberships/cohort as explicitly selected
- Group / period: programme / Verified cohort
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"passed": 0, "applied": 0, "attended": 0, "source_outcome_rows": 0}]
- Decision: Zero operational rows is not evidence that no children applied or passed; all 548 source observations remain held.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## C049: Attendance by month

Status: SQL_ONLY_NOT_HOSTED_UI.

- Numerator: P marks
- Denominator: P+A+L recorded marks
- Group / period: month / All imported months
- Eligibility / inclusions: Verified dated enrolments in the selected authorized centre scope; current audit covers all 92 centres administratively. Source import is incomplete. Only source-backed records matching historical enrolment context. No real-world zero inferred from absent datasets.
- Unknowns: NULL/absence remains unknown; unrecorded observations are never absent or zero.
- Uniqueness: Use child UUID for distinct people; fact UUID/context keys and original enrolment_id for history.
- Joins: Enrolment→child/centre→donor; facts→exact enrolment; assessments→definition→quarter→academic year. Centre/staff assignment valid-time and donor history remain limited.
- SQL result: [{"a": 2075, "l": 80, "p": 9795, "mm": 279, "wo": 1811, "marks": 14040, "value": 81.96652719665272, "dimension": "2026-07"}, {"a": 2161, "l": 124, "p": 8529, "mm": 352, "wo": 1798, "marks": 12964, "value": 78.8699833549103, "dimension": "2026-08"}, {"a": 2172, "l": 113, "p": 8324, "mm": 302, "wo": 1274, "marks": 12185, "value": 78.46168347629371, "dimension": "2026-09"}, {"a": 1308, "l": 291, "p": 5415, "mm": 108, "wo": 1012, "marks": 8134, "value": 77.2027373823781, "dimension": "2026-10"}]
- Decision: No new rule approved by this audit.

Frontend comparisons and original page/series are recorded separately in CHART AUDIT. SQL-only status is not a frontend pass.

## Independently reconciled attendance results

| Month2026 | P | A | L | WO | MM | P/(P+A+L) | Review rounded |
|---|---:|---:|---:|---:|---:|---:|---:|
| July |9795|2075|80|1811|279|81.966527%|82.0%|
| August |8529|2161|124|1798|352|78.869983%|78.9%|
| September |8324|2172|113|1274|302|78.461683%|78.5%|
| October |5415|1308|291|1012|108|77.202737%|77.2%|

These are recorded-mark rates over incomplete imported coverage, not proof of programme-wide session completeness. WO/MM and blank/unknown observations are excluded; L remains in the denominator. Other confirmed holidays require actual calendar authority. No automatic absence is permitted.

Q2 has206 scores, mean21.796116504854/25, observed on2026-09-28. Q1 has one score24/25, documented quarter but NULL exact date. The current dated read omits Q1. Q3/Q4 are unconfigured, not zero-score rounds. Original score bins have decimal gaps; use the decision register before interpreting decimals or improvement across different papers.
