# Local PostgreSQL development

TASK-003 provides the database foundation, not a web app or publication service.
Prerequisites: Node 20.19+ for these scripts, Python 3, Docker Compose and Git.
No production runtime, ORM, cloud, auth or AI provider is selected here.

```sh
npm ci --ignore-scripts
npm run db:init-env
npm run db:up
npm run test:db:local
npm run db:migrate
npm run db:runtime-role
npm test
python3 -m unittest discover -s tests -v
```

The initializer preserves existing `.env`, creates new credentials with file mode
0600, and never prints credentials. `.env` is ignored by Git. The dedicated
database listens on **127.0.0.1:55432** only. No firewall/router change is required.
Keep this credential restricted to migration/development; it is a database owner,
not an application credential. Do not copy it into an application service.

`dental_runtime` is a NOLOGIN, read-only group role. No application login or write
workflow exists yet. Future workflow tasks must introduce narrowly scoped writes
with authorization and transaction tests; granting database ownership is not a
substitute. PostgreSQL owners/superusers can change the database protections;
the immutability claim is for the intended runtime boundary, not for DB admins.

The integration suite creates uniquely named `dkb_test_*` schemas and temporary
NOLOGIN roles, generates synthetic records, and cleans up its own fixtures.
For CI or another explicitly disposable test database, set `TEST_DATABASE_URL`
and run `npm run test:db`. Tests never reset the public schema.

Each migration is transactional and checksummed. Changes/removal/reordering of
applied files are rejected. Later changes must be new migration files. The runner
serializes concurrent invocation with an advisory lock. The ledger table itself
may remain empty after an unsuccessful first migration; failed DDL is rolled back.

The core schema keeps claim assertions immutable and stores consensus/evidence
assessments in separate append-only revisions. Scientific evidence and actual
reviewer eligibility are not provided by these tables. Assessment insertion tests
exercise integrity as the migration owner; runtime writes are intentionally denied.

```sh
docker compose --env-file .env -f infra/compose.dev.yml ps
docker compose --env-file .env -f infra/compose.dev.yml stop
```

Stopping retains the dedicated volume. Do not use `down -v` to roll back a schema
on a database containing data. Revert code separately and use forward migrations
when data needs to be retained.
