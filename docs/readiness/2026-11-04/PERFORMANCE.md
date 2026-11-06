# Aggregate024 performance and compatibility review

The unchanged calculation query was measured in isolated PG17 using92 synthetic centres,1,500 synthetic students,46,500 attendance rows,3,000 assessment results, explicit calendars and confirmed test-only scope grants. No source workbook/real identity was used. Five repeated calls per scope/configuration were measured with statement-timeout safeguards; the local fixture uses an opt-in 512 MiB ephemeral PostgreSQL tmpfs, not a hosted or paid resource.

Before the function-local setting, all-centre runs with session JIT on averaged 3033 ms (2870–3392ms); session JIT off averaged 1484 ms. The final proposal pins JIT off locally to the function. In the final recovered benchmark, all-centre cases ranged751–1322ms across warm/cold groups, one-centre cases5–11ms and combined grade/shift/gender cases29–43ms. CPU/cache/load affect these observations; no hosted/network SLA or exact speedup is claimed.

The actual managed target reports jit=off already, with context=user. Therefore SET jit=off is compatible with the current managed setting and does not change provider configuration, require a new privileged role or promise faster production execution. It prevents a caller/environment default from reintroducing compilation overhead. Search path remains pg_catalog, owner remains mass_core_owner, and authenticated-only scoped EXECUTE is unchanged. No table/index/schema/role was added by the proposal optimization.

The monthly/date/year and1–100 centre bounds remain enforced. Every requested centre must be readable, duplicates are deduplicated, unknown/partial coverage is preserved, and calculations use existing approved population/denominator rules. Function-local configuration changes no result;1,440 independent SQL/frontend cases pass after the change. Caller caches remain keyed by scope/filter/year/data epoch and cleared on logout/refresh. Queries do not receive names or private profile rows.

Reproduce only in the isolated test runner:

```bash
MASS_REVIEWED_CHARTS=1 MASS_AGGREGATE_PERFORMANCE=1 bash tests/release/run-local.sh
```

The code does not accept a hosted connection for the performance fixture. Benchmark numbers from the interrupted phase survived with the source optimization and were inspected after recovery; they are not mislabeled as fresh hosted measurements.
