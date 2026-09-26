// Operator-only activation after an actual delivery rehearsal; never sends email.
import { readFile, writeFile, rename, stat } from "node:fs/promises";
import { requireThat, text } from "../../apps/review-portal/policy.mjs";
const [operatorPath, portalPath, requestPath] = process.argv.slice(2);
try {
  for (const path of [operatorPath, portalPath, requestPath])
    requireThat(
      path && (await stat(path)).mode % 512 === 0o600,
      "private_file_required",
    );
  const operator = JSON.parse(await readFile(operatorPath, "utf8"));
  const portal = JSON.parse(await readFile(portalPath, "utf8"));
  const request = JSON.parse(await readFile(requestPath, "utf8"));
  requireThat(typeof request.enabled === "boolean", "enabled_required");
  if (request.enabled) {
    requireThat(request.deliveryVerified === true, "verify_delivery_first");
    text(request.evidenceReference, 500);
    requireThat(
      request.smtp && request.smtp.host && request.smtp.from,
      "smtp_required",
    );
    requireThat(
      request.smtp.ssl === "true" || request.smtp.starttls === "true",
      "encrypted_mail_transport_required",
    );
  }
  const base = "http://127.0.0.1:8079/auth";
  const headers = {
    "X-Forwarded-Proto": "https",
    "X-Forwarded-Host": "dentalopensource.org",
    "X-Forwarded-Port": "443",
  };
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
        username: operator.adminUsername ?? "bootstrap-operator",
        password: operator.adminPassword ?? operator.bootstrapPassword,
        totp: request.operatorOtp ?? "",
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  requireThat(response.ok, "operator_login_failed");
  const token = (await response.json()).access_token;
  const admin = async (path, options = {}) => {
    const r = await fetch(base + "/admin/realms/dental" + path, {
      ...options,
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      signal: AbortSignal.timeout(10000),
    });
    requireThat(r.ok, "identity_update_failed");
    return r;
  };
  // Keep application enrollment closed if a realm update or filesystem write fails.
  portal.registrationEnabled = false;
  await writeFile(portalPath + ".new", JSON.stringify(portal), { mode: 0o600 });
  await rename(portalPath + ".new", portalPath);
  if (request.enabled) {
    const actions = await (
      await admin("/authentication/required-actions")
    ).json();
    for (const alias of ["VERIFY_EMAIL", "CONFIGURE_TOTP"]) {
      const action = actions.find((x) => x.alias === alias);
      requireThat(action, "required_action_missing");
      await admin("/authentication/required-actions/" + alias, {
        method: "PUT",
        body: JSON.stringify({ ...action, enabled: true, defaultAction: true }),
      });
    }
  }
  await admin("", {
    method: "PUT",
    body: JSON.stringify({
      registrationAllowed: request.enabled,
      verifyEmail: true,
      resetPasswordAllowed: request.enabled,
      registrationEmailAsUsername: true,
      ...(request.enabled ? { smtpServer: request.smtp } : {}),
    }),
  });
  portal.registrationEnabled = request.enabled;
  await writeFile(portalPath + ".new", JSON.stringify(portal), { mode: 0o600 });
  await rename(portalPath + ".new", portalPath);
  console.log(
    "Registration configuration updated. Restart portal; no email sent and no review authority granted.",
  );
} catch {
  console.error(
    "Registration setup incomplete. Check private configuration; do not infer delivery or onboarding success.",
  );
  process.exitCode = 1;
}
