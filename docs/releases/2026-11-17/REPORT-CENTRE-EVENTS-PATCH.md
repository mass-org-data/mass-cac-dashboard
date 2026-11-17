# Restore the centre-event report patch (corrective migration)

**Problem.** `20261111120000_centre_wide_events.sql` patches `mass_api.reviewed_chart_metrics` so activity reporting counts Both-shifts events and excludes Monthly meetings. `20261114130000_reviewed_chart_metrics_efficiency.sql` later replaces the whole function from the reviewed proposal text plus the Holiday patch, which has no centre-event handling. On a database that applies both in file order (Production's planned release), the second silently removes the first.

**Fix.** `20261117120000_reviewed_chart_metrics_centre_events.sql` re-applies the same guarded text replacement. It is idempotent (does nothing if the function is absent, `event_kind` is missing or the patch is present) and aborts on unexpected source text. Run `supabase/activation/seal.sql` in the same transaction.

**Security/data impact.** Function body only; no schema, grant or data change. No result differs while there are no Monthly meeting or Both-shifts events.

**Validation.** `npm run test:sql:portable` (checks the patch appears exactly once after replay, applied twice, and the Holiday exclusion remains; 1,440 calculation cases pass). Applied to the Preview database only (dry run first, then migration plus seal in one transaction); verified: patch present once, guard present, Holiday exclusion present. Production unchanged.

**Release order on Production:** ... 5 batched reads, 7 shift counts, 6 efficiency, then this migration.
