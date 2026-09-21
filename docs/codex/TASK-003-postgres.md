# TASK-003 — PostgreSQL schema and migration runner

Status: narrowed implementation tested locally; see `TASK-003-design-review.md`
and `../LOCAL-DEVELOPMENT.md`. The old 27-table draft has been replaced.
TASK-003 files remain outside the TASK-002 commit/PR.

Objective: migrate an empty PostgreSQL database to the baseline entity registry,
with FK relationships, orthogonal claim fields, immutable assertions, append-only
claim assessments and audit events. Asset/release tables belong to later tasks.

Allowed: packages/db, database tests, local infra, package manifest/lockfile and
ADR-0001. No patient fixtures, anatomical claims or public release.

Acceptance: clean migration, repeat invocation is safe, changed applied migration
is detected, transactions roll back on failure, FK and classification constraints
hold, history rejects destructive updates. Integration tests use a disposable
schema and roll back their synthetic data.

Rollback: stop the isolated local database; retain its dedicated volume. This
first schema can be removed only in an explicitly disposable test database.
