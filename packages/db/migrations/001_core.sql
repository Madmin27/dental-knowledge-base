-- TASK-003 core only. Workflows and clinical/quarantine data are not implemented.
CREATE TABLE institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE contributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 300),
  institution_id uuid REFERENCES institutions,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL CHECK (length(trim(name_en)) BETWEEN 1 AND 300),
  name_tr text, category text NOT NULL CHECK (length(trim(category)) BETWEEN 1 AND 100),
  parent_id uuid REFERENCES structures,
  created_at timestamptz NOT NULL DEFAULT now(), CHECK (id IS DISTINCT FROM parent_id)
);
CREATE TABLE terminology_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id uuid NOT NULL REFERENCES structures,
  system text NOT NULL CHECK (length(trim(system)) BETWEEN 1 AND 100),
  version text NOT NULL CHECK (length(trim(version)) BETWEEN 1 AND 100),
  code text NOT NULL CHECK (length(trim(code)) BETWEEN 1 AND 100),
  attribution text NOT NULL CHECK (length(trim(attribution)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (structure_id, system, version, code)
);
CREATE TABLE claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_structure_id uuid NOT NULL REFERENCES structures,
  predicate text NOT NULL CHECK (length(trim(predicate)) BETWEEN 1 AND 200),
  value jsonb NOT NULL CHECK (value <> 'null'::jsonb AND octet_length(value::text) <= 65536),
  anatomical_class text NOT NULL CHECK (anatomical_class IN ('canonical','variant','developmental','pathological','unknown')),
  scope jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(scope) = 'object' AND octet_length(scope::text) <= 65536),
  supersedes_claim_id uuid REFERENCES claims,
  author_id uuid NOT NULL REFERENCES contributors,
  created_at timestamptz NOT NULL DEFAULT now(), CHECK (id IS DISTINCT FROM supersedes_claim_id)
);
-- Metadata-only log. No prompt, patient metadata, arbitrary JSON payload or raw data.
-- Reasons are safe operational summaries, never clinical data.
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL, actor_kind text NOT NULL CHECK (actor_kind IN ('human','ai','system')),
  entity_type text NOT NULL CHECK (length(trim(entity_type)) BETWEEN 1 AND 100),
  entity_id uuid NOT NULL, action text NOT NULL CHECK (length(trim(action)) BETWEEN 1 AND 100),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  correlation_id text NOT NULL CHECK (length(trim(correlation_id)) BETWEEN 1 AND 200),
  policy_decision_id text NOT NULL CHECK (length(trim(policy_decision_id)) BETWEEN 1 AND 200),
  policy_version text NOT NULL CHECK (length(trim(policy_version)) BETWEEN 1 AND 100),
  from_state text, to_state text NOT NULL,
  previous_revision bigint, new_revision bigint NOT NULL CHECK (new_revision BETWEEN 0 AND 9007199254740991),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((previous_revision IS NULL AND new_revision = 0)
    OR (previous_revision IS NOT NULL AND previous_revision >= 0 AND new_revision = previous_revision + 1)),
  UNIQUE(id, entity_id, entity_type, new_revision, to_state)
);
CREATE TABLE claim_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims,
  revision bigint NOT NULL CHECK (revision BETWEEN 0 AND 9007199254740991),
  previous_revision bigint,
  evidence_grade text NOT NULL CHECK (evidence_grade IN ('E0_OBSERVATION','E1_REPLICATED_OBSERVATION','E2_LITERATURE_SUPPORTED','E3_INDEPENDENTLY_VERIFIED')),
  consensus_state text NOT NULL CHECK (consensus_state IN ('proposed','under_review','accepted','disputed','rejected','superseded')),
  audit_event_id uuid NOT NULL UNIQUE,
  entity_type text NOT NULL DEFAULT 'claim' CHECK (entity_type = 'claim'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(claim_id, revision),
  FOREIGN KEY(claim_id, previous_revision) REFERENCES claim_assessments(claim_id, revision),
  FOREIGN KEY(audit_event_id, claim_id, entity_type, revision, consensus_state)
    REFERENCES audit_events(id, entity_id, entity_type, new_revision, to_state),
  CHECK ((revision = 0 AND previous_revision IS NULL)
    OR (revision > 0 AND previous_revision IS NOT NULL AND previous_revision = revision - 1))
);
CREATE FUNCTION reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Historical records are immutable; append a new record'; END;
$$;
DO $$
DECLARE relation text;
BEGIN
  FOREACH relation IN ARRAY ARRAY['institutions','contributors','structures','terminology_mappings',
    'claims','claim_assessments','audit_events'] LOOP
    EXECUTE format('CREATE TRIGGER preserve_history BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_history_mutation()', relation);
    EXECUTE format('CREATE TRIGGER preserve_history_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION reject_history_mutation()', relation);
  END LOOP;
END;
$$;
CREATE INDEX claims_structure_idx ON claims(subject_structure_id);
CREATE INDEX audit_entity_idx ON audit_events(entity_type, entity_id, created_at);
