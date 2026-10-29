# Two-pass QA and handover

The release is not signed off. An audit can inventory unsupported controls without executing them. Original visuals must stay in place with truthful empty/unknown states; a passing build is not evidence of persistence or correct calculations.

## Completed audit evidence

| Evidence | Result | Boundary |
|---|---|---|
| Managed catalogue and live grouped data | Read-only inspection completed | PostgreSQL17.11; 27 tables/183 columns/35 foreign keys/108 RLS policies; actual counts in README |
| Actual source inventory | 61 page/modal contexts;264 input instances;83 KPI instances captured | Repeated instances normalized into component definitions, not claimed as83 distinct KPIs |
| Numbered charts | All24 accounted | No chart17 exists in original registry |
| Administrative calculation queries |49 exact SELECTs executed | Some deliberately return unavailable/NULL; not all charts validated |
| Existing frontend tests |20 passed plus27 workflow/removal checks | Latest remote integration source61893eb; not hosted Auth/write proof |
| Targeted audit checks |2 pass,7 fail | Pseudonymous administrative-data source replay in isolated Chromium |
| Population matrix |36432 tested,16188 mismatched | Actual frontend population function, not36432 browser renders; other filter dimensions separately assessed |
| Donor narrowing |PASS | Mpokket selection gives15 centre options plus All |
| Mobile navigation |PASS | Smoke only, no comprehensive responsive form signoff |
| Original activity modal |FAIL | activityCatalogue undefined; source-defined fields still inventoried |
| Hosted staff lifecycle / RLS workflows |NOT EXECUTED | No staff credentials impersonated or fabricated |
| Persisted forms / destructive actions |NOT EXECUTED | No production writes authorized in audit |
| Uploaded workbook preservation |PASS |615 original nonempty cells retain values, types, styles, formats and hyperlinks after re-open |
| Shared Google Sheet |NOT UPDATED | No Google Sheets connector available; supplied workbook expanded instead |

Private evidence includes catalogue/function definitions, grouped SQL output, pseudonymous row fixtures, original DOM inventory, current-source page replay, browser results, screenshots, exact failing tuples and test logs. It is kept under `/tmp/mass-gap-audit-20261029` and not published or committed. Existing private sources/import packages are preserved. Screenshots are private evidence, not a public child-record gallery.

## Pass1 — independently reconcile before UI signoff

1. Freeze reviewed application/migration/RPC versions and approved definitions. Re-verify read-only target identity; never run test seeds against production.
2. Re-run the query IDs under the identical period, authorized centre, episode, grade, shift, gender and search population. Compare raw counts before rounding; reconcile grouped totals and distinct people vs observations.
3. Retain P/A/L in the attendance denominator, WO/MM/confirmed holidays out, blanks unknown. Validate completeness against actual authoritative schedule/delivery evidence independently of rate.
4. Exercise synthetic boundaries: first/last/exclusive interval dates; transfer/multiple episodes; NULL gender/shift/history; zero denominator; missing quarter/date; decimal score boundaries; multiple academic years/papers; duplicates and conflicting edits.
5. Validate every proposed write in isolation: success→re-read→audit; wrong role/centre/profile denied; stale revision conflict; rollback/no partial writes; uncertain-network retry; idempotency; historical provenance; record-specific removal/recovery only after approval.
6. Keep source reconciliation units explicit. Correct the two omitted Morarji source rows only under an approved subsequent import operation. Review held observations without silently importing or deleting them.

Exit condition: all supported measures agree with independently computed SQL, all negatives pass, and unresolved rules remain visibly unvalidated. Passing existing tests alone is insufficient.

## Pass2 — browser and persisted evidence

1. Use appropriately isolated synthetic accounts and verified assignments for Leadership, Teacher, CO and no-access identities. Do not create real staff accounts or change production grants for testing.
2. Verify sign-in, sign-out, refresh, expiry, revoked assignment, identity switching and failure cleanup with actual configured storage. Confirm previous records disappear from DOM and memory; actual server permissions govern exports and access.
3. Render each original page/chart/table/modal on desktop/mobile. Preserve original layout. For every unsupported dataset display a meaningful unavailable/coverage state, not zero or fictional labels.
4. Test donor→centre→grade/shift/gender/officer dependencies; invalid resets; immediate updates; month/date boundaries; search and pagination; exam/cohort filters. Validate all visible KPI/table/chart/export scopes against the same query result. Include authorized all-centre scope and API row-limit/pagination failures.
5. Exercise each original action and field contract in the register. Capture intended child/centre/date across navigation. Save, reload and collect the actual persisted record version and audit reference privately. Never accept a toast, local mutation or redirected form as persistence evidence.
6. Test CSV formula safety and least-privilege export shape, keyboard/navigation, loading, empty/error and retry behavior. Check inaccessible cross-centre records through direct authorized API requests as well as UI hiding.
7. Obtain Aashini's original-design review and MASS privacy/operations approval. Publish only minimized aggregate evidence; keep identity/session artifacts private.

Exit condition: every critical row closed with evidence, all tested filter combinations pass, no unsupported browser mutators simulate success, and authorized role isolation is demonstrated end-to-end. Until then: NO-GO for claiming complete frontend integration.

## Next safe handover

Review the18 unresolved decision conditions and43 consolidated gaps in the workbook; preserve already confirmed rules. MASS supplies missing evidence/permissions decisions; engineering then proposes narrowly scoped fixes with isolated tests. This audit does not itself authorize those changes. A Sheet editor can version-backup the shared register and import/review these nine tabs. The workbook contains all existing entries; do not replace older verified findings without retaining their context.
