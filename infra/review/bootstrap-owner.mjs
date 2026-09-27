// First owner only; trusted local operator command, never a public enrollment route.
// Mailbox ownership remains unverified until Keycloak VERIFY_EMAIL succeeds.
import { readFile, writeFile, stat } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
const [operatorPath, mailPath, deliveryPath] = process.argv.slice(2);
for (const path of [operatorPath, mailPath]) {
  if (!path || (await stat(path)).mode % 512 !== 0o600)
    throw Error("private_file_required");
}
const config = JSON.parse(await readFile(operatorPath, "utf8"));
const mail = JSON.parse(await readFile(mailPath, "utf8"));
const email = mail.smtp?.from;
if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email ?? ""))
  throw Error("invalid_owner_mailbox");
const password = randomBytes(24).toString("base64url");
const account = randomUUID();
// Reserve private delivery first. Never print or put credentials in process arguments.
await writeFile(
  deliveryPath,
  JSON.stringify(
    {
      username: email,
      temporaryPassword: password,
      login: config.origin + "/review/login",
      accountId: account,
      status: "preparing",
      instructions:
        "First login requires password change, authenticator setup and email verification. Then sign in again.",
    },
    null,
    2,
  ),
  { mode: 0o600, flag: "wx" },
);
const headers = {
  "X-Forwarded-Proto": "https",
  "X-Forwarded-Host": "dentalopensource.org",
  "X-Forwarded-Port": "443",
};
const base = "http://127.0.0.1:8079/auth";
const pool = new pg.Pool({ connectionString: config.databaseUrl });
const c = await pool.connect();
let admin,
  subject,
  committed = false;
try {
  await c.query("BEGIN");
  await c.query("SELECT pg_advisory_xact_lock(50405)");
  if ((await c.query("SELECT 1 FROM accounts LIMIT 1")).rowCount)
    throw Error("first_owner_only");
  const response = await fetch(
    base + "/realms/master/protocol/openid-connect/token",
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: "admin-cli",
        grant_type: "password",
        username: config.adminUsername ?? "bootstrap-operator",
        password: config.adminPassword ?? config.bootstrapPassword,
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw Error("operator_login_failed");
  const token = (await response.json()).access_token;
  admin = async (path, options = {}) => {
    const r = await fetch(base + "/admin/realms/dental" + path, {
      ...options,
      headers: {
        ...headers,
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw Error("identity_operation_failed");
    return r;
  };
  const r = await admin("/users", {
    method: "POST",
    body: JSON.stringify({
      username: email,
      email,
      firstName: "Project",
      lastName: "Owner",
      enabled: false,
      emailVerified: false,
      requiredActions: ["UPDATE_PASSWORD", "CONFIGURE_TOTP", "VERIFY_EMAIL"],
      credentials: [{ type: "password", value: password, temporary: true }],
    }),
  });
  subject = r.headers.get("location")?.split("/").at(-1);
  if (!/^[a-f0-9-]{36}$/.test(subject ?? "")) throw Error("subject_missing");
  await c.query("INSERT INTO accounts(id,issuer,subject) VALUES($1,$2,$3)", [
    account,
    config.issuer,
    subject,
  ]);
  await c.query("INSERT INTO member_profiles(account_id,email) VALUES($1,$2)", [
    account,
    email,
  ]);
  await c.query(
    "INSERT INTO membership_managers(account_id,expires_at,appointed_by,evidence_ref) VALUES($1,now()+interval '89 days','authenticated project owner instruction','Owner bootstrap; mailbox verification and MFA required by identity provider before access')",
    [account],
  );
  await c.query(
    "INSERT INTO audit(actor_id,event,object_id) VALUES($1,'owner_bootstrap_pending_verification',$1)",
    [account],
  );
  await c.query("COMMIT");
  committed = true;
  await admin("/users/" + subject, {
    method: "PUT",
    body: JSON.stringify({ enabled: true }),
  });
  const delivery = JSON.parse(await readFile(deliveryPath, "utf8"));
  delivery.status = "requires_password_change_otp_and_email_verification";
  await writeFile(deliveryPath, JSON.stringify(delivery, null, 2), {
    mode: 0o600,
  });
  console.log(
    "Owner identity prepared. Email is NOT verified. Private initial credential saved. No email sent.",
  );
} catch {
  if (!committed) {
    await c.query("ROLLBACK");
    if (subject && admin)
      await admin("/users/" + subject, { method: "DELETE" }).catch(() => {});
  }
  console.error(
    "Owner setup incomplete. Reconcile private delivery status and disabled identity before retrying; no verification inferred.",
  );
  process.exitCode = 1;
} finally {
  c.release();
  await pool.end();
}
