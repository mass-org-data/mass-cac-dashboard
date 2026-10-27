# Phase 3B — Supabase compatibility evidence

27 October 2026. Production reference pbkwpfdpdtelmvbkzgvx is reserved for later separately authorized work. No hosted connection, management request, link, migration, account change or API/schema configuration change was made.

| Surface | Evidence obtained | Limitation / next verification |
| --- | --- | --- |
| Hosted project | User-supplied reference retained; no Supabase connector available | Ownership/region/version/contents/permissions/exposure/backups not independently inspected |
| Full isolated Supabase | CLI 2.75.0 initialized a throwaway project under /tmp; local start attempted | Pull of public.ecr.aws/supabase/postgres:17.6.1.075 returned Forbidden; stack did not start. This is an image-registry failure, not proof of unavailable production permissions |
| PostgreSQL | Original six + nine new migrations applied on isolated 17.11; forced RLS and ACLs tested | Actual hosted PostgreSQL version and migration-role CREATE ROLE/ownership/SET ROLE permissions unverified; tests run as local database administrator |
| Auth data contract | Core FKs reference auth.users; functions consume auth.uid(); test stub exposes only synthetic UUIDs and compatible JWT-claim resolution | Migrations do not create/replace managed Auth. GoTrue signup/login/refresh/expiry/revocation/MFA/redirects and Auth-user deletion were not tested |
| Signed API authorization | Real PostgREST 13.0.7, ephemeral HS256 issuer, internal network; valid signatures allowed, invalid denied, forged privileged role denied | Test JWTs are not managed Supabase Auth sessions; do not treat stub UID tests alone as Auth lifecycle certification |
| Schema exposure | API exposes only mass_api; mass_core/mass_foundation/auth profile requests rejected, no source-row endpoint | Existing hosted exposed schemas, Supabase gateway, grants/inheritance/default privileges need separate read-only review |
| Foundation access | anon/authenticated/service_role denied private foundation; core audit trigger gets only minimized insert capability | No public foundation review API or end-user resolver binding; technical DB-principal review attribution remains |
| Core scopes/privacy | Direct SQL roles and signed API requests tested for centre isolation, Leadership read-only, optional private-name capability, expired/revoked grants | No real grants, cluster mappings, private export rights or production retention authorization selected |
| API concurrency | Expected revisions raise PT409/HTTP409; two independent SQL sessions accept one revision; stale HTTP write rejected | Production timeout/pooling/load/offline/bulk behavior and full frontend adapter remain later tests |

`supabase/compatibility/preflight.sql` is a **read-only metadata report** prepared for a later authorized target inspection. It reports version, current-role capabilities, Auth object presence, existing foundation/core roles/schemas and RLS flags. It neither connects nor applies SQL automatically; it has not been run against the hosted project. Also verify authority to delegate REFERENCES on managed auth.users and required Auth schema/function privileges; a local superuser test does not prove these managed permissions. Review role collisions rather than bypassing them or recreating existing infrastructure.

A safe next Supabase test should use an explicitly approved isolated development project/branch or functioning local Supabase stack with synthetic-only fixtures. Verify real managed Auth, actual migration-role authority and ledger, private exposure/default grants, user-scope provisioning/revocation, API/session subject attribution, service-key behavior, gateway limits and backup/recovery. Do not use the reserved production project as a connectivity/DDL experiment. A separate apply authorization is still necessary.

All runtime JWT material and throwaway CLI configuration remain outside Git. No tokens/credentials are embedded in SQL, test fixtures or these reports. The source frontend and Vercel configuration were untouched.
