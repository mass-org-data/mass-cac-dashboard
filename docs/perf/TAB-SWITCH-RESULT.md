# Returning to an already-loaded screen: no repeat database requests

Branch `perf/request-reduction`. Client only; no database change.

## Cause
Phase A cached the shared reports, rosters and startup reads, but each screen's own list calls (Attendance register and distribution, Assessments register, Student profiles page, Visits, Morarji, Annual) were not cached, so every visit to a screen asked the database again (revisit counts before: Attendance 3, Profiles 1, Assessments 1, Visits 1, Morarji 1, Annual 1).

## Fix
`web/src/session/readCache.ts`: a read-through cache in front of the read-only server calls (list in `CACHED_READS`). Entries live in memory only, for five minutes; identical concurrent calls share one request; a failed read is forgotten so it can be retried. Any save, correction or deletion clears the whole cache and the shared data services (also when the save fails, because its outcome may be unknown), so users see their own changes at once. Sign-in, sign-out and role change drop everything. Never cached: registers opened for editing, version tokens, history, and any call not on the list.

## Measured (real browser on Preview, local build, 2 runs; every role, screens opened in turn and then opened again)
| Requests when returning to a screen | Before | After |
|---|---|---|
| Overview, About | 0 | 0 |
| Attendance | 3 | 0 |
| Student profiles | 1 | 0 |
| Assessments | 1 | 0 |
| Visits | 1 | 0 |
| Morarji | 1 | 0 |
| Annual donor summary | 1 | 0 |

The real-browser check, including saving attendance and assessments and seeing them in the refreshed screens, passed 142/142; 201 web tests including nine for the cache.

## What still appears in a network trace (by design)
The session and scope check: every 30 seconds, and whenever the browser tab becomes visible again, the app re-verifies the signed-in user and their centre scope. That is the security rule that signs a user out when their access changes; it is not cached. Switching browser tabs triggers it.

## Staleness
Another user's changes can take up to five minutes to appear (the limit the owner chose). Your own saves appear immediately.
