# Production database release, 17 November 2026

**Problem.** Production lacked eight migrations already running on Preview (indexes, centre events, academic profiles, series, batched reads, shift counts, faster report, report-patch fix).

**Preparation.** Read-only checks of Production first (anchor text of the three functions migration 2 patches, event tables empty, no name clashes). The owner took a `pg_dump` backup beforehand (Supabase showed no restorable backup).

**Applied (Production `pbkwpfdpdtelmvbkzgvx`).** Whole chain dry-run in one rolled-back transaction, then each migration in its own transaction with `seal.sql` and a ledger row, in this order: `202611060025`, `20261111120000`, `20261112163945`, `20261113120000`, `20261114120000`, `20261114140000`, `20261114130000`, `20261117120000`. All succeeded.

**Verification.** Production versus Preview: functions 115, columns 268, indexes 104, constraints 214, triggers 66, policies 122 all identical; features differ only in `attendance_entry`/`registration` (unchanged, intentional). Data untouched (82,265 attendance rows, 1,458 enrolments, event tables empty). New reviewed functions sealed; `anon` cannot execute the new functions. Production still serves the strict CSP. The owner signed in and confirmed the Attendance, Profiles, Visits and Annual screens work.

**Not changed.** Feature gates, grants, data, frontend deployment.

**Rollback.** All changes are additive; the client falls back if a function is absent. Last resort: restore the `pg_dump`.

**Future.** Database migrations go to Preview first, then Production through an approved release like this one.
