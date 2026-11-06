# Consolidation into main — 6 November 2026

The user approved the proposed branch consolidation and Production release with
“Do it” after the explicit plan to reconcile, test, configure Production, merge
and release. This supersedes the earlier hold on merging/releasing for this
controlled release; it does not authorize database migrations, fabricated data,
staff changes or unrestricted writes.

## Reviewed inputs

| Branch | Reviewed head | Treatment |
| --- | --- | --- |
|main |31f874314abb4c6264db0951e33e1e97840d2359 |Merge target; its tree is identical to common ancestor 15cbc3f. No unique file changes compete with the connected frontend. |
|feature/supabase-frontend |4bd51e4a27bc1a10ae8864bd619ce0dade51e51d |Consolidated application, including merged PR #2; use as release source. |
|migration/frontend |85dbbee6258ad434805d0b27f0b44e61cd337f1c |Reference prototype; retain branch, do not merge browser-storage mutations over live adapters. |

`git merge-tree --write-tree main feature/supabase-frontend` reports no conflicts
and produces exactly the connected branch's tree. The branches contain differing
commit IDs because changes were adapted rather than blindly cherry-picked.

## Each migration-only commit reconciled

| Prototype commit | Behaviour | Connected treatment |
| --- | --- | --- |
|43a2f7c |Numbered charts, role overview, filters, entry/export workflows |Chart-reference map is byte-identical; same original UI/CSS, scoped role navigation and live adapters. Existing parity/filter/role tests cover the connected paths. Leadership remains aggregate/read-only. |
|5fc6ea2 |Vertical Morarji charts 15/16 and short-column charts |Original column geometry retained; live reviewed renderer supplies verified cohort/member counts. Missing outcomes stay unknown. |
|865dabf |Axis captions outside plotting area |Same CSS and column axis-label structure; later integrated Morarji label/group overlap fix 8c76b0e also retained. |
|0b57ea1 |Correction/removal/undo and operational forms |Forms/history/version checks retained; browser-only prototype deletion/undo is not enabled against hosted records. Controlled writes remain governed by activation controls, RLS and immutable history. One-use authorized cleanup is not a general delete API. |
|f047c63 |Centre comparisons, monthly reporting, gender, role/cohort summaries |Adapted by 3b3a9f3 and current live reporting helpers, including monthlyReview, monthlyDelivery, morarjiCentreReview and scoped reviewedChartView. Renamed helpers are not evidence of missing features. Fake calendar/dropout/engagement classifications are withheld pending source completeness; approved calculations take precedence over prototype assumptions. |
|85dbbee |Optional training and entrance-exam dates |Separate controls are preserved as explicitly disabled for live saving. record_morarji has no separate date parameters. Do not copy localStorage-only date persistence into the live UI or mark this backend gap complete. |

`src/style.css` is byte-identical between the two frontend branches. All original
24 chart contracts, plus existing additional views, remain. Source reconciliation
details are also in `docs/reviews/2026-11-05-frontend-reconciliation.md`.

## Release checks

-86 frontend tests and27 existing demo workflow/removal/undo checks pass.
-Syntax and build checks pass.
-7 offline activation-builder tests and5 sealed provider-stage rehearsals pass.
-Core, visit/delivery/scoped and definer security SQL suites pass in isolated PG17.
-All1,440 independent JavaScript-versus-SQL calculation comparisons pass.
-7 isolated cleanup scenarios pass. No hosted cleanup or migration is replayed.
-Hosted Preview at `4bd51e4` reaches the proper sign-in page. Managed sign-in
  succeeds and loads92 authorised centres and1,458 students. Centre/shift/grade
  filters update correctly; selected Grade5 learning shows6/7 results and23.2/25.
  Attendance, Learning, Activities, Morarji and Officer views render without
  application alerts. Missing source-dependent data stays explicitly unavailable.
  No fabricated save is required for deployment; user-confirmed live entry and
  its audit trail were verified in the prior approved test/cleanup. Export
  calculations/escaping pass unit checks; no new hosted print/download is claimed.

## Configuration and retained boundaries

Target the existing primary Vercel project `mass-cac-dashboard`
(`prj_MvZqQP2cdpRce7NxWR1JzvBsIBdL`) under the MASS team, repository
`mass-org-data/mass-cac-dashboard`. The similarly named `-7d6d` project is not
the release target.

The five existing MASS configuration variables were extended from Preview-only
to Preview and Production, preserving their values without decrypting them.
No service-role key, secret Auth credential or staff identity enters the client.
Production must build from the actual merged main SHA; verify `release.json`,
deployment target/project, published aliases and application startup afterward.

This is release consolidation, not completion of every deferred feature.
Morarji extra fields/progression, assessment absence/comments/component details,
protected follow-up storage, officer identity/assignment activation and Google
Sign-In retain their documented gates. Existing test permissions are preserved.
Do not delete migration/frontend until the user separately chooses branch cleanup.
