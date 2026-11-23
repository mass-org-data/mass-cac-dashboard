# Monthly activity history imports

Historical workbooks record one reporting month and four student responses: Cultural 1/2 and Sports 1/2. Preserve those source responses in `mass_import.monthly_activity_history`, separately from dated activity events. A reporting month is not an event date; these imports do not manufacture Saturdays, event names, delivery statuses or monthly meetings.

The private preparer `scripts/imports/monthly_activity.py` requires an explicit month, exact normalized donor/centre/name/grade matching against an existing verified enrolment, full-month enrolment coverage, and Yes/No/blank responses. Duplicate identities, unsupported grades, unknown projects and conflicting rows remain held. Blank remains NULL; No remains false. Core enrolment and child rows are not created or changed.

Run the preparer with `--workbook`, `--roster`, `--key` and `--out`, all pointing to owner-only paths outside Git. It writes an immutable-source plan and a transactional insert-only SQL batch. The database checks source fingerprints and enrolment identity; an exact retry verifies existing rows, while any source or target drift fails closed. Foundation staging counts describe source registration; successful historical rows are accounted by the private history table. Never infer that an entire source is resolved merely because its registration batch completed.

Raw history has forced RLS and no direct application grants. `mass_api.monthly_activity_history_summary` returns bounded centre/shift/month aggregates only after checking the caller's centre scope. It reports recorded students, students with at least two positive responses, Cultural/Sports response totals and missing-response counts. It does not claim event dates, events held, a delivery denominator, or completeness of all enrolled students.

The schema supports the older Production authorization helpers as well as the governed Preview scope. Where the reviewed Leadership student-deletion workflow exists, history participates in impact counts, confirmation tokens and the exact same-transaction deletion receipt. The installation seal rechecks that adapter after later permission migrations. Unknown dependencies still block deletion; ordinary history edits and direct deletion remain denied.

Apply only this reviewed additive migration where explicitly authorized; do not replay unrelated pending migrations or activate operational features. Data import authorization is separate from a frontend release. The current dashboard has not been changed to consume this new history RPC. A future reporting change must label monthly source evidence and avoid double-counting it alongside dated participation.

Validation: `npm run test:monthly-activity`, `npm run test:sql:portable`, lint and syntax checks. Install the pinned `requirements-dev.txt` dependency for the XLSX tests. Live source files, SQL payloads, matching exceptions, HMAC keys and execution findings stay outside Git and CI artifacts.
