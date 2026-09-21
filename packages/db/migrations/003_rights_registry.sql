-- Metadata only: no raw clinical data, document bodies, URLs with credentials or binaries.
CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  origin text NOT NULL CHECK (origin IN ('synthetic','external','contributor','human_derived')),
  institution_owned boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE asset_rights (
  id uuid PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES assets,
  revision bigint NOT NULL CHECK (revision BETWEEN 0 AND 9007199254740991),
  previous_revision bigint,
  document jsonb NOT NULL CHECK (jsonb_typeof(document)='object' AND octet_length(document::text)<=65536),
  status text GENERATED ALWAYS AS (document->>'status') STORED NOT NULL
    CHECK (status IN ('UNKNOWN','APPROVED','REJECTED','REVOKED')),
  reviewer_id uuid GENERATED ALWAYS AS ((document->'review'->>'actorId')::uuid) STORED REFERENCES contributors,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(asset_id,revision),
  FOREIGN KEY(asset_id,previous_revision) REFERENCES asset_rights(asset_id,revision),
  CHECK ((revision=0 AND previous_revision IS NULL) OR (revision>0 AND previous_revision IS NOT NULL AND previous_revision=revision-1)),
  CHECK (status <> 'APPROVED' OR (reviewer_id IS NOT NULL
    AND COALESCE(document->'review'->>'actorKind'='human',false)
    AND COALESCE(document->'review'->>'role' IN ('rights_reviewer','maintainer'),false)
    AND length(trim(COALESCE(document->'review'->>'decisionId','')))>0))
);
CREATE TRIGGER preserve_history BEFORE UPDATE OR DELETE ON assets
FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER preserve_history_truncate BEFORE TRUNCATE ON assets
FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER preserve_history BEFORE UPDATE OR DELETE ON asset_rights
FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER preserve_history_truncate BEFORE TRUNCATE ON asset_rights
FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation();

-- Serialize rights append with a future release transaction holding this asset lock.
CREATE FUNCTION lock_rights_asset() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('SELECT id FROM %I.assets WHERE id=$1 FOR UPDATE',TG_TABLE_SCHEMA) USING NEW.asset_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER rights_asset_lock BEFORE INSERT ON asset_rights
FOR EACH ROW EXECUTE FUNCTION lock_rights_asset();
