# Original frontend parity review

Reference: manager-approved migration/frontend commit `0b57ea193e5dd8decb9a451d0b1cea44e22322fb`. Accepted integrated/calculation baseline: `45cd4d3cd72ba1c61a59f86e6d74d0c30a1d0a74`. The user confirms that the existing protected Preview signs in, loads real Supabase data, displays the original dashboard and applies centre/grade/shift and Donor → Centre filters. That is user-reported acceptance; no new hosted-browser pass is asserted here.

## Presentation and controls

- Original base stylesheet, logos and preview images are byte-identical to the manager-approved source.
- Three-role navigation, all 24 chart slots (original numbering skips17), original page actions, filters and original form field inventory are retained in automated source-reference tests.
- Forty browser screenshots compare original/current fictional-source views at 1280×900 and 390×844. All24chart numbers are covered. Chart-type inventories and measured sidebar/topbar/content horizontal geometry match; no document-width overflow was found. Twelve of 20 PNG pairs are byte-identical. Eight pairs differ in content/approved integrated copy, so this is not a claim of universal pixel identity or a real-data visual comparison.
- The original adaptive renderer is retained: up to five ordinary bars become compact columns; larger sets remain horizontal. Restored source renderers therefore pass through the same orientation policy, rather than assigning a new chart type arbitrarily.
- Restored original green attendance bars; score/quarter blue; assessment-band colours; improved/unchanged/declined colours; delivery status colours; grouped cohort-column geometry/legend; pass-year selection/highlight; gender quick-filter buttons and centre click-throughs.
- Restored live Rules & source download help-grid controls, code-only source ZIP, current-summary export and later-module navigation toggle. Source download was tested as an actual ZIP; private workbooks, private SQL, credentials and staff registers are excluded. Safe .env.example placeholders are allowed.
- Restored grouped cohort comparisons and independent applied/attended/passed bars. Missing outcomes remain unknown instead of being fabricated as original sample Selected/Admitted/Scholarship results. Year shortcuts act only on an unambiguous verified cohort; multiple cohorts in one year require choosing the actual cohort below.
- Engagement retains the original centre/stack container and centre interaction, but unapproved numerical colour segmentation remains pending. Approved attendance/activity counts are displayed; no provisional colour thresholds are restored as business rules.
- Fixed mobile stacking: the open drawer now sits above sticky filter controls. The original reference itself contains this defect; its mobile navigation was invoked programmatically for reference screenshots. Current mobile navigation passed real pointer clicks. The one-line live-only z-index correction changes no base styling, geometry or data.

## Protected workflow parity

Attendance individual/bulk save, correct date, P/A/L corrections, duplicate/version guards, reread and history; assessment entry/correction and quarterly history; visits, officer authorization, two-shift standard, monthly trends and revision history are implemented and tested using actual isolated PostgreSQL/PostgREST persistence. Existing 44browser scenarios plus18new filter/parity scenarios passed. Seven additional tests prove compatibility when020–023 are absent.

Parity is not represented as100% operational activation. Intentional security/source boundaries remain:

| Original sample capability | Protected implementation / exact remaining dependency |
|---|---|
| Editable Preview role picker | Verified role is locked; actual server role/centre authorization is preserved. No client role escalation. |
| Reset sample records | Kept in explicit demo only; no equivalent production reset or deletion. |
| Physical delete / undo | Controls retained, but live deletion/undo remain blocked pending record-specific retention/recovery/authorization semantics. Corrections and revision reads work. |
| Follow-up/sensitive notes | Control retained with explicit unsupported state; no approved storage/retention/privacy contract exists. |
| Guidance entries, course choice and school performance | Source/measure/privacy dependencies remain; no invented dataset/options or unauthorized write path. Later-module navigation is restored. |
| Later Morarji outcomes | Applied/attended/passed supported; selection/admission/scholarship are not inferred. |
| Engagement traffic lights | Original container retained; only unconfirmed numerical boundaries remain pending. |
| Actual visit target applicability | Approved standard 2 Morning + 2 Evening shown; single-shift applicability and historical undated observations are not guessed. |
| Operational backend supplement |020–023 prepared/tested but not hosted;024 reviewed separately as proposal only. |

These distinctions preserve the user's approved rules and security restrictions; they must not be hidden behind a blanket “all features fully activated” statement. No database redesign or schema change was used to restore UI controls.
