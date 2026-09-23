// One-time operator setup. Secrets are written only under the supplied private directory.
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
const [dir, uid, gid] = process.argv.slice(2);
if (
  !dir?.startsWith("/") ||
  !/^\d+$/.test(uid ?? "") ||
  !/^\d+$/.test(gid ?? "")
)
  throw new Error("Usage: node prepare.mjs /etc/dental-review UID GID");
await mkdir(dir, { recursive: true, mode: 0o700 });
try {
  await access(join(dir, "portal.json"));
  throw new Error("Refusing to replace existing configuration");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const secret = () => randomBytes(32).toString("hex");
const postgres = secret(),
  identity = secret(),
  runtime = secret(),
  owner = secret(),
  bootstrap = secret(),
  client = secret(),
  vaultKey = secret();
const origin = "https://dentalopensource.org",
  issuer = origin + "/auth/realms/dental";
const write = (name, value, mode = 0o600) =>
  writeFile(join(dir, name), value, { mode, flag: "wx" });
await write(
  "compose.env",
  `REVIEW_CONFIG_DIR=${dir}\nREVIEW_UID=${uid}\nREVIEW_GID=${gid}\nPOSTGRES_PASSWORD=${postgres}\nIDENTITY_DB_PASSWORD=${identity}\nBOOTSTRAP_PASSWORD=${bootstrap}\n`,
);
await write(
  "portal.json",
  JSON.stringify({
    origin,
    issuer,
    clientId: "dental-review",
    clientSecret: client,
    vaultKey,
    databaseUrl: `postgresql://dental_runtime:${runtime}@127.0.0.1:55433/dental_review`,
  }),
);
await write(
  "operator.json",
  JSON.stringify({
    origin,
    issuer,
    databaseUrl: `postgresql://dental_owner:${owner}@127.0.0.1:55433/dental_review`,
    postgresPassword: postgres,
    bootstrapPassword: bootstrap,
  }),
);
await write("backup.key", secret());
await write(
  "init.sql",
  `CREATE USER dental_identity WITH PASSWORD '${identity}';
CREATE DATABASE dental_identity OWNER dental_identity;
CREATE USER dental_owner WITH PASSWORD '${owner}';
CREATE USER dental_runtime WITH PASSWORD '${runtime}';
CREATE DATABASE dental_review OWNER dental_owner;
REVOKE ALL ON DATABASE dental_identity FROM PUBLIC;
REVOKE ALL ON DATABASE dental_review FROM PUBLIC;
GRANT CONNECT ON DATABASE dental_review TO dental_runtime;
\\connect dental_review
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO dental_runtime;
`,
  0o644,
);
const realm = {
  realm: "dental",
  enabled: true,
  displayName: "Dental Open Source",
  registrationAllowed: false,
  resetPasswordAllowed: false,
  rememberMe: false,
  verifyEmail: true,
  loginWithEmailAllowed: true,
  duplicateEmailsAllowed: false,
  bruteForceProtected: true,
  permanentLockout: false,
  maxFailureWaitSeconds: 900,
  waitIncrementSeconds: 60,
  failureFactor: 5,
  ssoSessionIdleTimeout: 900,
  ssoSessionMaxLifespan: 3600,
  accessTokenLifespan: 300,
  sslRequired: "external",
  internationalizationEnabled: true,
  supportedLocales: ["en", "tr"],
  defaultLocale: "en",
  passwordPolicy: "length(14) and notUsername and notEmail",
  otpPolicyType: "totp",
  otpPolicyAlgorithm: "HmacSHA1",
  otpPolicyDigits: 6,
  otpPolicyPeriod: 30,
  otpPolicyLookAheadWindow: 1,
  browserFlow: "dental-mfa",
  authenticatorConfig: [
    {
      alias: "password-reference",
      config: {
        "default.reference.value": "pwd",
        "default.reference.maxAge": "900",
      },
    },
    {
      alias: "otp-reference",
      config: {
        "default.reference.value": "otp",
        "default.reference.maxAge": "900",
      },
    },
  ],
  authenticationFlows: [
    {
      alias: "dental-mfa",
      providerId: "basic-flow",
      topLevel: true,
      builtIn: false,
      authenticationExecutions: [
        {
          authenticator: "auth-username-password-form",
          requirement: "REQUIRED",
          priority: 10,
          authenticatorFlow: false,
          authenticatorConfig: "password-reference",
        },
        {
          authenticator: "auth-otp-form",
          requirement: "REQUIRED",
          priority: 20,
          authenticatorFlow: false,
          authenticatorConfig: "otp-reference",
        },
      ],
    },
  ],
  clients: [
    {
      clientId: "dental-review",
      name: "Dental Open Source private workspace",
      enabled: true,
      publicClient: false,
      secret: client,
      standardFlowEnabled: true,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
      redirectUris: [origin + "/review/callback"],
      webOrigins: [origin],
      attributes: { "pkce.code.challenge.method": "S256" },
      defaultClientScopes: ["basic", "email"],
      protocolMappers: [
        {
          name: "authentication-methods",
          protocol: "openid-connect",
          protocolMapper: "oidc-amr-mapper",
          config: { "id.token.claim": "true", "access.token.claim": "true" },
        },
      ],
    },
  ],
};
await write("realm.json", JSON.stringify(realm, null, 2), 0o644);
console.log(
  "Private configuration created; no accounts or academic authorities assigned.",
);
