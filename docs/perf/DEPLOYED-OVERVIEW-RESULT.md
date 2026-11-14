# Overview load on the deployed preview (14 November 2026)

Deployment: Vercel Preview of `perf/overview-load-and-ui-rebuild` at commit `22466ea` (the app code is identical to `7686898`; `22466ea` only adds the timing script), served from the preview alias, Vercel region Mumbai (`bom1`), against the preview Supabase project (synthetic data). Real Chromium on the owner's machine, new browser context (cold cache) per run, accessed with a Vercel shareable link that was opened once per run and is not recorded here. Tool: `node scripts/perf/overview-react.mjs`.

Definitions: the clock starts at the sign-in submit, so it includes sign-in and the identity and scope checks (the earlier baseline in `BASELINE.md` started after sign-in, so these numbers are stricter). T1 = first five scorecards show a value. T2 = the whole first screen has settled (no skeleton, nothing in flight). Targets agreed earlier: T1 at or under 3 s, T2 at or under 6 s at the 75th percentile.

| Role | Runs | T1 median / p75 | T2 median / p75 | Requests per load | Failed cards / requests | Slowest request |
|---|---|---|---|---|---|---|
| Leadership (92 centres) | 7 | 3.0 s / 3.5 s | 3.4 s / 4.1 s | 8 | 0 / 0 | 3.7 s |
| Teacher (1 centre) | 5 | 1.6 s / 1.8 s | 1.8 s / 2.1 s | 8 | 0 / 0 | 1.3 s |
| Cluster Officer (9 centres) | 5 | 1.2 s / 1.9 s | 1.9 s / 2.4 s | 8 | 0 / 0 | 5.2 s |

Per run: Leadership T2 ranged 2.9 to 6.3 s (the first run, with a cold database, was the slowest at T1 5.4 s and T2 6.3 s); Cluster Officer's first run took T1 8.2 s and T2 9.5 s because one request took 5.2 s on a cold database, the other four runs were T2 1.3 to 2.4 s. Every load made 8 requests (context, references, capabilities, directory, three reviewed reports, one series) with no failures and no CSP blocks.

## Against the targets
- T2 (full first screen) meets the 6 s target for all roles at p75 (4.1 s worst).
- T1 meets the 3 s target at p75 for Teacher and Cluster Officer; Leadership is 3.5 s at p75 (3.0 s median), slightly over, mainly the first cold run.
- Compared with the original page (first scorecards 10.6 s, whole page 11.7 s, 111 requests, failed cards on 7 of 7 runs; not an exact like-for-like because that clock started after sign-in): about 3 to 4 times faster, 8 requests instead of 111, no failed cards.

## Local versus deployed (same commit, same database)
Local dist on the same machine gave Leadership T1 3.2 s / T2 3.7 s median and Teacher 1.4 s / 1.4 s, so the deployed site (Vercel CDN, real network) is within noise of the local run: the database, not the page delivery, sets the time.

## Not measured
Real mobile networks, several people signing in at once, other browsers or machines, and the Annual donor summary and other screens (the Annual donor summary took about 10 to 14 s locally, see `PHASE-5-ANNUAL-DONOR-RESULT.md`). The cold-database effect (a slow first load after idle) is visible and is a candidate for the caching task in `AGENTS.md`.
