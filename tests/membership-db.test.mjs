// Run against a disposable synthetic PostgreSQL instance only.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { Repository } from "../apps/review-portal/repository.mjs";
import { Membership } from "../apps/review-portal/membership.mjs";
const config = process.env.TEST_REVIEW_DATABASE_URL
  ? { connectionString: process.env.TEST_REVIEW_DATABASE_URL }
  : process.env.TEST_REVIEW_PG_HOST
    ? {
        host: process.env.TEST_REVIEW_PG_HOST,
        user: "synthetic",
        database: "review_test",
      }
    : null;
test("membership authority lifecycle", { skip: !config }, async (t) => {
  const schema = "membership_" + randomBytes(5).toString("hex"),
    role = schema + "_runtime";
  const setup = new pg.Pool(config);
  await setup.query(`CREATE SCHEMA ${schema}; CREATE ROLE ${role} NOLOGIN`);
  const owner = new pg.Pool({ ...config, options: `-c search_path=${schema}` });
  let runtime;
  try {
    await owner.query(
      await readFile(
        new URL("../apps/review-portal/schema.sql", import.meta.url),
        "utf8",
      ),
    );
    await owner.query(
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
    await owner.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role};GRANT SELECT ON ALL TABLES IN SCHEMA ${schema} TO ${role};
   GRANT INSERT,UPDATE,DELETE ON sessions TO ${role};
   GRANT INSERT,UPDATE ON membership_applications TO ${role};GRANT INSERT ON membership_events TO ${role};
   GRANT USAGE ON ALL SEQUENCES IN SCHEMA ${schema} TO ${role};
   GRANT EXECUTE ON FUNCTION enroll_member(uuid,text,text,text),membership_decide(text,uuid,integer,text,text,integer,boolean),membership_revoke(text,uuid,text),membership_intake(text,boolean,text) TO ${role};`);
    runtime = new pg.Pool({
      ...config,
      options: `-c search_path=${schema} -c role=${role}`,
    });
    const repo = new Repository(runtime),
      members = new Membership(repo);
    async function actor(manager = false) {
      const a = {
        account_id: randomUUID(),
        token_hash: randomBytes(32).toString("hex"),
        mfa: true,
        auth_at: new Date(),
      };
      await owner.query(
        "INSERT INTO accounts(id,issuer,subject) VALUES($1,$2,$3)",
        [a.account_id, "https://synthetic.invalid", randomUUID()],
      );
      await owner.query(
        "INSERT INTO sessions(token_hash,account_id,csrf,auth_at,mfa,expires_at) VALUES($1,$2,'synthetic',$3,true,now()+interval '1 hour')",
        [a.token_hash, a.account_id, a.auth_at],
      );
      if (manager)
        await owner.query(
          "INSERT INTO membership_managers VALUES($1,now()+interval '1 day','synthetic operator','synthetic evidence')",
          [a.account_id],
        );
      return a;
    }
    const applicant = await actor(),
      other = await actor(),
      manager = await actor(true);
    const data = {
      role: "photo_contributor",
      name: "Synthetic Applicant",
      institution: "Synthetic University",
      experience: "Synthetic teaching experience",
      evidence: "Synthetic public reference",
      motivation: "Synthetic contribution intention",
      consent: true,
    };
    const decision = {
      decision: "approved",
      revision: 1,
      reason: "Synthetic verified reference and limited scope",
      days: 30,
      verified: true,
    };
    await t.test(
      "verified enrollment has zero authority and disabled identities stay disabled",
      async () => {
        const key = randomUUID();
        const r = await runtime.query("SELECT enroll_member($1,$2,$3,$4) id", [
          key,
          "https://synthetic.invalid",
          "new-member",
          "synthetic@example.invalid",
        ]);
        assert.equal(r.rows[0].id, key);
        assert.equal(
          (await owner.query("SELECT * FROM grants WHERE account_id=$1", [key]))
            .rowCount,
          0,
        );
        await owner.query("UPDATE accounts SET enabled=false WHERE id=$1", [
          key,
        ]);
        await assert.rejects(
          runtime.query("SELECT enroll_member($1,$2,$3,$4)", [
            randomUUID(),
            "https://synthetic.invalid",
            "new-member",
            "synthetic@example.invalid",
          ]),
          /account_unavailable/,
        );
      },
    );
    const app = await members.apply(applicant, data);
    await t.test("duplicate pending and other-member access fail", async () => {
      await assert.rejects(
        members.apply(applicant, data),
        /application_pending/,
      );
      assert.equal((await members.status(other)).applications.length, 0);
      await assert.rejects(members.queue(applicant), /manager_required/);
      await assert.rejects(members.withdraw(other, app.id), /not_found/);
      await assert.rejects(
        members.decide(applicant, app.id, decision),
        /manager_required/,
      );
    });
    await t.test(
      "manager cannot approve themselves or approve without verification",
      async () => {
        const own = await members.apply(manager, data);
        await assert.rejects(
          members.decide(manager, own.id, decision),
          /self_approval_forbidden/,
        );
        await assert.rejects(
          members.decide(manager, app.id, { ...decision, verified: false }),
          /verification_required/,
        );
        await assert.rejects(
          members.decide(manager, app.id, { ...decision, days: 91 }),
          /verification_required/,
        );
      },
    );
    await t.test("competing decisions create exactly one grant", async () => {
      const results = await Promise.allSettled([
        members.decide(manager, app.id, decision),
        members.decide(manager, app.id, decision),
      ]);
      assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
      assert.equal(
        (
          await owner.query("SELECT * FROM grants WHERE account_id=$1", [
            applicant.account_id,
          ])
        ).rowCount,
        1,
      );
    });
    await t.test(
      "manager alone cannot inspect photos; privacy reviewer required for intake",
      async () => {
        await assert.rejects(
          repo.grant(runtime, manager, "privacy_reviewer"),
          /permission_required/,
        );
        await assert.rejects(
          members.intake(manager, {
            enabled: true,
            reason: "Synthetic intake readiness check",
          }),
          /privacy_team_required/,
        );
        const p = await members.apply(other, {
          ...data,
          role: "privacy_reviewer",
        });
        await members.decide(manager, p.id, decision);
        await members.intake(manager, {
          enabled: true,
          reason: "Synthetic intake readiness confirmed",
        });
        assert.equal(await members.intakeOpen(), true);
      },
    );
    await t.test(
      "an upload waiting behind a pause cannot persist data",
      async () => {
        repo.vault = { space: async () => {} };
        repo.intakeGuard = (c) => members.requireIntake(c);
        const lock = await owner.connect();
        await lock.query("BEGIN");
        await lock.query("SELECT pg_advisory_xact_lock(50405)");
        const uploading = repo.chunk(
          applicant,
          randomUUID(),
          0,
          Buffer.from("test"),
        );
        const rejected = assert.rejects(uploading, /pilot_not_open/);
        await lock.query("UPDATE membership_settings SET photos_enabled=false");
        await lock.query("COMMIT");
        lock.release();
        await rejected;
        await members.intake(manager, {
          enabled: true,
          reason: "Synthetic resume after race test",
        });
      },
    );
    await t.test(
      "expired manager session and forged runtime DDL cannot grant authority",
      async () => {
        await assert.rejects(
          runtime.query("UPDATE grants SET expires_at=now()+interval '1 year'"),
          /permission denied/,
        );
        await assert.rejects(
          runtime.query(
            "INSERT INTO membership_managers VALUES($1,now()+interval '1 year','fake','fake')",
            [applicant.account_id],
          ),
          /permission denied/,
        );
        await owner.query(
          "UPDATE sessions SET auth_at=now()-interval '20 minutes' WHERE token_hash=$1",
          [manager.token_hash],
        );
        await assert.rejects(
          members.intake(manager, {
            enabled: false,
            reason: "Synthetic attempted expired operation",
          }),
          /manager_required/,
        );
        await owner.query(
          "UPDATE sessions SET auth_at=now() WHERE token_hash=$1",
          [manager.token_hash],
        );
      },
    );
    await t.test(
      "revocation removes sessions and automatically pauses intake without reviewer",
      async () => {
        const grant = (await members.status(other)).permissions[0];
        await members.revoke(manager, grant.id, {
          reason: "Synthetic removal of reviewer authority",
        });
        assert.equal(
          (
            await owner.query("SELECT * FROM sessions WHERE account_id=$1", [
              other.account_id,
            ])
          ).rowCount,
          0,
        );
        assert.equal(await members.intakeOpen(), false);
        await assert.rejects(members.status(other), /login_required/);
      },
    );
    await t.test(
      "withdrawal is terminal and manager expiry is enforced",
      async () => {
        const a = await members.apply(applicant, {
          ...data,
          role: "anatomy_reviewer",
        });
        await members.withdraw(applicant, a.id);
        await assert.rejects(
          members.decide(manager, a.id, decision),
          /stale_application/,
        );
        await owner.query(
          "UPDATE membership_managers SET expires_at=now()-interval '1 second'",
        );
        await assert.rejects(members.queue(manager), /manager_required/);
      },
    );
  } finally {
    if (runtime) await runtime.end();
    await owner.end();
    await setup.query(`DROP SCHEMA ${schema} CASCADE;DROP ROLE ${role}`);
    await setup.end();
  }
});
