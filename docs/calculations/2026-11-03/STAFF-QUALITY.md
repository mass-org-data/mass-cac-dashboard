# Partial staff register — analysis only

Read all three tabs of Mass_summary.xlsx (SHA-256 `53e9e73bc8cc4caf4f640101eea3bd8449b2cbdb20ea417afab4bf7d2a02c628`), exact headers at row 3 and data from row 4. Matched proposals against a private read-only directory/Auth snapshot. This document contains counts only; names, emails, source cells and candidate IDs stay in private reports.

| Check | Result |
|---|---:|
| Source rows | 141 |
| Cluster Officers / Teachers / Senior Leadership | 11 / 128 / 2 |
| Valid email rows / distinct valid emails | 60 / 54 |
| Missing / invalid email rows | 72 / 9 |
| Duplicate valid-email groups | 6 |
| Conflicting-name shared-email groups | 5 (10 rows) |
| Same-name repeated-email groups | 1 (2 rows) |
| Missing name | 1 |
| Teacher rows with unique centre-label proposals | 127 of 128 |
| Unmatched teacher centre | 1 |
| Ambiguous exact directory-name candidate rows | 3 |
| Teacher→officer relationships supported by directory | 96 of 128 |
| Directory relationship mismatch | 9 |
| Missing/ambiguous source officer | 22 |
| No centre match for relationship check | 1 |
| COs with / without teacher-derived centre proposals | 9 / 2 |
| Valid source emails intersecting current Auth account emails | 0 |
| Rows ready for authorization | 0 |
| Accounts created / grants made | 0 / 0 |

Exception categories overlap; do not add their counts as unique people. A unique centre label is a proposal, not verified staff identity or authority. Exact name candidates are not automatically merged. Shared-email conflicts block account linking. Case/whitespace normalization is comparison only; malformed addresses are not guessed or corrected. Donor/project disambiguation is retained as a proposal, including distinct same-name centres; project names alone are never officer scope.

## Authorization mapping proposal

1. MASS corrects the nine malformed email rows, supplies missing emails/names and resolves conflicting ownership of shared addresses. Repeated rows must be confirmed as one identity or corrected; no automatic merge.
2. MASS verifies staff member identity, actual centre UUID(s), Teacher/Cluster Officer/Leadership role, source officer relationship and start/end dates. Confirm missing/ambiguous shifts; do not infer them. Resolve the unmatched centre and relationship exceptions first.
3. Verify the intended Auth identity with the authorized administrator. Existing Auth emails do not match valid workbook emails; this is not permission to create141 accounts or map by names.
4. Approve centre-scoped read/write authority and private-profile capability explicitly. Leadership remains read-only; CO project labels do not establish centre permissions. No global scope or Leadership account is proposed by default.
5. A separately authorized activation applies only reviewed identity/scope mappings with audit evidence, then tests assigned/out-of-scope reads, denied writes and profile restrictions. Google Sign-In remains unimplemented.

Private report: STAFF-QUALITY-AND-MAPPING.private.xlsx includes row-level issues and identity/centre proposals, with formula-safe cell rendering. The private JSON preserves original values and physical rows. Neither report, workbook, email list nor Auth snapshot belongs in Git or the downloadable public source archive.
