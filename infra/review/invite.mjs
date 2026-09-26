// Operator-only provisioning. Does not send email or imply identity verification.
import { readFile, writeFile, stat } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { requireThat, text } from "../../apps/review-portal/policy.mjs";
const [configFile, requestFile, deliveryFile] = process.argv.slice(2);
for (const file of [configFile, requestFile])
  requireThat(
    file && (await stat(file)).mode % 512 === 0o600,
    "private_file_required",
  );
const config = JSON.parse(await readFile(configFile, "utf8")),
  request = JSON.parse(await readFile(requestFile, "utf8"));
requireThat(
  request.contactVerified === true && request.identityChecked === true,
  "human_verification_required",
);
requireThat(
  /^[a-z0-9][a-z0-9._-]{2,63}$/.test(request.username),
  "invalid_username",
);
requireThat(
  typeof request.email === "string" &&
    request.email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email),
  "invalid_email",
);
requireThat(
  ["member", "photo_contributor", "privacy_reviewer"].includes(request.role),
  "invalid_role",
);
const expires = new Date(request.expiresAt);
requireThat(
  +expires > Date.now() && +expires < Date.now() + 90 * 86400000,
  "maximum_90_day_grant",
);
const grantor = text(request.grantedBy, 200),
  evidence = text(request.evidenceReference, 500);
const personName = (value) => {
  requireThat(
    typeof value === "string" &&
      value.trim().length >= 1 &&
      value.length <= 80 &&
      !/[\x00-\x1f]/.test(value),
    "invalid_person_name",
  );
  return value.trim();
};
const password = randomBytes(24).toString("base64url");
const headers = {
  "X-Forwarded-Proto": "https",
  "X-Forwarded-Host": "dentalopensource.org",
  "X-Forwarded-Port": "443",
};
const base = "http://127.0.0.1:8079/auth";
const tokenResponse = await fetch(
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
      totp: request.operatorOtp ?? "",
    }),
    signal: AbortSignal.timeout(10000),
  },
);
requireThat(tokenResponse.ok, "private_operator_login_failed");
const { access_token } = await tokenResponse.json();
const admin = async (path, options = {}) => {
  const r = await fetch(base + "/admin/realms/dental" + path, {
    ...options,
    headers: {
      ...headers,
      Authorization: "Bearer " + access_token,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });
  requireThat(r.ok, "identity_provisioning_failed");
  return r;
};
const response = await admin("/users", {
  method: "POST",
  body: JSON.stringify({
    username: request.username,
    email: request.email,
    firstName: personName(request.firstName),
    lastName: personName(request.lastName),
    enabled: true,
    emailVerified: true,
    requiredActions: ["UPDATE_PASSWORD", "CONFIGURE_TOTP"],
    credentials: [{ type: "password", value: password, temporary: true }],
  }),
});
const subject = response.headers.get("location")?.split("/").at(-1);
requireThat(/^[a-f0-9-]{36}$/.test(subject ?? ""), "identity_subject_missing");
const pool = new pg.Pool({ connectionString: config.databaseUrl }),
  c = await pool.connect(),
  account = randomUUID();
try {
  await c.query("BEGIN");
  await c.query("SELECT pg_advisory_xact_lock(50405)");
  await c.query("INSERT INTO accounts(id,issuer,subject) VALUES($1,$2,$3)", [
    account,
    config.issuer,
    subject,
  ]);
  await c.query("INSERT INTO member_profiles(account_id,email) VALUES($1,$2)", [
    account,
    request.email,
  ]);
  if (request.role !== "member")
    await c.query(
      "INSERT INTO grants(id,account_id,role,scope,expires_at,granted_by,evidence_ref) VALUES($1,$2,$3,'photo_pilot',$4,$5,$6)",
      [randomUUID(), account, request.role, expires, grantor, evidence],
    );
  await c.query(
    "INSERT INTO audit(actor_id,event,object_id) VALUES($1,'operator_verified_invitation',$1)",
    [account],
  );
  await c.query("COMMIT");
  await writeFile(
    deliveryFile,
    JSON.stringify(
      {
        username: request.username,
        temporaryPassword: password,
        login: config.origin + "/review/login",
        accountId: account,
        instructions:
          "Deliver through a verified private channel. First login changes the password and sets up TOTP; then sign in again. Do not paste credentials in chat or Git.",
      },
      null,
      2,
    ),
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    "Individual account provisioned. Private delivery file written; no message sent.",
  );
} catch {
  await c.query("ROLLBACK");
  console.error(
    "Provisioning incomplete; operator reconciliation required. No authority inferred from a display name.",
  );
  process.exitCode = 1;
} finally {
  c.release();
  await pool.end();
}
