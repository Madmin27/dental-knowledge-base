import { randomUUID } from "node:crypto";
import { requireThat, text, id, freshReview, Denied } from "./policy.mjs";
export const membershipRoles = [
  "photo_contributor",
  "privacy_reviewer",
  "anatomy_reviewer",
];
export class Membership {
  constructor(repo) {
    this.repo = repo;
    this.pool = repo.pool;
  }
  async manager(c, s) {
    await this.repo.active(c, s);
    freshReview(s);
    requireThat(
      (
        await c.query(
          "SELECT 1 FROM membership_managers WHERE account_id=$1 AND expires_at>now()",
          [s.account_id],
        )
      ).rowCount,
      "manager_required",
      403,
    );
  }
  async requireIntake(c) {
    requireThat(await this.intakeOpen(c), "pilot_not_open", 503);
  }
  async intakeOpen(c = this.pool) {
    return (
      (
        await c.query(
          `SELECT photos_enabled AND EXISTS(SELECT 1 FROM grants g JOIN accounts a ON a.id=g.account_id WHERE a.enabled AND g.role='privacy_reviewer' AND g.scope='photo_pilot' AND g.revoked_at IS NULL AND g.starts_at<=now() AND g.expires_at>now()) AS enabled FROM membership_settings WHERE id=1`,
        )
      ).rows[0]?.enabled === true
    );
  }
  async intake(s, input) {
    freshReview(s);
    requireThat(typeof input.enabled === "boolean", "invalid_setting");
    const reason = text(input.reason, 2000);
    requireThat(reason.length >= 10, "reason_required");
    return this.authority("SELECT membership_intake($1,$2,$3)", [
      s.token_hash,
      input.enabled,
      reason,
    ]);
  }
  async status(s) {
    return this.repo.tx(async (c) => {
      await this.repo.active(c, s);
      const manager =
        (
          await c.query(
            "SELECT 1 FROM membership_managers WHERE account_id=$1 AND expires_at>now()",
            [s.account_id],
          )
        ).rowCount > 0;
      const applications = (
        await c.query(
          "SELECT * FROM membership_applications WHERE account_id=$1 ORDER BY created_at DESC LIMIT 50",
          [s.account_id],
        )
      ).rows;
      const permissions = (
        await c.query(
          "SELECT id,role,scope,expires_at,revoked_at,revoke_reason FROM grants WHERE account_id=$1 ORDER BY starts_at DESC LIMIT 50",
          [s.account_id],
        )
      ).rows;
      return { manager, applications, permissions };
    });
  }
  async apply(s, input) {
    requireThat(membershipRoles.includes(input.role), "invalid_role");
    requireThat(input.consent === true, "application_consent_required");
    const profile = {
      name: text(input.name, 150),
      institution: text(input.institution, 250),
      experience: text(input.experience, 2000),
      evidence: text(input.evidence, 1000),
      motivation: text(input.motivation, 2000),
      consentVersion: "membership-v1",
    };
    return this.repo.tx(async (c) => {
      await this.repo.active(c, s);
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 726))", [
        s.account_id,
      ]);
      requireThat(
        +(
          await c.query(
            "SELECT count(*) FROM membership_applications WHERE account_id=$1 AND created_at>now()-interval '30 days'",
            [s.account_id],
          )
        ).rows[0].count < 5,
        "application_limit",
        429,
      );
      requireThat(
        !(
          await c.query(
            "SELECT 1 FROM membership_applications WHERE account_id=$1 AND role=$2 AND status='pending'",
            [s.account_id, input.role],
          )
        ).rowCount,
        "application_pending",
        409,
      );
      const application = randomUUID();
      await c.query(
        "INSERT INTO membership_applications(id,account_id,role,profile) VALUES($1,$2,$3,$4)",
        [application, s.account_id, input.role, profile],
      );
      await c.query(
        "INSERT INTO membership_events(actor_id,application_id,event,reason) VALUES($1,$2,'submitted','Applicant submitted membership-v1 consent')",
        [s.account_id, application],
      );
      return { id: application };
    });
  }
  async withdraw(s, application) {
    return this.repo.tx(async (c) => {
      await this.repo.active(c, s);
      requireThat(
        (
          await c.query(
            "UPDATE membership_applications SET status='withdrawn',revision=revision+1 WHERE id=$1 AND account_id=$2 AND status='pending' RETURNING id",
            [id(application), s.account_id],
          )
        ).rowCount,
        "not_found",
        404,
      );
      await c.query(
        "INSERT INTO membership_events(actor_id,application_id,event,reason) VALUES($1,$2,'withdrawn','Applicant withdrew application')",
        [s.account_id, application],
      );
      return { ok: true };
    });
  }
  async queue(s, page = 0) {
    requireThat(
      Number.isInteger(page) && page >= 0 && page <= 10000,
      "invalid_page",
    );
    return this.repo.tx(async (c) => {
      await this.manager(c, s);
      return {
        applications: (
          await c.query(
            `SELECT m.*,p.email,a.enabled,g.expires_at,g.revoked_at
    FROM membership_applications m JOIN accounts a ON a.id=m.account_id LEFT JOIN member_profiles p ON p.account_id=m.account_id LEFT JOIN grants g ON g.id=m.grant_id
    ORDER BY (m.status='pending') DESC,m.created_at DESC,m.id LIMIT 25 OFFSET $1`,
            [page * 25],
          )
        ).rows,
        page,
      };
    });
  }
  async decide(s, application, input) {
    freshReview(s);
    requireThat(
      ["approved", "rejected"].includes(input.decision),
      "invalid_decision",
    );
    requireThat(Number.isInteger(input.revision), "invalid_revision");
    const reason = text(input.reason, 2000);
    requireThat(reason.length >= 10, "reason_required");
    if (input.decision === "approved")
      requireThat(
        input.verified === true &&
          Number.isInteger(input.days) &&
          input.days >= 1 &&
          input.days <= 90,
        "verification_required",
      );
    return this.authority("SELECT membership_decide($1,$2,$3,$4,$5,$6,$7)", [
      s.token_hash,
      id(application),
      input.revision,
      input.decision,
      reason,
      input.days ?? null,
      input.verified === true,
    ]);
  }
  async revoke(s, grant, input) {
    freshReview(s);
    const reason = text(input.reason, 2000);
    requireThat(reason.length >= 10, "reason_required");
    return this.authority("SELECT membership_revoke($1,$2,$3)", [
      s.token_hash,
      id(grant),
      reason,
    ]);
  }
  async authority(sql, args) {
    try {
      await this.pool.query(sql, args);
      return { ok: true };
    } catch (e) {
      if (
        [
          "manager_required",
          "self_approval_forbidden",
          "stale_application",
          "verification_required",
          "grant_unavailable",
          "account_unavailable",
          "privacy_team_required",
        ].includes(e.message)
      )
        throw new Denied(
          e.message,
          e.message === "stale_application" ? 409 : 403,
        );
      throw e;
    }
  }
}
