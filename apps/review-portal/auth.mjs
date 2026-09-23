import * as oidc from "openid-client";
import { randomBytes } from "node:crypto";
import { digest, assurance, requireThat } from "./policy.mjs";

const secret = () => randomBytes(32).toString("hex");
export function cookie(req, name) {
  return String(req.headers.cookie ?? "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(name + "="))
    ?.slice(name.length + 1);
}
const setCookie = (name, value, seconds) =>
  `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
export class Auth {
  constructor(pool, { origin, issuer, clientId, clientSecret }) {
    Object.assign(this, { pool, origin, issuer, clientId, clientSecret });
  }
  async config() {
    if (!this.configuration)
      this.configuration = await oidc.discovery(
        new URL(this.issuer),
        this.clientId,
        this.clientSecret,
        undefined,
        { timeout: 10, execute: [oidc.enableNonRepudiationChecks] },
      );
    return this.configuration;
  }
  async begin(req, res) {
    const config = await this.config(),
      token = secret(),
      verifier = oidc.randomPKCECodeVerifier(),
      state = oidc.randomState(),
      nonce = oidc.randomNonce();
    await this.pool.query("DELETE FROM login_attempts WHERE expires_at<now()");
    const count = await this.pool.query("SELECT count(*) FROM login_attempts");
    requireThat(+count.rows[0].count < 500, "login_capacity", 429);
    await this.pool.query(
      "INSERT INTO login_attempts VALUES($1,$2,now()+interval '5 minutes')",
      [digest(token), { verifier, state, nonce }],
    );
    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: this.origin + "/review/callback",
      scope: "openid email",
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: "S256",
      state,
      nonce,
      prompt: "login",
      max_age: "0",
      ui_locales: cookie(req, "dental-language") === "tr" ? "tr" : "en",
    });
    res.writeHead(303, {
      Location: url.href,
      "Set-Cookie": setCookie("__Host-dental-login", token, 300),
    });
    res.end();
  }
  async callback(req, res) {
    const token = cookie(req, "__Host-dental-login");
    requireThat(/^[a-f0-9]{64}$/.test(token ?? ""), "login_expired", 401);
    const attempt = await this.pool.query(
      "DELETE FROM login_attempts WHERE token_hash=$1 AND expires_at>now() RETURNING payload",
      [digest(token)],
    );
    requireThat(attempt.rowCount, "login_expired", 401);
    const { verifier, state, nonce } = attempt.rows[0].payload;
    const result = await oidc.authorizationCodeGrant(
      await this.config(),
      new URL(req.url, this.origin),
      {
        pkceCodeVerifier: verifier,
        expectedState: state,
        expectedNonce: nonce,
        maxAge: 300,
      },
    );
    const claims = result.claims();
    assurance(claims);
    const account = await this.pool.query(
      "SELECT id FROM accounts WHERE issuer=$1 AND subject=$2 AND enabled",
      [this.issuer, claims.sub],
    );
    requireThat(account.rowCount, "invitation_required", 403);
    const session = secret();
    await this.pool.query(
      "DELETE FROM sessions WHERE account_id=$1 OR expires_at<now() OR last_seen<now()-interval '15 minutes'",
      [account.rows[0].id],
    );
    await this.pool.query(
      "INSERT INTO sessions(token_hash,account_id,csrf,auth_at,mfa,expires_at) VALUES($1,$2,$3,$4,true,now()+interval '1 hour')",
      [
        digest(session),
        account.rows[0].id,
        secret(),
        new Date(claims.auth_time * 1000),
      ],
    );
    res.writeHead(303, {
      Location: "/review/",
      "Set-Cookie": [
        setCookie("__Host-dental-session", session, 3600),
        setCookie("__Host-dental-login", "", 0),
      ],
    });
    res.end();
  }
  async session(req) {
    const token = cookie(req, "__Host-dental-session");
    if (!/^[a-f0-9]{64}$/.test(token ?? "")) return null;
    const r = await this.pool.query(
      "UPDATE sessions s SET last_seen=now() FROM accounts a WHERE s.token_hash=$1 AND s.account_id=a.id AND a.enabled AND s.expires_at>now() AND s.last_seen>now()-interval '15 minutes' RETURNING s.*",
      [digest(token)],
    );
    return r.rows[0] ?? null;
  }
  async logout(s, res) {
    await this.pool.query("DELETE FROM sessions WHERE token_hash=$1", [
      s.token_hash,
    ]);
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": setCookie("__Host-dental-session", "", 0),
    });
    res.end('{"ok":true}');
  }
}
