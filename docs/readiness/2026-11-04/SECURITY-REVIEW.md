# Authenticated SECURITY DEFINER review

The hosted Supabase advisor reports nine authenticated_security_definer_function_executable warnings and one separate auth_leaked_password_protection warning. The authenticated-definer lint identifies a privileged RPC surface; it does not by itself demonstrate missing authorization. Warnings remain visible. No blanket revocation or switch to INVOKER was performed to suppress them, because that would break the deliberate owner-separated registration/mutation architecture.

All nine hosted RPC bodies, owners and fixed search paths match the001–019 local baseline. Effective authenticated EXECUTE is present; anonymous/service-role EXECUTE is absent. The same nine functions are tested through actual PostgreSQL role switches with Teacher, CO, Leadership, expired, unassigned, foreign-centre, anonymous and service-role/forged-subject cases. Successful probes roll back their writes and audit rows. Baseline and prepared-release probe results are distinguished from managed Auth runtime certification.

| Flagged RPC | Required scope / invariants | Review |
|---|---|---|
|register_student |can_write(centre), verified controlled grade/shift, permanent unique ID generation and constrained child/profile/enrolment inserts |Own assigned Teacher/CO writes succeed; foreign/readonly/expired/unassigned denied. No account or grant creation. |
|add_enrolment |can_write_child(source) AND can_write(destination), verified immutable episode constraints |Known foreign child/destination cannot be attached by name or UUID guessing. |
|close_enrolment |Existing record centre write scope, expected revision, explicit first closure and history constraints |Closed history is not silently extended; failure rolls back. |
|create_activity |can_write(centre), immutable event context, identifier uniqueness |No foreign-centre event creation; old unknown delivery metadata is not fabricated into Held by analytics. |
|record_attendance |writable_enrolment centre fence, revision/unique context, enrolment/holiday constraints |020 adds explicit staff-session/future/Sunday validation and serialized creation; not yet hosted. |
|record_assessment |writable_enrolment, configured quarter/maximum, unique child+definition, expected version |020makes nullable date/context comparison strict. Existing numeric score corrections remain available and zeros remain scores. |
|record_participation |writable_enrolment, same-centre/shift event, valid historical dates, expected version |A known foreign event/episode cannot bypass scope. Delivery and complete coverage remain separate. |
|add_morarji_member |writable_enrolment and existing source-backed cohort FK, duplicate prevention |Does not create cohorts or infer later outcomes. |
|record_morarji |Existing membership centre write scope and expected version |Known foreign membership denied; applied/attended/passed remain independent nullable flags. |

Private mass_core helpers are not new public reporting endpoints. can_read/can_write evaluate the authenticated UUID's current verified grants; active Leadership prevents writes even with mixed roles. Child helpers preserve the approved historical linkage model; no new retention/time visibility policy was invented. can_read_profile independently requires the profile capability and rejects Leadership. Additional prepared-release tests reject CO profile correction without that capability, foreign-child correction and Leadership correction. period_contains exposes only a configured-period predicate; it does not return personal data.

## Prepared APIs and024

The 020–023 scope, session, role, optimistic version and history tests pass with a non-superuser migration principal and real isolated RLS. CO visit details/history require the authorized author and verified dated assignment; Leadership gets aggregates, not feedback notes. read_record_revisions validates the actual record/centre and a whitelist before returning minimized metadata. Profile corrections require BOTH child write scope and profile-read capability. Atomic transfer/bulk operations roll back earlier work when a later validation fails.

Proposal 024 requires staff identity and readable authorization for every non-null requested centre, not a silently truncated subset. It bounds scopes/month/year/controlled filters/exam pairs; returns aggregates without names, student UUIDs, sensitive notes or source rows; retains owner mass_core_owner and pg_catalog search path; grants only authenticated EXECUTE. SET jit=off is a user-context performance setting, not privilege elevation or disabled RLS. No default-grant broadening, real staff assignment, service key, public private-schema exposure or new policy was added.

## Exact remaining warnings and limits

- Authenticated-definer advisories remain expected for these intentionally callable RPCs. The assessment is supported by body parity, effective ACL inspection and role/scope tests, not a claim of a complete formal security proof.
- Leaked-password protection is a provider Auth configuration/entitlement matter, separate from SQL staff-scope enforcement. It was not enabled, purchased or reconfigured here. Current sign-in/recovery and approved roles were not disrupted.
- Hosted permission/DDL execution and actual staff JWT integration for the uninstalled020–024APIs remain untested. Local Auth stubs are explicitly synthetic. The user has accepted existing Preview reads/sign-in; that does not certify a different new deployment or uninstalled RPC.
- Existing audit minimization deliberately excludes sensitive before-values. Do not activate/test historical profile/transfer overwrites in production under the current no-write restriction, or assume a DDL rollback restores later committed private-field edits.

The read-only evidence collector is scripts/audits/security_review.py. Full advisor payloads and function bodies remain private outside the checkout; publication uses only signatures, guards, hashes and minimized results.
