# Staff permission dry-run contract

scripts/audits/permissions_plan.py is preparation only. It emits a private plan and minimized summary; it has no account-provisioning, role-grant, SQL-generation or network path. Review flags are assertions that an authorized MASS reviewer must actually establish, not approvals derived automatically from incomplete spreadsheets. All 141 current rows remain held; no accounts/grants are created.

## Required verified input

| Field | Meaning / rejection rule |
|---|---|
|user_id,email |One existing confirmed Auth UUID, exact verified email; ambiguous/shared identities or inferred/name-only accounts rejected. No email alias guessing. |
|centre_id,role_code |Existing source-backed centre and Teacher/Cluster Officer/Leadership role; no wildcard/global scope. |
|identity_verified,centre_verified,role_verified,scope_verified,profile_access_verified |Each explicitly true only after evidence review; missing/unverified flags hold the row. |
|shift_scope |Whole centre only when that existing centre-wide permission model is explicitly approved. Missing/narrow Morning/Evening scope must not be widened to fit the current schema. Narrower enforcement requires a separately reviewed implementation. |
|can_read_profiles |Explicit boolean; not guessed from job title. Leadership private-profile access is unsupported by the current model. |
|starts_at,ends_at |Verified timezone-aware interval. An explicit approved null end can mean open-ended; a missing end is not an infinite grant. Equivalent timezone representations are compared semantically. |
|verification_ref |Nonempty opaque string reference, not null, names or free-text sensitive notes. |
|directory_assignment_id,staff_link_verified |For a CO, an existing matching officer/centre directory relationship and explicitly verified Auth-to-staff link. Names alone are not a link. |
|officer_starts_on,officer_ends_before,officer_dates_verified |Separate verified operational assignment dates for COs; access timestamps/student FY assumptions do not supply them. Missing/invalid bounds hold the row. |
|source_ref |Optional minimized sha256/sheet/physical-row reference only. Free-form personal content is not copied to technical output. |

All overlapping duplicates, capability changes and mixed Leadership/write-role intervals are reviewed across the full proposed manifest independent of row order. No first row becomes ready merely because a conflicting row appears later. Existing exact verified grants are reported already_configured, not duplicated. Valid multi-centre assignments remain distinct. A ready result is still a proposal for separately controlled administrator application, never proof that permission was granted.

Run with private files outside the checkout:

```bash
python scripts/audits/permissions_plan.py /private/verified-staff-manifest.json \
  --auth /private/auth-snapshot.json --directory /private/directory-snapshot.json \
  --output /private/staff-plan.private.json
python -m unittest discover -s tests/audits -p 'test_*.py'
```

The existing raw three-tab register remains a source/exception review, not an authorization manifest. The private report retains uncertain identities, invalid/missing emails and conflicting links. Google Sign-In is deferred until staff UUID linkage, centre scope, actual authorization and operational workflows are verified; successful OAuth must never itself assign a programme role.
