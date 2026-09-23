// Dedicated disposable PostgreSQL only. Never point this test at the application DB.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile, mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { Repository } from "../apps/review-portal/repository.mjs";
import {
  Erasures,
  reconcileLedgers,
  verifyLedger,
} from "../apps/review-portal/erasures.mjs";
import { Vault } from "../apps/review-portal/vault.mjs";
import { createServer } from "../apps/review-portal/server.mjs";
import { LIMITS } from "../apps/review-portal/policy.mjs";
const config =
  process.env.TEST_REVIEW_DATABASE_URL ??
  (process.env.TEST_REVIEW_PG_HOST
    ? {
        host: process.env.TEST_REVIEW_PG_HOST,
        user: "synthetic",
        database: "review_test",
      }
    : null);
test(
  "isolated private-photo lifecycle and negative authority boundaries",
  { skip: !config },
  async (t) => {
    const pool = new pg.Pool(
        typeof config === "string" ? { connectionString: config } : config,
      ),
      root = await mkdtemp(join(tmpdir(), "review-fixture-"));
    const schema = "fixture_" + randomBytes(6).toString("hex");
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.end();
    const db = new pg.Pool({
      ...(typeof config === "string" ? { connectionString: config } : config),
      options: `-c search_path=${schema}`,
      max: 8,
    });
    let server, runtime;
    const role = schema + "_runtime";
    try {
      await db.query(
        await readFile(
          new URL("../apps/review-portal/schema.sql", import.meta.url),
          "utf8",
        ),
      );
      await db.query(`CREATE ROLE ${role} NOLOGIN;
        GRANT USAGE ON SCHEMA ${schema} TO ${role};
        GRANT SELECT ON accounts,grants TO ${role};
        GRANT SELECT,INSERT,UPDATE,DELETE ON sessions,login_attempts TO ${role};
        GRANT SELECT,INSERT,UPDATE ON packages,photos,privacy_decisions,daily_quota,tombstones TO ${role};
        GRANT SELECT,UPDATE ON quota_lock TO ${role};
        GRANT SELECT,INSERT ON audit TO ${role};
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA ${schema} TO ${role};`);
      runtime = new pg.Pool({
        ...(typeof config === "string" ? { connectionString: config } : config),
        options: `-c search_path=${schema} -c role=${role}`,
        max: 8,
      });
      const vault = new Vault(join(root, "vault"), randomBytes(32));
      await vault.init();
      vault.space = async () => {};
      const erasures = new Erasures(join(root, "erasures.jsonl"), vault.key);
      await erasures.init({ create: true });
      const preview = Buffer.from([255, 216, 255, 217]);
      let failScan = false,
        pauseProcessing = null;
      const repo = new Repository(
        runtime,
        vault,
        async () => {
          if (failScan) throw new Error("scanner offline");
          if (pauseProcessing) await pauseProcessing();
          return {
            bytes: preview,
            info: {
              width: 1,
              height: 1,
              metadataRemoved: true,
              scanner: "clean",
            },
          };
        },
        erasures,
      );
      async function actor(role) {
        const account_id = randomUUID(),
          token_hash = randomBytes(32).toString("hex"),
          csrf = randomBytes(32).toString("hex"),
          auth_at = new Date();
        await db.query(
          "INSERT INTO accounts(id,issuer,subject) VALUES($1,$2,$3)",
          [account_id, "https://synthetic.invalid", "synthetic-" + account_id],
        );
        await db.query(
          "INSERT INTO sessions VALUES($1,$2,$3,$4,true,now()+interval '1 hour',now())",
          [token_hash, account_id, csrf, auth_at],
        );
        const grant = randomUUID();
        await db.query(
          "INSERT INTO grants(id,account_id,role,scope,expires_at,granted_by,evidence_ref) VALUES($1,$2,$3,'photo_pilot',now()+interval '1 day','synthetic operator','synthetic fixture')",
          [grant, account_id, role],
        );
        return { account_id, token_hash, csrf, auth_at, mfa: true, grant };
      }
      const a = await actor("photo_contributor"),
        b = await actor("photo_contributor"),
        r = await actor("privacy_reviewer");
      const input = {
        id: randomUUID(),
        modality: "photo",
        purpose: "Synthetic photo study",
        authorityReference: "Synthetic permission record",
        fdi: "unknown",
        sameSpecimen: true,
        noPatientIdentifiers: true,
        consent: {
          privateInspection: true,
          processing: true,
          inference: false,
          derivativePublication: false,
          rawPublication: false,
          training: false,
        },
      };
      const p = await repo.create(a, input);
      assert.equal((await repo.create(a, input)).id, p.id);
      await assert.rejects(repo.create(b, input));
      await t.test(
        "unrelated account cannot list or read package, reserve files or delete",
        async () => {
          assert.equal((await repo.list(b)).packages.length, 0);
          await assert.rejects(repo.detail(b, p.id));
          await assert.rejects(
            repo.reserve(b, p.id, {
              id: randomUUID(),
              type: "image/png",
              size: 4,
              view: "unknown",
            }),
          );
          await assert.rejects(repo.erase(b, p.id));
        },
      );
      const f = randomUUID();
      await repo.reserve(a, p.id, {
        id: f,
        type: "image/png",
        size: 4,
        view: "unknown",
      });
      await t.test(
        "resumable chunks enforce ownership, exact bytes, order and idempotency",
        async () => {
          await assert.rejects(repo.chunk(b, f, 0, Buffer.from("test")));
          await assert.rejects(repo.chunk(a, f, 1, Buffer.from("test")));
          await assert.rejects(repo.finalize(a, f));
          await assert.rejects(repo.chunk(a, f, 0, Buffer.from("too long")));
          await repo.chunk(a, f, 0, Buffer.from("test"));
          await repo.chunk(a, f, 0, Buffer.from("test"));
          await assert.rejects(repo.chunk(a, f, 0, Buffer.from("diff")));
        },
      );
      await t.test(
        "scanner failure leaves quarantine closed and retry succeeds",
        async () => {
          failScan = true;
          await assert.rejects(repo.finalize(a, f), /processing_unavailable/);
          await assert.rejects(repo.preview(a, f));
          failScan = false;
          assert.equal((await repo.finalize(a, f)).state, "privacy_review");
          assert.deepEqual(await repo.preview(a, f), preview);
          await assert.rejects(repo.preview(b, f));
        },
      );
      const decision = {
        decision: "privacy_cleared",
        revision: 2,
        reason: "Synthetic pixels inspected for private scope",
        checks: { pixels: true, metadata: true, authority: true, scope: true },
        riskTags: ["specimen_only"],
      };
      await t.test(
        "owner cannot review own photo and stale review cannot overwrite",
        async () => {
          await assert.rejects(repo.decide(a, f, decision), /self_review/);
          const results = await Promise.allSettled([
            repo.decide(r, f, decision),
            repo.decide(r, f, decision),
          ]);
          assert.equal(
            results.filter((x) => x.status === "fulfilled").length,
            1,
          );
          assert.equal(
            results.filter((x) => x.status === "rejected").length,
            1,
          );
        },
      );
      await t.test(
        "expired, revoked and stale-auth reviewer cannot read or decide",
        async () => {
          await assert.rejects(
            repo.preview({ ...r, auth_at: new Date(0) }, f),
            /reauthenticate/,
          );
          await db.query(
            "UPDATE grants SET expires_at=now()-interval '1 second',starts_at=now()-interval '1 day' WHERE id=$1",
            [r.grant],
          );
          await assert.rejects(repo.preview(r, f));
          await db.query(
            "UPDATE grants SET expires_at=now()+interval '1 day',revoked_at=now() WHERE id=$1",
            [r.grant],
          );
          await assert.rejects(repo.preview(r, f));
        },
      );
      await t.test(
        "concurrent reservations cannot overrun account daily quota",
        async () => {
          await db.query(
            "UPDATE daily_quota SET bytes=$2 WHERE account_id=$1",
            [a.account_id, LIMITS.daily - 4],
          );
          const results = await Promise.allSettled([
            repo.reserve(a, p.id, {
              id: randomUUID(),
              type: "image/png",
              size: 4,
              view: "front",
            }),
            repo.reserve(a, p.id, {
              id: randomUUID(),
              type: "image/png",
              size: 4,
              view: "front",
            }),
          ]);
          assert.equal(
            results.filter((x) => x.status === "fulfilled").length,
            1,
          );
          assert.equal(
            results.filter((x) => x.status === "rejected").length,
            1,
          );
        },
      );
      await t.test(
        "HTTP rejects missing session and forged origin/CSRF",
        async () => {
          server = createServer({
            repo,
            auth: {
              session: async (req) =>
                req.headers.cookie === "fixture" ? a : null,
            },
            origin: "http://127.0.0.1:19089",
            uploadsEnabled: true,
          });
          await new Promise((resolve) =>
            server.listen(19089, "127.0.0.1", resolve),
          );
          const url = "http://127.0.0.1:19089/review/api/packages/" + p.id;
          assert.equal((await fetch(url)).status, 401);
          assert.equal(
            (
              await fetch(url, {
                method: "DELETE",
                headers: {
                  cookie: "fixture",
                  Origin: "https://evil.invalid",
                  "X-CSRF-Token": a.csrf,
                },
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await fetch(url, {
                method: "DELETE",
                headers: {
                  cookie: "fixture",
                  Origin: "http://127.0.0.1:19089",
                },
              })
            ).status,
            403,
          );
        },
      );
      await t.test(
        "erasure hides reads, purges bytes and keeps no private decision prose",
        async () => {
          await db.query("UPDATE grants SET revoked_at=now() WHERE id=$1", [
            a.grant,
          ]);
          await assert.rejects(
            repo.reserve(a, p.id, {
              id: randomUUID(),
              type: "image/png",
              size: 4,
              view: "unknown",
            }),
          );
          await repo.erase(a, p.id);
          await assert.rejects(repo.preview(a, f));
          await assert.rejects(repo.finalize(a, f));
          await assert.rejects(repo.detail(a, p.id));
          assert.deepEqual(await readdir(vault.root), []);
          assert.equal(
            (
              await db.query(
                "SELECT count(*) FROM tombstones WHERE package_id=$1",
                [p.id],
              )
            ).rows[0].count,
            "1",
          );
          assert.deepEqual(
            (
              await db.query(
                "SELECT decision FROM privacy_decisions WHERE photo_id=$1",
                [f],
              )
            ).rows[0].decision,
            { erased: true },
          );
        },
      );
      await t.test(
        "old snapshot cannot revive an erased package; divergent journal fails closed",
        async () => {
          const current = verifyLedger(
            await readFile(erasures.path, "utf8"),
            vault.key,
          );
          assert.equal(reconcileLedgers([], current).length, 1);
          assert.throws(() => reconcileLedgers(current, []));
          assert.throws(() =>
            verifyLedger(
              JSON.stringify({ ...current[0], packageId: randomUUID() }) + "\n",
              vault.key,
            ),
          );
          await db.query(
            "UPDATE packages SET deleted_at=NULL,purge_complete=false,metadata=$2 WHERE id=$1",
            [p.id, input],
          );
          await db.query(
            "UPDATE photos SET state='privacy_review' WHERE id=$1",
            [f],
          );
          await vault.put(f, "preview", preview);
          await erasures.apply(db);
          await repo.purge();
          await assert.rejects(repo.detail(a, p.id));
          assert.deepEqual(await readdir(vault.root), []);
        },
      );
      await t.test(
        "journal append followed by database rollback blocks reads before restart",
        async () => {
          const extra = await repo.create(b, { ...input, id: randomUUID() }),
            photo = randomUUID();
          await repo.reserve(b, extra.id, {
            id: photo,
            type: "image/png",
            size: 4,
            view: "unknown",
          });
          await repo.chunk(b, photo, 0, Buffer.from("test"));
          await repo.finalize(b, photo);
          await db.query(`CREATE FUNCTION fail_erasure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN RAISE EXCEPTION 'synthetic_database_failure'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER fail_erasure BEFORE UPDATE ON packages FOR EACH ROW EXECUTE FUNCTION fail_erasure();`);
          await assert.rejects(
            repo.erase(b, extra.id),
            /synthetic_database_failure/,
          );
          await assert.rejects(repo.preview(b, photo), /not_found/);
          await db.query(
            "DROP TRIGGER fail_erasure ON packages; DROP FUNCTION fail_erasure()",
          );
          await erasures.apply(runtime);
          await repo.purge();
          assert.deepEqual(await readdir(vault.root), []);
        },
      );
      await t.test(
        "access waiting on an erasure lock rechecks the journal after rollback",
        async () => {
          const extra = await repo.create(b, { ...input, id: randomUUID() });
          const lock = await db.connect();
          let entered;
          const waiting = new Promise((resolve) => (entered = resolve));
          await lock.query("BEGIN");
          await lock.query("SELECT id FROM packages WHERE id=$1 FOR UPDATE", [
            extra.id,
          ]);
          const access = repo.tx((c) =>
            repo.access(
              {
                query(...args) {
                  const result = c.query(...args);
                  if (args[0].includes("SELECT * FROM packages")) entered();
                  return result;
                },
              },
              b,
              extra.id,
              { receipt: true },
            ),
          );
          const rejected = assert.rejects(access, /not_found/);
          try {
            await waiting;
            await erasures.append(extra.id);
          } finally {
            await lock.query("ROLLBACK");
            lock.release();
          }
          await rejected;
          await erasures.apply(runtime);
        },
      );
      await t.test(
        "late processor completion cannot resurrect a deleted photo",
        async () => {
          const extra = await repo.create(b, { ...input, id: randomUUID() }),
            photo = randomUUID();
          await repo.reserve(b, extra.id, {
            id: photo,
            type: "image/png",
            size: 4,
            view: "unknown",
          });
          await repo.chunk(b, photo, 0, Buffer.from("test"));
          let release, started;
          const running = new Promise((resolve) => (started = resolve));
          pauseProcessing = () =>
            new Promise((resolve) => {
              release = resolve;
              started();
            });
          const job = repo.finalize(b, photo);
          await running;
          await repo.erase(b, extra.id);
          release();
          await assert.rejects(job, /not_found/);
          pauseProcessing = null;
          assert.deepEqual(await readdir(vault.root), []);
        },
      );
      await t.test(
        "runtime cannot grant itself authority or create schema objects",
        async () => {
          await assert.rejects(
            runtime.query("UPDATE accounts SET enabled=false"),
            /permission denied/,
          );
          await assert.rejects(
            runtime.query("DELETE FROM grants"),
            /permission denied/,
          );
          await assert.rejects(
            runtime.query("CREATE TABLE forbidden(x int)"),
            /permission denied/,
          );
        },
      );
      await t.test(
        "disabled account and revoked session fail despite previously resolved session",
        async () => {
          await db.query("DELETE FROM sessions WHERE token_hash=$1", [
            b.token_hash,
          ]);
          await assert.rejects(repo.list(b), /login_required/);
          await db.query("UPDATE accounts SET enabled=false WHERE id=$1", [
            a.account_id,
          ]);
          await assert.rejects(repo.list(a), /account_unavailable/);
        },
      );
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (runtime) await runtime.end();
      await db.query(`DROP SCHEMA ${schema} CASCADE`);
      await db.query(`DROP ROLE IF EXISTS ${role}`);
      await db.end();
      await rm(root, { recursive: true, force: true });
    }
  },
);
