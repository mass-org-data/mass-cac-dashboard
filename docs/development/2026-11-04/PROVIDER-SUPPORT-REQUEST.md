# Draft only — not sent

Subject: Supported recoverable backup/export for existing MASS Supabase project before additive migrations

Project: pbkwpfdpdtelmvbkzgvx, Mumbai/ap-south-1. No schema changes or paid upgrades requested by this ticket.

We need an operator-managed, verified recovery arrangement before applying four reviewed additive migrations to an existing database. The project currently has001–019applied. The Management backup list contains no backups, PITR is disabled, and the internal restore-point GET reports that the endpoint is unavailable. WAL tooling being enabled has not been treated as proof of an accessible recovery point.

Please confirm the supported backup/export and isolated recovery-verification options available under the current plan, including managed Auth objects, role/membership/ownership/ACL coverage, data, migration history and external-service exclusions. If a provider-assisted arrangement is supported, please specify the responsible operator, accessible recovery-point identity/time, coverage, retention, restore limitations, isolation/security requirements and how recoverability can be demonstrated without modifying production.

If a paid option or additional infrastructure is necessary, provide eligibility, full costs and exact requirements for approval first. Do not upgrade, restore, pause the project, rotate credentials or execute SQL based on this draft. We do not have a designated backup operator; please describe the safe administrator/secure credential handoff needed if native PostgreSQL logical backup is the supported route. No credentials or real records should be included in the support discussion.
