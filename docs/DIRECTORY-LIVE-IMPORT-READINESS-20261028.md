# MASS directory import readiness — 2026-10-28

## Live verification
- Supabase project: `pbkwpfdpdtelmvbkzgvx`
- Migration 017 installed; 26 tables, 22 mass_api functions, 78 RLS policies.
- Read-only row counts: `mass_foundation.source_files` 0, `source_sheets` 0, `source_rows` 0; `mass_core.centres` 0, `donors` 0, `staff_members` 0, `centre_staff_assignments` 0.
- Vercel project `mass-cac-dashboard`: connected environment-variable listing returned zero configured variables. This prevents testing authenticated live preview until configured.
- Latest frontend GitHub commit: `a49e2a31dc2f02a780d6b73aaa4cde28ef6a8564`, branch `feature/supabase-frontend`. The associated Vercel auto-deployment was canceled by branch ignore.

## Source inspection
Source: [All CAC's Information](https://docs.google.com/spreadsheets/d/1aGRxIHJxXJFRRSitY7vZpgBbekBTO-V-jVl9wHnfS3Y/edit).

Five accessible sheets, populated source row counts (not deduplicated children): Mpokket 494, Fanuc 484, McAfee 494, Janashkati Foundation 1042, Dasar UK 121. **Total 2635**. Workbook also contains header/blank rows; do not import those.
 
Distinct village labels within sheets: 15, 15, 15, 41, 5. Across sheets, normalized village labels total **91**. `Masaraguppi` occurs under two different Janashkati regional project labels (`J.F - Hukkeri` and `J.F - Athani`); resolve whether these are one actual centre or different CAC centres before deduplication. Regional Janashkati labels are not automatically different legal donors. Source labels may differ in spelling from canonical donor names (e.g. `Mpockket` vs sheet `Mpokket`, `Dasar UK` vs common brand `Dasra`); do not silently rewrite.

### Import constraints
Migration 017 mandates `source_row_id` foreign keys for donor and staff records and for centre-staff assignments. Every imported directory row must have a corresponding registered source file/sheet/row in `mass_foundation` first, with reproducible source IDs, reviewed identity mapping, source slot, and collision controls.

Recommended order:
1. Securely export/fetch the five-sheet workbook into a private staging environment. Never put student names, teacher personal details, source rows or exports in GitHub.
2. Register original source file, worksheets and source rows through the established foundation import pipeline and preserve provenance. Validate source hashes, exact sheet/row numbers and idempotent batch semantics.
3. Produce review-only donor / centre / staff identity mappings, source row references, duplicates/ambiguous labels; separately confirm Masaraguppi and one-current-donor-per-centre.
4. Obtain explicit mapping approval; import donors and centres then staff and assignments in referential order; reconcile counts and audit failed records.
5. Create managed Supabase Auth staff **only** against a verified approved staff email and centre role grant; test cross-centre denial / private-profile masking. Do not create Auth credentials from directory names.
6. Configure Vercel branch-preview settings (Supabase URL, publishable key, live mode, opt-in directory flag), override ignored-build step for a manual preview, never production. Verify the working preview end-to-end before release.

This record is an audit note, **not an approved mapping or import SQL**. No production write/import, staff provisioning, Vercel setting or deployment is authorized by it.
