-- The runner holds a transaction. Exclude writers throughout validation and DDL;
-- fail on inconsistent existing history rather than rewriting immutable records.
LOCK TABLE claims, claim_assessments, audit_events IN ACCESS EXCLUSIVE MODE;

ALTER TABLE audit_events ADD CONSTRAINT claim_audit_source_shape CHECK (
  entity_type <> 'claim' OR
  (new_revision = 0 AND from_state IS NULL) OR
  (new_revision > 0 AND from_state IS NOT NULL)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM claim_assessments a
    JOIN audit_events e ON e.id = a.audit_event_id
    LEFT JOIN claim_assessments p ON p.claim_id = a.claim_id AND p.revision = a.previous_revision
    WHERE e.previous_revision IS DISTINCT FROM a.previous_revision
       OR e.from_state IS DISTINCT FROM p.consensus_state
  ) THEN
    RAISE EXCEPTION 'Existing assessment audit source is inconsistent'
      USING ERRCODE = '23514', CONSTRAINT = 'assessment_audit_source_matches';
  END IF;
  IF EXISTS (
    WITH RECURSIVE walk(origin, next_id) AS (
      SELECT id, supersedes_claim_id FROM claims
      UNION
      SELECT w.origin, c.supersedes_claim_id FROM walk w JOIN claims c ON c.id = w.next_id
    ) SELECT 1 FROM walk WHERE origin = next_id
  ) THEN
    RAISE EXCEPTION 'Existing claim supersession cycle'
      USING ERRCODE = '23514', CONSTRAINT = 'claims_supersession_acyclic';
  END IF;
END;
$$;

-- SECURITY INVOKER; schema comes from the triggering relation, never the caller's
-- search_path. The transition relation contains all rows of the INSERT statement.
CREATE FUNCTION check_assessment_audit_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invalid boolean;
BEGIN
  EXECUTE format($query$
    SELECT EXISTS (
      SELECT 1 FROM inserted_assessments a
      JOIN %I.audit_events e ON e.id = a.audit_event_id
      LEFT JOIN %I.claim_assessments p ON p.claim_id = a.claim_id AND p.revision = a.previous_revision
      WHERE e.previous_revision IS DISTINCT FROM a.previous_revision
         OR e.from_state IS DISTINCT FROM p.consensus_state
    )$query$, TG_TABLE_SCHEMA, TG_TABLE_SCHEMA) INTO invalid;
  IF invalid THEN
    RAISE EXCEPTION 'Assessment audit source does not match predecessor'
      USING ERRCODE = '23514', CONSTRAINT = 'assessment_audit_source_matches';
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER assessment_audit_source
AFTER INSERT ON claim_assessments REFERENCING NEW TABLE AS inserted_assessments
FOR EACH STATEMENT EXECUTE FUNCTION check_assessment_audit_source();

-- Existing edges cannot change; immediate FK prevents references to an absent
-- predecessor across statements/transactions. New cycles must involve this batch.
-- UNION (not UNION ALL) terminates even when the proposed batch contains a cycle.
CREATE FUNCTION check_claim_supersession() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invalid boolean;
BEGIN
  EXECUTE format($query$
    WITH RECURSIVE walk(origin, next_id) AS (
      SELECT id, supersedes_claim_id FROM inserted_claims
      UNION
      SELECT w.origin, c.supersedes_claim_id FROM walk w JOIN %I.claims c ON c.id = w.next_id
    ) SELECT EXISTS (SELECT 1 FROM walk WHERE origin = next_id)
    $query$, TG_TABLE_SCHEMA) INTO invalid;
  IF invalid THEN
    RAISE EXCEPTION 'Claim supersession cycle'
      USING ERRCODE = '23514', CONSTRAINT = 'claims_supersession_acyclic';
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER claims_supersession
AFTER INSERT ON claims REFERENCING NEW TABLE AS inserted_claims
FOR EACH STATEMENT EXECUTE FUNCTION check_claim_supersession();
