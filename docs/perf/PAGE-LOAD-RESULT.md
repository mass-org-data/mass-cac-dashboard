# Load time of every screen, for every role, on the deployed preview (14 November 2026)

Deployment: Vercel Preview of `perf/overview-load-and-ui-rebuild` (preview alias, Vercel region Mumbai), against the preview Supabase project (synthetic data: 92 centres, about 1,500 students, about 200,000 attendance rows). Real Chromium on the owner's machine, accessed with a Vercel shareable link (not recorded). Tool: `node scripts/perf/pages-react.mjs --runs 3`. Raw data: `perf-results/pages-deployed.json` (git-ignored, local).

How to read it. Each cell is the median of 3 runs, then the slowest run and the number of database requests the screen made. "N/A (no access)" means the role cannot open that screen (it is not in that role's menu) and it was not loaded: Student profiles for Leadership (private records) and the Annual donor summary for Teacher and Cluster Officer.
- **Cold**: a new browser, the screen address opened first, then sign-in; the clock runs from the sign-in click until the screen has settled (nothing loading, nothing in flight, stable for 600 ms). It includes sign-in and the identity checks, which cost about 0.4 to 0.9 s on their own (the About screen, which loads no data, shows this floor).
- **Warm**: already signed in with the Overview loaded; each screen is opened from the side menu in turn and the Overview is revisited last. This is what moving around the application costs.


### Cold: sign-in click to settled screen (new browser each time)

| Screen | Leadership | Cluster Officer | Teacher |
|---|---|---|---|
| 1. Overview | 3.5 s (worst 4.1 s, 8 req) | 1.2 s (worst 1.7 s, 8 req) | 1.2 s (worst 1.7 s, 8 req) |
| 2. Attendance | 2.6 s (worst 2.9 s, 8 req) | 0.8 s (worst 1.1 s, 8 req) | 1.0 s (worst 1.8 s, 8 req) |
| 3. Student profiles | N/A (no access) | 0.8 s (worst 1.1 s, 13 req) | 0.8 s (worst 1.3 s, 5 req) |
| 4. Assessments | 2.3 s (worst 2.4 s, 5 req) | 0.8 s (worst 0.9 s, 5 req) | 0.7 s (worst 0.9 s, 5 req) |
| 5. Visits | 1.5 s (worst 1.7 s, 187 req) | 0.5 s (worst 0.5 s, 4 req) | 0.5 s (worst 0.6 s, 5 req) |
| 6. Morarji scholarship | 2.2 s (worst 2.4 s, 4 req) | 0.8 s (worst 1.0 s, 22 req) | 2.4 s (worst 4.0 s, 6 req) |
| 7. Annual donor summary | 12.4 s (worst 14.9 s, 12 req) | N/A (no access) | N/A (no access) |
| 8. About | 0.7 s (worst 0.9 s, 1 req) | 0.4 s (worst 0.4 s, 1 req) | 0.9 s (worst 2.1 s, 1 req) |

### Warm: menu click to settled screen (already signed in)

| Screen | Leadership | Cluster Officer | Teacher |
|---|---|---|---|
| 1. Overview | 3.5 s (worst 3.9 s, 7 req) | 0.6 s (worst 0.7 s, 7 req) | 0.5 s (worst 3.6 s, 7 req) |
| 2. Attendance | 3.9 s (worst 4.2 s, 7 req) | 0.4 s (worst 0.6 s, 7 req) | 0.4 s (worst 1.8 s, 7 req) |
| 3. Student profiles | N/A (no access) | 0.4 s (worst 0.4 s, 12 req) | 0.3 s (worst 0.5 s, 4 req) |
| 4. Assessments | 1.9 s (worst 3.0 s, 4 req) | 0.4 s (worst 0.5 s, 4 req) | 0.4 s (worst 0.5 s, 4 req) |
| 5. Visits | 1.4 s (worst 1.4 s, 186 req) | 0.2 s (worst 0.3 s, 3 req) | 0.2 s (worst 0.2 s, 4 req) |
| 6. Morarji scholarship | 2.7 s (worst 3.0 s, 3 req) | 0.5 s (worst 1.4 s, 21 req) | 0.4 s (worst 0.4 s, 5 req) |
| 7. Annual donor summary | 14.8 s (worst 15.2 s, 12 req) | N/A (no access) | N/A (no access) |
| 8. About | 0.1 s (worst 0.1 s, 0 req) | 0.1 s (worst 0.1 s, 0 req) | 0.1 s (worst 0.1 s, 0 req) |

## What the numbers say
- **Teacher and Cluster Officer are fast everywhere**: every screen settles in about 0.2 to 1.2 s, except the Teacher's Morarji screen on cold load (2.4 s median; one run took 4.0 s, probably a cold database).
- **Leadership is slower because it aggregates all 92 centres**: Overview 3.5 s, Attendance 2.6 s cold and 3.9 s warm, Assessments about 2 s, Morarji about 2.5 s. These are the all-centre reviewed reports.
- **The Annual donor summary is the slowest screen by far**: 12.4 s cold and 14.8 s warm (eight monthly reports one after another through the two-at-a-time queue). It is the clearest candidate for the batched annual function in `CACHING-OPTIONS.md`.
- **Leadership Visits makes 187 small requests** (one pair per centre) but still settles in about 1.5 s.
- **No cache between screens today**: opening the Overview again (warm) takes as long as the first time (3.5 s for Leadership), and Attendance repeats the same all-centre report the Overview just loaded. A shared in-memory cache would make these revisits nearly instant.
- **Reliability**: 0 timeouts and 0 failed requests in all runs.

## Limits
Three runs per cell, one machine, one network, synthetic data; the cold-database effect (one slow run after idle) shows in the worst-run figures. Real mobile networks, several people at once, other browsers and Production data volumes were not measured. The Cluster Officer's Visits screen shows an explanation (the preview account is linked to nine officer identities), so its time is the time to show that explanation, not to load coverage.
