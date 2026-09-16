# ADR-0001: Local PostgreSQL development tooling

- Status: Accepted for local development by delegated technical decision (2026-09-16); production deferred
- Date: 2026-09-07
- Owner: project maintainer, implementation delegated to Codex in this session

## Context
Architecture v0.1 requires PostgreSQL. A runnable local development instance is
needed without changing existing server services. The user instructed continued
implementation and local project startup on 2026-09-07.

## Decision
Use an isolated PostgreSQL 17 Docker container bound only to 127.0.0.1:55432,
with a dedicated volume, generated local credentials and no patient data.
Use parameterized SQL through pg 8.23.0 and explicit SQL migrations. Do not choose
an ORM, production cloud, queue, auth provider or production hosting here.
Node ESM tooling uses the available Node runtime. A production runtime version
and framework remain deferred. No credentials enter Git.

## Alternatives
Host-wide PostgreSQL installation would expand server maintenance scope.
An in-memory store or SQLite would not validate the required PostgreSQL behavior.

## Consequences
Local Docker is required for the documented setup. SQL remains portable to a
managed or self-hosted PostgreSQL deployment later. Development credentials must
not be reused in production.

## Compatibility
Preserves Architecture sections 4.1, 22, 29 and 30. There is no public exposure.

## Rollback
Stop the dedicated container. Keep its volume until data retention is decided;
no other container or volume is touched. Revert the tooling commit if needed.

## Review / experiment record
The user authorized local implementation on 2026-09-07. A development container
was started during that session; that experiment does not establish acceptance
of this ADR. The schema migration was not verified as applied: execution was
blocked before a successful migration result. Current service/database state
must be checked before any future migration.

This draft is proposed for technical review. It is not an approved architecture
baseline, academic approval, production topology decision or permission to
transfer credentials/data. The previous Accepted label was premature and is
corrected here without concealing the earlier local experiment.


## Technical decision — 2026-09-16

The user explicitly delegated final technical decisions and instructed continuation
after interruption. The local development choice is accepted under that authority,
following live verification of the dedicated healthy localhost-only container and
empty public schema, and nine passing integration tests in disposable schemas.
This is the implementing agent's technical decision, not an external review or
academic approval. The earlier 27-table draft was replaced with eight core tables
(including the migration ledger); other entities remain assigned to later tasks.
The runtime group role is read-only and NOLOGIN.
