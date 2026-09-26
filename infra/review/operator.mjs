// Local operator only. Input JSON is supplied through a mode-0600 file, never argv secrets.
// Provision Keycloak subjects through its private admin endpoint before binding here.
import pg from "pg";
import { readFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { id, text, requireThat } from "../../apps/review-portal/policy.mjs";
const [configPath, requestPath] = process.argv.slice(2);
for (const p of [configPath, requestPath])
  requireThat(
    p && (await stat(p)).mode % 512 === 0o600,
    "operator_file_requires_0600",
  );
const config = JSON.parse(await readFile(configPath, "utf8")),
  request = JSON.parse(await readFile(requestPath, "utf8"));
const pool = new pg.Pool({ connectionString: config.databaseUrl }),
  c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("SELECT pg_advisory_xact_lock(50405)");
  if (request.action === "bind") {
    requireThat(request.contactVerified === true, "verify_contact_first");
    const subject = id(request.subject),
      account = id(request.accountId);
    await c.query("INSERT INTO accounts(id,issuer,subject) VALUES($1,$2,$3)", [
      account,
      config.issuer,
      subject,
    ]);
    await c.query(
      "INSERT INTO audit(actor_id,event,object_id) VALUES($1,'operator_identity_bound',$1)",
      [account],
    );
  } else if (request.action === "appoint-manager") {
    requireThat(request.contactVerified === true, "verify_contact_first");
    const expiry = new Date(request.expiresAt);
    requireThat(
      Number.isFinite(+expiry) &&
        +expiry > Date.now() &&
        +expiry < Date.now() + 90 * 86400000,
      "maximum_90_day_grant",
    );
    await c.query(
      `INSERT INTO membership_managers(account_id,expires_at,appointed_by,evidence_ref) VALUES($1,$2,$3,$4)
      ON CONFLICT(account_id) DO UPDATE SET expires_at=EXCLUDED.expires_at,appointed_by=EXCLUDED.appointed_by,evidence_ref=EXCLUDED.evidence_ref`,
      [
        id(request.accountId),
        expiry,
        text(request.grantedBy, 200),
        text(request.evidenceReference, 500),
      ],
    );
    await c.query(
      "INSERT INTO audit(actor_id,event,object_id) VALUES($1,'operator_manager_appointed',$1)",
      [request.accountId],
    );
  } else if (request.action === "remove-manager") {
    await c.query("DELETE FROM membership_managers WHERE account_id=$1", [
      id(request.accountId),
    ]);
    await c.query("DELETE FROM sessions WHERE account_id=$1", [
      request.accountId,
    ]);
    await c.query(
      "INSERT INTO audit(actor_id,event,object_id) VALUES($1,'operator_manager_removed',$1)",
      [request.accountId],
    );
  } else if (request.action === "grant") {
    requireThat(
      ["photo_contributor", "privacy_reviewer"].includes(request.role),
      "invalid_role",
    );
    const expiry = new Date(request.expiresAt);
    requireThat(
      Number.isFinite(+expiry) &&
        +expiry > Date.now() &&
        +expiry < Date.now() + 90 * 86400000,
      "maximum_90_day_grant",
    );
    await c.query(
      "INSERT INTO grants(id,account_id,role,scope,expires_at,granted_by,evidence_ref) VALUES($1,$2,$3,'photo_pilot',$4,$5,$6)",
      [
        randomUUID(),
        id(request.accountId),
        request.role,
        expiry,
        text(request.grantedBy, 200),
        text(request.evidenceReference, 500),
      ],
    );
    await c.query(
      "INSERT INTO audit(actor_id,event,object_id) VALUES($1,'operator_grant_created',$1)",
      [request.accountId],
    );
  } else if (request.action === "revoke") {
    const grant = id(request.grantId);
    await c.query(
      "UPDATE grants SET revoked_at=now(),revoke_reason=$2 WHERE id=$1",
      [grant, text(request.reason, 500)],
    );
    await c.query(
      "DELETE FROM sessions WHERE account_id IN (SELECT account_id FROM grants WHERE id=$1)",
      [grant],
    );
    await c.query(
      "INSERT INTO audit(event,object_id) VALUES('operator_grant_revoked',$1)",
      [grant],
    );
  } else if (request.action === "disable") {
    await c.query("UPDATE accounts SET enabled=false WHERE id=$1", [
      id(request.accountId),
    ]);
    await c.query("DELETE FROM sessions WHERE account_id=$1", [
      request.accountId,
    ]);
    await c.query(
      "INSERT INTO audit(actor_id,event,object_id) VALUES($1,'operator_account_disabled',$1)",
      [request.accountId],
    );
  } else throw new Error("Unsupported operator action");
  await c.query("COMMIT");
  console.log(
    "Operator action recorded. No identity or private material printed.",
  );
} catch (e) {
  await c.query("ROLLBACK");
  console.error(
    "Operator action rejected. Check local request and constraints.",
  );
  process.exitCode = 1;
} finally {
  c.release();
  await pool.end();
}
