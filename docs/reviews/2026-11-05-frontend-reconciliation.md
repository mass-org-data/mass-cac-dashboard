# MASS connected frontend review — 5 November 2026

Target: existing MASS Vercel project, feature/supabase-frontend. The supplied dtlq0xkft URL is an immutable older deployment at 962f1e5; changes start from latest branch head 63ab7e4. No main merge, database migration, grants or source-data writes.

## Implemented / retained

- Leadership overview focuses on centre comparisons; removes low-attendance, engagement, visit and high-score cards from that overview. No Leadership entry buttons or student rows added.
- Cluster Officer overview includes total authorised centres, independent of the selected centre filter.
- Centre comparison table retains scoped roster, approved attendance rate, observed activity participants and assessment mean. Original donor, shift, grade, gender and dependent filters retained.
- Academic-year selector across reporting views, using existing year-loading workflow. Select equivalent periods to compare years; no fabricated unavailable history or cross-year aggregation.
- Attendance band shares and centre comparisons; incomplete calendar/records stay unclassified. Monthly attendance/participation summary and planned/held/cancelled delivery summary use existing scoped reviewed calculations.
- Good engagement rule clarified as >20 days AND >2 cultural/sports activities, complete records only. Live numerical colours remain unavailable when calendar/event coverage is unverified. Award approval remains separate.
- Grade selection required before live F1–F4 mean comparison, preventing mixed-grade progress charts.
- Charts 15/16 are vertical (yearly pass / grouped cohort stages); 22/23 remain vertical. Long labels wrap. Gender buttons replaced by descriptive legend; existing explicit gender selector remains.
- Chart numbers and existing styles/assets, enrollment/board-result controls, role navigation, phone entry, correction handlers, scope and audit/version checks retained.
- Morarji centre/cohort comparison added without separate donor-specific Morarji page; original year/cohort controls retained. Separate date requirements are shown in the protected form as disabled until saving is supported.

## Not represented as complete

- Morarji training/exam date persistence: record_morarji has no separate date parameters. Requires reviewed schema/API/read mapping; disabled fields do not save locally.
- Live removal/undo, sensitive follow-up storage and board-result writes: preserve existing feature activation/retention gates; do not substitute demo localStorage writes.
- Monthly confirmed dropout trend needs complete calendar, dated roster and correct profile-safe aggregate API; no low attendance → school dropout inference.
- Simultaneous multi-year comparisons need approved historical coverage and cross-year scoped API. Current selector supports sequential review only.
- New source-backed activity/event-count bands, numerical engagement colours, school and career outcomes require the missing data/API coverage. Existing recorded-participant calculations are preserved; no inferred zeros.
- Backend activation 020–024 is not performed. Repository recovery/activation prerequisites remain in force. Existing approvals and preserved reviewed calculation baseline are not silently rewritten.

## Validation

Syntax/build and frontend/auth/scope/unit plus entry/correction/removal demo tests run. New tests check centre-focused Leadership rendering, fixed assigned-centre count, unknown values and non-saving date placeholders. Hosted staff-session, live save/correction and phone visual checks require authenticated application access; Vercel login protection was observed in the available browser.
