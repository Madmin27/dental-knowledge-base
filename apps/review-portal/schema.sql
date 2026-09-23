-- Run as migration owner, never as the runtime role. Dedicated production DB.
CREATE TABLE IF NOT EXISTS accounts (
 id uuid PRIMARY KEY, issuer text NOT NULL, subject text NOT NULL,
 enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(issuer,subject)
);
CREATE TABLE IF NOT EXISTS grants (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts,
 role text NOT NULL CHECK(role IN ('photo_contributor','privacy_reviewer')),
 scope text NOT NULL CHECK(scope='photo_pilot'),
 starts_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 granted_by text NOT NULL, evidence_ref text NOT NULL,
 revoked_at timestamptz, revoke_reason text,
 CHECK(expires_at>starts_at)
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts,
 csrf text NOT NULL, auth_at timestamptz NOT NULL, mfa boolean NOT NULL,
 expires_at timestamptz NOT NULL, last_seen timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS login_attempts (
 token_hash text PRIMARY KEY, payload jsonb NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS packages (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES accounts,
 metadata jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz, purge_complete boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS photos (
 id uuid PRIMARY KEY, package_id uuid NOT NULL REFERENCES packages,
 media_type text NOT NULL CHECK(media_type IN ('image/jpeg','image/png')),
 size integer NOT NULL CHECK(size>0 AND size<=20971520), view_name text NOT NULL,
 state text NOT NULL CHECK(state IN ('uploading','processing','blocked','privacy_review','privacy_cleared','needs_information','rejected','deleted')),
 revision integer NOT NULL DEFAULT 1, chunks jsonb NOT NULL DEFAULT '[]',
 raw_fingerprint text, derivative_hash text, info jsonb,
 lease uuid, lease_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(package_id,id)
);
CREATE TABLE IF NOT EXISTS privacy_decisions (
 id uuid PRIMARY KEY, photo_id uuid NOT NULL REFERENCES photos,
 reviewer_id uuid NOT NULL REFERENCES accounts, grant_id uuid NOT NULL REFERENCES grants,
 revision integer NOT NULL, derivative_hash text NOT NULL,
 decision jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(photo_id,revision)
);
CREATE TABLE IF NOT EXISTS audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid REFERENCES accounts, event text NOT NULL, object_id uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS quota_lock (id integer PRIMARY KEY CHECK(id=1));
INSERT INTO quota_lock VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS daily_quota (
 account_id uuid NOT NULL REFERENCES accounts, day date NOT NULL,
 bytes bigint NOT NULL DEFAULT 0, PRIMARY KEY(account_id,day)
);
CREATE TABLE IF NOT EXISTS tombstones (
 package_id uuid PRIMARY KEY, erased_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS photos_package ON photos(package_id);
CREATE INDEX IF NOT EXISTS packages_owner ON packages(owner_id);
CREATE INDEX IF NOT EXISTS grants_account ON grants(account_id);
