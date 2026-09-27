-- Transactional outbox. No applicant contact, text or clinical material is copied.
CREATE TABLE IF NOT EXISTS membership_mail_outbox (
 application_id uuid PRIMARY KEY REFERENCES membership_applications(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 last_error text CHECK(last_error IN ('smtp_failed'))
);
CREATE INDEX IF NOT EXISTS membership_mail_due ON membership_mail_outbox(next_attempt_at) WHERE sent_at IS NULL;
CREATE OR REPLACE FUNCTION queue_membership_mail()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 INSERT INTO membership_mail_outbox(application_id) VALUES(NEW.id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION queue_membership_mail() FROM PUBLIC;
DROP TRIGGER IF EXISTS membership_mail_submitted ON membership_applications;
CREATE TRIGGER membership_mail_submitted AFTER INSERT ON membership_applications
 FOR EACH ROW EXECUTE FUNCTION queue_membership_mail();
