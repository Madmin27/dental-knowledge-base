-- Migration owner only. Runtime cannot directly write account or grant authority.
CREATE TABLE IF NOT EXISTS member_profiles (
 account_id uuid PRIMARY KEY REFERENCES accounts, email text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS membership_managers (
 account_id uuid PRIMARY KEY REFERENCES accounts, expires_at timestamptz NOT NULL,
 appointed_by text NOT NULL, evidence_ref text NOT NULL
);
CREATE TABLE IF NOT EXISTS membership_applications (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES accounts,
 role text NOT NULL CHECK(role IN ('photo_contributor','privacy_reviewer','anatomy_reviewer')),
 profile jsonb NOT NULL, status text NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','approved','rejected','withdrawn')),
 revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz, decided_by uuid REFERENCES accounts, reason text,
 grant_id uuid REFERENCES grants
);
CREATE UNIQUE INDEX IF NOT EXISTS membership_pending ON membership_applications(account_id,role) WHERE status='pending';
CREATE TABLE IF NOT EXISTS membership_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES accounts, application_id uuid REFERENCES membership_applications,
 grant_id uuid REFERENCES grants, event text NOT NULL, reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE grants DROP CONSTRAINT IF EXISTS grants_role_check;
ALTER TABLE grants ADD CONSTRAINT grants_role_check CHECK(role IN ('photo_contributor','privacy_reviewer','anatomy_reviewer'));

ALTER TABLE grants DROP CONSTRAINT IF EXISTS grants_scope_check;
ALTER TABLE grants ADD CONSTRAINT grants_scope_check CHECK(scope IN ('photo_pilot','anatomy_team'));

CREATE OR REPLACE FUNCTION enroll_member(p_id uuid,p_issuer text,p_subject text,p_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid;
BEGIN
 IF length(p_email)>254 OR position('@' in p_email)<2 OR length(p_subject)>255 THEN RAISE EXCEPTION 'invalid_identity'; END IF;
 INSERT INTO accounts(id,issuer,subject) VALUES(p_id,p_issuer,p_subject) ON CONFLICT(issuer,subject) DO NOTHING;
 SELECT id INTO result FROM accounts WHERE issuer=p_issuer AND subject=p_subject AND enabled;
 IF result IS NULL THEN RAISE EXCEPTION 'account_unavailable'; END IF;
 INSERT INTO member_profiles(account_id,email) VALUES(result,p_email)
 ON CONFLICT(account_id) DO UPDATE SET email=EXCLUDED.email;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION membership_decide(p_token text,p_application uuid,p_revision integer,p_decision text,p_reason text,p_days integer,p_verified boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid; app membership_applications%ROWTYPE; gid uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(50405);
 SELECT s.account_id INTO actor FROM sessions s JOIN accounts a ON a.id=s.account_id
 JOIN membership_managers m ON m.account_id=a.id
 WHERE s.token_hash=p_token AND a.enabled AND s.mfa AND s.expires_at>now()
 AND s.last_seen>now()-interval '15 minutes' AND s.auth_at>now()-interval '15 minutes' AND m.expires_at>now();
 IF actor IS NULL THEN RAISE EXCEPTION 'manager_required'; END IF;
 SELECT * INTO app FROM membership_applications WHERE id=p_application FOR UPDATE;
 IF NOT FOUND OR app.status<>'pending' OR app.revision<>p_revision THEN RAISE EXCEPTION 'stale_application'; END IF;
 IF actor=app.account_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
 IF p_decision NOT IN ('approved','rejected') OR length(trim(p_reason))<10 OR length(p_reason)>2000 THEN RAISE EXCEPTION 'invalid_decision'; END IF;
 IF p_decision='approved' THEN
  IF NOT p_verified OR p_verified IS NULL OR p_days IS NULL OR p_days<1 OR p_days>90 THEN RAISE EXCEPTION 'verification_required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM accounts WHERE id=app.account_id AND enabled) THEN RAISE EXCEPTION 'account_unavailable'; END IF;
  gid:=gen_random_uuid();
  INSERT INTO grants(id,account_id,role,scope,expires_at,granted_by,evidence_ref)
  VALUES(gid,app.account_id,app.role,CASE WHEN app.role='anatomy_reviewer' THEN 'anatomy_team' ELSE 'photo_pilot' END,now()+make_interval(days=>p_days),actor::text,'membership:'||app.id::text);
 END IF;
 UPDATE membership_applications SET status=p_decision,revision=revision+1,decided_at=now(),decided_by=actor,reason=p_reason,grant_id=gid WHERE id=app.id;
 INSERT INTO membership_events(actor_id,application_id,grant_id,event,reason) VALUES(actor,app.id,gid,p_decision,p_reason);
 INSERT INTO audit(actor_id,event,object_id) VALUES(actor,'membership_'||p_decision,app.id);
END $$;

CREATE OR REPLACE FUNCTION membership_revoke(p_token text,p_grant uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid; target uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(50405);
 SELECT s.account_id INTO actor FROM sessions s JOIN accounts a ON a.id=s.account_id JOIN membership_managers m ON m.account_id=a.id
 WHERE s.token_hash=p_token AND a.enabled AND s.mfa AND s.expires_at>now() AND s.last_seen>now()-interval '15 minutes'
 AND s.auth_at>now()-interval '15 minutes' AND m.expires_at>now();
 IF actor IS NULL THEN RAISE EXCEPTION 'manager_required'; END IF;
 IF length(trim(p_reason))<10 OR length(p_reason)>2000 THEN RAISE EXCEPTION 'invalid_reason'; END IF;
 UPDATE grants SET revoked_at=now(),revoke_reason=p_reason WHERE id=p_grant AND revoked_at IS NULL RETURNING account_id INTO target;
 IF target IS NULL THEN RAISE EXCEPTION 'grant_unavailable'; END IF;
 DELETE FROM sessions WHERE account_id=target;
 INSERT INTO membership_events(actor_id,grant_id,event,reason) VALUES(actor,p_grant,'revoked',p_reason);
 INSERT INTO audit(actor_id,event,object_id) VALUES(actor,'membership_revoked',p_grant);
END $$;
REVOKE ALL ON FUNCTION enroll_member(uuid,text,text,text),membership_decide(text,uuid,integer,text,text,integer,boolean),membership_revoke(text,uuid,text) FROM PUBLIC;

CREATE TABLE IF NOT EXISTS membership_settings (id integer PRIMARY KEY CHECK(id=1),photos_enabled boolean NOT NULL DEFAULT false);
INSERT INTO membership_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION membership_intake(p_token text,p_enabled boolean,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(50405);
 SELECT s.account_id INTO actor FROM sessions s JOIN accounts a ON a.id=s.account_id JOIN membership_managers m ON m.account_id=a.id
 WHERE s.token_hash=p_token AND a.enabled AND s.mfa AND s.expires_at>now() AND s.last_seen>now()-interval '15 minutes'
 AND s.auth_at>now()-interval '15 minutes' AND m.expires_at>now();
 IF actor IS NULL THEN RAISE EXCEPTION 'manager_required'; END IF;
 IF p_enabled IS NULL OR p_reason IS NULL OR length(trim(p_reason))<10 OR length(p_reason)>2000 THEN RAISE EXCEPTION 'invalid_reason'; END IF;
 IF p_enabled AND NOT EXISTS(SELECT 1 FROM grants g JOIN accounts a ON a.id=g.account_id WHERE a.enabled AND g.role='privacy_reviewer' AND g.scope='photo_pilot' AND g.revoked_at IS NULL AND g.starts_at<=now() AND g.expires_at>now()) THEN RAISE EXCEPTION 'privacy_team_required'; END IF;
 UPDATE membership_settings SET photos_enabled=p_enabled WHERE id=1;
 INSERT INTO membership_events(actor_id,event,reason) VALUES(actor,CASE WHEN p_enabled THEN 'intake_opened' ELSE 'intake_paused' END,p_reason);
END $$;
REVOKE ALL ON FUNCTION membership_intake(text,boolean,text) FROM PUBLIC;
