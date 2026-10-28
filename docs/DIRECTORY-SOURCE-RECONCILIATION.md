# CAC donor/staff source reconciliation — access blocker and offline procedure

28 October 2026 (India). Requested source: *All CAC's Information*, spreadsheet ID `1aGRxIHJxXJFRRSitY7vZpgBbekBTO-V-jVl9wHnfS3Y`. A read-only XLSX export request failed at the network tunnel with **403 Forbidden**. No Google Drive/Sheets connector is callable in this environment. No workbook bytes or real source rows were obtained, audited, normalized, imported or committed. The local checkout initially lacked proposed 017; the final remote check found commit `7557ba6c8c82e95abe4cce9af6cb6ac827091fe0`. This same branch was fast-forwarded and its proposal preserved unchanged. The finalized migration reconciles that draft with the current source-provenance/security authorization; see the handoff for exact differences.

## Actual mapping summary

| Requested worksheet | Real rows verified | Donor/centre/teacher/officer/shift mapping |
| --- | --- | --- |
| Mpokket | Unavailable | Not verified |
| Fanuc | Unavailable | Not verified |
| McAfee | Unavailable | Not verified |
| Janashkati Foundation | Unavailable | Not verified; Masaraguppi classification unresolved |
| Dasar UK | Unavailable | Not verified |

These are the user-specified worksheet names, **not verified donor identities, counts or centre assignments**. No sample frontend mapping was promoted into live data. Whether one donor_id accurately covers every real centre remains unproven. Matching village names across donors/regions may mean different centres or a conflicting/multiple-donor association; either requires explicit review. Masaraguppi's actual occurrences, exact regional labels and staff relationships cannot be asserted without the workbook.

## Implemented offline reconciliation

`scripts/directory/reconcile.py` reads a locally supplied XLSX with an explicit, privately stored header mapping for all five sheets. It never opens a database or generates executable import SQL. Install `requirements-dev.txt` in a private virtual environment. Run only after an authorized administrator exports the workbook privately:

```sh
python scripts/directory/reconcile.py \
  --workbook /PRIVATE/PATH/source.xlsx \
  --mapping /PRIVATE/PATH/verified-header-map.json \
  --out /PRIVATE/PATH/review-output
```

Replace placeholders with private paths **outside the checkout**. The tool rejects repository output, creates a mode-0700 directory and a mode-0600 `directory-review.private.json`, refuses to overwrite it, and prints counts only. Do not copy the workbook, mapping or review output into source/archive inputs, GitHub or application logs. Delete/retain private artifacts only under separately approved retention rules.

The mapping JSON is keyed by the five exact worksheet titles. Each entry requires:

- `header_row`: verified one-based physical row number.
- `columns`: explicit Excel letters for centre, teacher, officer, shift; optionally region and donor. Do not guess column positions from this document.
- `verified_headers`: exact normalized header strings for each mapped field. Header drift fails closed.
- `verified_donor_label`: source-backed, explicitly reviewed donor label if no donor column exists. A sheet title alone never establishes a donor identity.

Output retains workbook SHA-256, actual worksheet title/ordinal, physical row, mapped source columns, original selected cell strings, normalized display candidates and issue codes. Original files/values remain in the private review artifact; foundation tables store only minimized identifiers/fingerprints/references. NFKC/whitespace normalization is applied; case-folding is used only for candidate comparisons. No fuzzy spelling correction, staff/village identity merge, guessed dates, automatic staff splitting or Auth assignment is performed.

Flags include missing centre/donor, unverified shift, formula/cached-value uncertainty, possible multiple staff in a cell, duplicate physical-content rows, repeated centre/staff identity candidates, possible multiple donors and region collisions. Repeated Masaraguppi candidates are explicitly flagged. An unflagged row still requires reviewed canonical IDs; **no result is automatically approved for import**.

## Required private review and later import gates

1. Supply an authorized XLSX export (or restore authorized connector access) and verify all five worksheet/header mappings. Run the tool privately; review all nonempty rows, subtotal/template/formula/multi-person cases and reconciliation totals.
2. Resolve source-backed donor identities and village/CAC centre grain with MASS. Confirm Masaraguppi's actual regional classifications and whether occurrences refer to separate centres. Do not attach two donors to one centre or overwrite an association to force the simplified model. If verified genuine multi-donor centres exist, stop those records and request a separately approved model exception; no centre_funding table is implemented.
3. Review staff identities explicitly. Names are candidate signals only; separate same-named people remain separate technical IDs until verified. Directory UUIDs are not invented real-world identities or Auth accounts. Do not grant login/centre access based on directory membership. Confirm source role and each shift; NULL means not documented, not Both. No appointment/centre-start/effective dates are inferred.
4. Freeze the source snapshot and approved mapping version. Preserve worksheet/row/field references privately and stage minimized foundation identifiers using the existing restricted ingestion process. Record ambiguous rows in restricted exceptions with allowlisted issue metadata, not copied staff names/free text. Retain aggregate accepted/excluded/quarantined counts without pretending they are verified person counts.
5. Under **separate import authorization**, use a transaction and explicit reviewed canonical ID/foreign-key mappings. On retry, compare every stored source/identity/association value before skipping an already accepted row; a mismatch is an exception, never an ON CONFLICT overwrite or silent discard. Uniqueness on physical source row/slot prevents repeated inserts; a new workbook version is not automatically the same entity.
6. Verify counts/joins/role/shift lists privately, maintain unresolved exceptions, and activate frontend directory data only after a separately approved release. No real import script was executed or real rows staged in this phase.

Synthetic workbook tests exercise normalization/provenance, duplicate and Masaraguppi/region/multi-donor candidates, deterministic retries and fail-closed mappings. These are not findings about the inaccessible real workbook.
