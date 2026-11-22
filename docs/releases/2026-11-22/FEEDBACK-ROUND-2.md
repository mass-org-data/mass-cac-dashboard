# Feedback round 2 (Vercel review comments), 22 November 2026

PR: one pull request into `staging` (branch `fix/feedback-round-2`), extended stage by stage. Working notes and status live in `AGENTS.md` ("Feedback round 2").

## Workstream 2: permissions and switches (Preview only)
- **Problem:** Leadership could not add or edit attendance, visits or profiles on the staging preview; forms said saving was switched off; the Morarji follow-up table errored; User administration failed.
- **Database (Preview only):** `20261122120000_table_page_variable_conflict.sql` and `20261122130000_activation_allow_profiles_morarji_enrolments.sql`, each dry-run then applied in its own transaction with `seal.sql` and a ledger row. Switches enabled with an approval reference: `attendance_entry`, `visit_entry`, `profiles`.
- **Config (Preview only):** Edge Function secret `MASS_ADMIN_INVITE_URL` set to the staging domain root (CORS allows exactly this origin).
- **Security/data impact:** no grants or records changed; Leadership write authority was already in the permission migrations and is still enforced by the database. Production is unchanged.
- **Validation:** `npm run test:sql:portable` (new regression for the follow-up page), real-browser check on the Preview project. Not verified: the administration panel from the deployed staging domain.
- **Rollback:** set the three features back to `enabled=false`; restore the previous secret value; the migrations are additive (the constraint change can be reversed while the three features are disabled).
