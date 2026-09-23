// Optional real-provider fixture. Requires an isolated synthetic Keycloak realm.
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import * as oidc from "openid-client";
import { Auth } from "../apps/review-portal/auth.mjs";

const issuer = process.env.TEST_OIDC_ISSUER;
test(
  "real isolated Keycloak password + OTP -> OIDC -> opaque application session",
  { skip: !issuer },
  async () => {
    const attempts = new Map();
    let storedSession;
    const pool = {
      async query(sql, args = []) {
        if (sql.startsWith("SELECT count"))
          return { rows: [{ count: attempts.size }] };
        if (sql.startsWith("INSERT INTO login_attempts")) {
          attempts.set(args[0], args[1]);
          return { rowCount: 1 };
        }
        if (sql.startsWith("DELETE FROM login_attempts WHERE token_hash")) {
          const payload = attempts.get(args[0]);
          attempts.delete(args[0]);
          return {
            rowCount: payload ? 1 : 0,
            rows: payload ? [{ payload }] : [],
          };
        }
        if (sql.startsWith("SELECT id FROM accounts"))
          return {
            rowCount:
              args[0] === issuer &&
              args[1] === "00000000-0000-4000-8000-000000000001"
                ? 1
                : 0,
            rows: [{ id: "00000000-0000-4000-8000-000000000002" }],
          };
        if (sql.startsWith("INSERT INTO sessions")) storedSession = args;
        return { rowCount: 0, rows: [] };
      },
    };
    const auth = new Auth(pool, {
      origin: "http://127.0.0.1:19089",
      issuer,
      clientId: "dental-review",
      clientSecret: "synthetic-oidc-client-only",
    });
    auth.configuration = await oidc.discovery(
      new URL(issuer),
      "dental-review",
      "synthetic-oidc-client-only",
      undefined,
      {
        execute: [oidc.allowInsecureRequests, oidc.enableNonRepudiationChecks],
      },
    );
    function response() {
      return {
        writeHead(status, headers) {
          this.status = status;
          this.headers = headers;
        },
        end() {},
      };
    }
    const start = response();
    await auth.begin({ headers: {} }, start);
    assert.equal(start.status, 303);
    const loginCookie = start.headers["Set-Cookie"].split(";")[0];
    const jar = new Map();
    async function request(url, options = {}) {
      const res = await fetch(url, {
        ...options,
        redirect: "manual",
        headers: {
          ...options.headers,
          cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
        },
      });
      for (const value of res.headers.getSetCookie()) {
        const pair = value.split(";")[0],
          at = pair.indexOf("=");
        jar.set(pair.slice(0, at), pair.slice(at + 1));
      }
      return res;
    }
    const first = await request(start.headers.Location);
    assert.equal(first.status, 200);
    const form = (html) => {
      const action = html.match(/<form[^>]*action="([^"]+)"/);
      assert.ok(action, "provider form present");
      return action[1].replaceAll("&amp;", "&");
    };
    const passwordPage = await first.text();
    const afterPassword = await request(form(passwordPage), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: "synthetic-user",
        password: "synthetic-password-only",
        credentialId: "",
      }),
    });
    assert.equal(afterPassword.status, 200);
    const otpPage = await afterPassword.text();
    assert.match(otpPage, /name="otp"/);
    const secret = Buffer.from("JBSWY3DPEHPK3PXP", "utf8"),
      counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
    const mac = createHmac("sha1", secret).update(counter).digest(),
      offset = mac[19] & 15;
    const otp = String(
      (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000,
    ).padStart(6, "0");
    const afterOtp = await request(form(otpPage), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ otp, login: "Sign In" }),
    });
    assert.equal(afterOtp.status, 302, "provider completes real OTP");
    const callback = new URL(afterOtp.headers.get("location"));
    const response1 = response();
    await auth.callback(
      {
        headers: { cookie: loginCookie },
        url: callback.pathname + callback.search,
      },
      response1,
    );
    assert.equal(response1.status, 303);
    assert.ok(storedSession);
    assert.match(storedSession[0], /^[a-f0-9]{64}$/);
    assert.match(
      response1.headers["Set-Cookie"][0],
      /Secure; HttpOnly; SameSite=Lax/,
    );
    await assert.rejects(
      auth.callback(
        {
          headers: { cookie: loginCookie },
          url: callback.pathname + callback.search,
        },
        response(),
      ),
      /login_expired/,
    );
    const start2 = response();
    await auth.begin({ headers: {} }, start2);
    await assert.rejects(
      auth.callback(
        {
          headers: { cookie: start2.headers["Set-Cookie"].split(";")[0] },
          url: "/review/callback?code=synthetic-invalid&state=wrong",
        },
        response(),
      ),
    );
  },
);
