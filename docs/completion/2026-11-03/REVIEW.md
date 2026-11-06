# Two code-review passes

These are two separate Codex review passes over this change, not third-party/human security certification. Hosted behavior remains unverified.

## Pass 1: authentication and privacy

Reviewed sign-in validation, Auth-derived identity, code/session handling, credential/error output, sign-out cleanup, centre authorization and provider configuration.

Resolved: one-use callback values are scrubbed before programme requests; implicit token URLs never adopt a session; a verified recovery exchange and matching getUser identity are required; passwords are cleared; provider exceptions do not echo details; no signup/role provisioning or new privileged API was added. Current grants/RLS and all 23 SQL files remain unchanged.

Remaining hosted gates: broad Vercel redirect wildcard; untested SMTP/recovery delivery; forthcoming actual staff validation; existing centre-only permissions cannot stand in for requested single-shift permissions.

## Pass 2: functional continuity and recovery lifecycle

Reviewed normal/rejected sign-in, refresh, sign-out, error/loading states, recovery interruption/replay/cancel/matching passwords, original charts/forms and dataset compatibility.

Resolved: a pending recovery refresh signs out and requires a fresh link instead of opening programme data; same-document sensitive fragments are scrubbed; unexpected provider exceptions leave the reset page protected; checking-session state is explicit. Browser fixtures now use a fixed test clock for the October synthetic dataset, while production still uses actual Asia/Kolkata dates. Reconciliation scripts accept an explicit as-of date; 3 November data checks do not silently reuse 29 October as current time.

The original application/dashboard module and database SQL were not redesigned. Full operational persistence/history/concurrency/security and 001–019 compatibility tests were rerun locally. Existing public-mode helper/tests remain historical code but are not invoked by the live entry point. No anonymous programme view is reachable through normal live startup.

Neither pass validates deployed Vercel configuration, real managed Auth email, the forthcoming staff/decision files or a current production restore. Those remain reported blockers.
