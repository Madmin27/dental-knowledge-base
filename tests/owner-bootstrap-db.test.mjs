// Synthetic DB and isolated loopback only; fake IdP does not establish real delivery.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
const connection =
  process.env.TEST_REVIEW_DATABASE_URL ||
  (process.env.TEST_REVIEW_PG_HOST
    ? "postgresql://synthetic@localhost/review_test?host=" +
      encodeURIComponent(process.env.TEST_REVIEW_PG_HOST)
    : null);
test(
  "first owner stays subject to email verification, MFA and password change",
  { skip: !connection },
  async () => {
    const schema = "bootstrap_" + randomBytes(5).toString("hex");
    const setup = new pg.Pool({ connectionString: connection });
    await setup.query(`CREATE SCHEMA ${schema}`);
    const db = new URL(connection);
    db.searchParams.set("options", "-c search_path=" + schema);
    const pool = new pg.Pool({ connectionString: db.href });
    const scratch = await mkdtemp(tmpdir() + "/bootstrap-");
    let identity,
      enabled = false;
    const server = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      res.setHeader("Content-Type", "application/json");
      if (req.url.endsWith("/token"))
        return res.end(JSON.stringify({ access_token: "synthetic" }));
      if (req.method === "POST" && req.url.endsWith("/users")) {
        identity = JSON.parse(body);
        res.statusCode = 201;
        res.setHeader("Location", "/users/" + randomUUID());
        return res.end("{}");
      }
      if (req.method === "PUT") {
        enabled = JSON.parse(body).enabled;
        return res.end("{}");
      }
      res.statusCode = 404;
      res.end("{}");
    });
    try {
      await pool.query(
        await readFile(
          new URL("../apps/review-portal/schema.sql", import.meta.url),
          "utf8",
        ),
      );
      await pool.query(
        (
          await readFile(
            new URL("../apps/review-portal/membership.sql", import.meta.url),
            "utf8",
          )
        ).replaceAll(
          "search_path=public,pg_temp",
          `search_path=${schema},pg_temp`,
        ),
      );
      await new Promise((r) => server.listen(8079, "127.0.0.1", r));
      await writeFile(
        scratch + "/operator.json",
        JSON.stringify({
          databaseUrl: db.href,
          origin: "https://synthetic.invalid",
          issuer: "https://synthetic.invalid/realm",
          bootstrapPassword: "synthetic",
        }),
        { mode: 0o600 },
      );
      await writeFile(
        scratch + "/mail.json",
        JSON.stringify({ smtp: { from: "synthetic@gmail.com" } }),
        { mode: 0o600 },
      );
      const args = [
        "infra/review/bootstrap-owner.mjs",
        scratch + "/operator.json",
        scratch + "/mail.json",
        scratch + "/delivery.json",
      ];
      const output = await promisify(execFile)(process.execPath, args, {
        timeout: 15000,
      });
      const delivery = JSON.parse(
        await readFile(scratch + "/delivery.json", "utf8"),
      );
      assert.equal(identity.emailVerified, false);
      assert.equal(identity.enabled, false);
      assert.deepEqual(identity.requiredActions, [
        "UPDATE_PASSWORD",
        "CONFIGURE_TOTP",
        "VERIFY_EMAIL",
      ]);
      assert.equal(identity.credentials[0].temporary, true);
      assert.ok(delivery.temporaryPassword.length >= 14);
      assert.equal(
        (await stat(scratch + "/delivery.json")).mode & 0o777,
        0o600,
      );
      assert.equal(enabled, true);
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM membership_managers"))
          .rows[0].n,
        1,
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM grants")).rows[0].n,
        0,
      );
      assert.equal(output.stdout.includes(delivery.temporaryPassword), false);
      assert.equal(output.stdout.includes(identity.email), false);
      await assert.rejects(
        promisify(execFile)(process.execPath, args, { timeout: 15000 }),
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM accounts")).rows[0].n,
        1,
      );
    } finally {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      await pool.end();
      await setup.query(`DROP SCHEMA ${schema} CASCADE`);
      await setup.end();
      await rm(scratch, { recursive: true, force: true });
    }
  },
);
