import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  Denied,
  requireThat,
  LIMITS,
  id,
  packageInput,
  fileInput,
  decisionInput,
  freshReview,
  digest,
} from "./policy.mjs";

export class Repository {
  constructor(pool, vault, processor, erasures) {
    Object.assign(this, { pool, vault, processor, erasures });
  }
  async tx(fn) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock_shared(50405)");
      const result = await fn(c);
      await c.query("COMMIT");
      return result;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  async audit(c, actor, event, object) {
    await c.query(
      "INSERT INTO audit(actor_id,event,object_id) VALUES($1,$2,$3)",
      [actor, event, object],
    );
  }
  async active(c, s) {
    requireThat(!this.erasures?.failed, "erasure_journal_unavailable", 503);
    const r = await c.query("SELECT id FROM accounts WHERE id=$1 AND enabled", [
      s.account_id,
    ]);
    requireThat(r.rowCount, "account_unavailable", 403);
    const active = await c.query(
      "SELECT token_hash FROM sessions WHERE token_hash=$1 AND account_id=$2 AND expires_at>now() AND last_seen>now()-interval '15 minutes' FOR SHARE",
      [s.token_hash, s.account_id],
    );
    requireThat(active.rowCount, "login_required", 401);
  }
  async grant(c, s, role) {
    await this.active(c, s);
    const r = await c.query(
      "SELECT id FROM grants WHERE account_id=$1 AND role=$2 AND scope='photo_pilot' AND starts_at<=now() AND expires_at>now() AND revoked_at IS NULL",
      [s.account_id, role],
    );
    requireThat(r.rowCount, "permission_required", 403);
    return r.rows[0].id;
  }
  async access(
    c,
    s,
    packageId,
    { owner = false, review = false, receipt = false } = {},
  ) {
    requireThat(!this.erasures?.failed, "erasure_journal_unavailable", 503);
    requireThat(
      !this.erasures?.rows.some((x) => x.packageId === packageId),
      "not_found",
      404,
    );
    const r = await c.query(
      "SELECT * FROM packages WHERE id=$1 AND deleted_at IS NULL FOR UPDATE",
      [id(packageId)],
    );
    // A deletion may have appended its durable journal entry while this query
    // waited for the row lock, even if that deletion's SQL transaction failed.
    requireThat(!this.erasures?.failed, "erasure_journal_unavailable", 503);
    requireThat(
      !this.erasures?.rows.some((x) => x.packageId === packageId),
      "not_found",
      404,
    );
    requireThat(r.rowCount, "not_found", 404);
    const p = r.rows[0];
    if (p.owner_id === s.account_id) {
      requireThat(!review, "self_review_forbidden", 403);
      if (receipt) await this.active(c, s);
      else await this.grant(c, s, "photo_contributor");
    } else {
      requireThat(!owner, "not_found", 404);
      freshReview(s);
      await this.grant(c, s, "privacy_reviewer");
    }
    return p;
  }
  async photo(c, s, photoId, opts = {}) {
    const r = await c.query("SELECT package_id FROM photos WHERE id=$1", [
      id(photoId),
    ]);
    requireThat(r.rowCount, "not_found", 404);
    const p = await this.access(c, s, r.rows[0].package_id, opts);
    const f = (
      await c.query("SELECT * FROM photos WHERE id=$1 FOR UPDATE", [photoId])
    ).rows[0];
    requireThat(f.state !== "deleted", "not_found", 404);
    return { p, f };
  }
  async list(s) {
    return this.tx(async (c) => {
      await this.active(c, s);
      const grants = (
        await c.query(
          "SELECT role FROM grants WHERE account_id=$1 AND starts_at<=now() AND expires_at>now() AND revoked_at IS NULL AND scope='photo_pilot'",
          [s.account_id],
        )
      ).rows.map((x) => x.role);
      const review =
        s.mfa === true &&
        grants.includes("privacy_reviewer") &&
        Date.now() - new Date(s.auth_at).getTime() < 15 * 60 * 1000;
      const rows = await c.query(
        "SELECT id,owner_id=$1 AS owned,metadata,created_at FROM packages WHERE deleted_at IS NULL AND (owner_id=$1 OR $2) ORDER BY created_at DESC LIMIT 200",
        [s.account_id, review],
      );
      return {
        grants,
        reviewFresh: review,
        packages: rows.rows.filter(
          (p) => !this.erasures?.rows.some((e) => e.packageId === p.id),
        ),
      };
    });
  }
  async create(s, input) {
    const metadata = packageInput(input),
      packageId = id(input.id);
    return this.tx(async (c) => {
      await this.grant(c, s, "photo_contributor");
      await c.query("SELECT id FROM quota_lock WHERE id=1 FOR UPDATE");
      requireThat(
        !(
          await c.query(
            "SELECT package_id FROM tombstones WHERE package_id=$1",
            [packageId],
          )
        ).rowCount,
        "erased_id",
        409,
      );
      const previous = await c.query(
        "SELECT owner_id,metadata,deleted_at FROM packages WHERE id=$1",
        [packageId],
      );
      if (previous.rowCount) {
        requireThat(
          previous.rows[0].owner_id === s.account_id &&
            isDeepStrictEqual(previous.rows[0].metadata, metadata) &&
            !previous.rows[0].deleted_at,
          "idempotency_conflict",
          409,
        );
        return { id: packageId };
      }
      const count = await c.query(
        "SELECT count(*) FILTER (WHERE owner_id=$1) AS own,count(*) AS total FROM packages WHERE deleted_at IS NULL",
        [s.account_id],
      );
      requireThat(
        +count.rows[0].own < LIMITS.packages && +count.rows[0].total < 1000,
        "package_quota",
        429,
      );
      await c.query(
        "INSERT INTO packages(id,owner_id,metadata) VALUES($1,$2,$3)",
        [packageId, s.account_id, metadata],
      );
      await this.audit(c, s.account_id, "package_created", packageId);
      return { id: packageId };
    });
  }
  async detail(s, packageId) {
    return this.tx(async (c) => {
      const p = await this.access(c, s, packageId, { receipt: true });
      const files = (
        await c.query(
          "SELECT id,media_type,size,view_name,state,revision,info,created_at FROM photos WHERE package_id=$1 AND state<>'deleted' ORDER BY created_at",
          [packageId],
        )
      ).rows;
      const decisions = (
        await c.query(
          "SELECT d.photo_id,d.revision,d.decision,d.created_at FROM privacy_decisions d JOIN photos f ON f.id=d.photo_id WHERE f.package_id=$1 ORDER BY d.created_at",
          [packageId],
        )
      ).rows;
      await this.audit(c, s.account_id, "package_viewed", packageId);
      return {
        id: p.id,
        owned: p.owner_id === s.account_id,
        metadata: p.metadata,
        files,
        decisions,
      };
    });
  }
  async reserve(s, packageId, input) {
    const spec = fileInput(input),
      photoId = id(input.id);
    await this.vault.space();
    return this.tx(async (c) => {
      await c.query("SELECT id FROM quota_lock WHERE id=1 FOR UPDATE");
      await this.access(c, s, packageId, { owner: true });
      const old = (await c.query("SELECT * FROM photos WHERE id=$1", [photoId]))
        .rows[0];
      if (old) {
        requireThat(
          old.package_id === packageId &&
            old.size === spec.size &&
            old.media_type === spec.type &&
            old.view_name === spec.view &&
            old.state !== "deleted",
          "idempotency_conflict",
          409,
        );
        return { id: photoId, chunks: old.chunks.length, state: old.state };
      }
      const q = (
        await c.query(
          "SELECT coalesce(sum(f.size),0) AS total,coalesce(sum(f.size) FILTER(WHERE p.owner_id=$1),0) AS account,coalesce(sum(f.size) FILTER(WHERE p.id=$2),0) AS package,count(*) FILTER(WHERE p.id=$2) AS count FROM photos f JOIN packages p ON p.id=f.package_id WHERE p.deleted_at IS NULL AND f.state<>'deleted'",
          [s.account_id, packageId],
        )
      ).rows[0];
      requireThat(
        +q.total + spec.size <= LIMITS.global &&
          +q.account + spec.size <= LIMITS.account &&
          +q.package + spec.size <= LIMITS.package &&
          +q.count < LIMITS.files,
        "storage_quota",
        429,
      );
      await c.query(
        "INSERT INTO daily_quota(account_id,day) VALUES($1,current_date) ON CONFLICT DO NOTHING",
        [s.account_id],
      );
      const daily = (
        await c.query(
          "SELECT bytes FROM daily_quota WHERE account_id=$1 AND day=current_date FOR UPDATE",
          [s.account_id],
        )
      ).rows[0];
      requireThat(+daily.bytes + spec.size <= LIMITS.daily, "daily_quota", 429);
      await c.query(
        "UPDATE daily_quota SET bytes=bytes+$2 WHERE account_id=$1 AND day=current_date",
        [s.account_id, spec.size],
      );
      await c.query(
        "INSERT INTO photos(id,package_id,media_type,size,view_name,state) VALUES($1,$2,$3,$4,$5,'uploading')",
        [photoId, packageId, spec.type, spec.size, spec.view],
      );
      await this.audit(c, s.account_id, "photo_reserved", photoId);
      return { id: photoId, chunks: 0, state: "uploading" };
    });
  }
  async chunk(s, photoId, index, bytes) {
    requireThat(
      Number.isInteger(index) && index >= 0 && index < 20,
      "invalid_chunk",
    );
    requireThat(
      bytes.length > 0 && bytes.length <= LIMITS.chunk,
      "chunk_limit",
      413,
    );
    await this.vault.space();
    return this.tx(async (c) => {
      const { f } = await this.photo(c, s, photoId, { owner: true });
      requireThat(f.state === "uploading", "upload_closed", 409);
      const hash = digest(bytes);
      if (index < f.chunks.length) {
        requireThat(f.chunks[index] === hash, "chunk_conflict", 409);
        return { chunks: f.chunks.length };
      }
      requireThat(index === f.chunks.length, "chunk_order", 409);
      requireThat(
        bytes.length === Math.min(LIMITS.chunk, f.size - index * LIMITS.chunk),
        "chunk_size",
      );
      await this.vault.put(photoId, `chunk-${index}`, bytes);
      await c.query("UPDATE photos SET chunks=$2 WHERE id=$1", [
        photoId,
        JSON.stringify([...f.chunks, hash]),
      ]);
      return { chunks: index + 1 };
    });
  }
  async finalize(s, photoId) {
    requireThat(!this.finalizing, "processing_busy", 429);
    this.finalizing = true;
    try {
      return await this.finalizePhoto(s, photoId);
    } finally {
      this.finalizing = false;
    }
  }
  async finalizePhoto(s, photoId) {
    const lease = randomUUID();
    const f = await this.tx(async (c) => {
      const { f } = await this.photo(c, s, photoId, { owner: true });
      if (
        [
          "privacy_review",
          "privacy_cleared",
          "needs_information",
          "rejected",
        ].includes(f.state)
      )
        return f;
      requireThat(
        f.state !== "processing" ||
          Date.now() - new Date(f.lease_at).getTime() > 120000,
        "processing_busy",
        409,
      );
      requireThat(
        f.chunks.length === Math.ceil(f.size / LIMITS.chunk),
        "upload_incomplete",
        409,
      );
      await c.query(
        "UPDATE photos SET state='processing',lease=$2,lease_at=now() WHERE id=$1",
        [photoId, lease],
      );
      return f;
    });
    if (
      [
        "privacy_review",
        "privacy_cleared",
        "needs_information",
        "rejected",
      ].includes(f.state)
    )
      return { state: f.state };
    let output, raw;
    try {
      const chunks = [];
      for (let i = 0; i < f.chunks.length; i++) {
        const b = await this.vault.get(photoId, `chunk-${i}`);
        requireThat(digest(b) === f.chunks[i], "chunk_integrity", 409);
        chunks.push(b);
      }
      raw = Buffer.concat(chunks);
      requireThat(raw.length === f.size, "size_mismatch");
      output = await this.processor(raw, f.media_type);
    } catch (e) {
      await this.tx(async (c) => {
        await c.query(
          "UPDATE photos SET state='blocked',lease=NULL WHERE id=$1 AND lease=$2 AND state='processing'",
          [photoId, lease],
        );
        await this.audit(c, s.account_id, "processing_blocked", photoId);
      });
      throw new Denied(
        e instanceof Denied ? e.message : "processing_unavailable",
        503,
      );
    }
    const result = await this.tx(async (c) => {
      const { f: current } = await this.photo(c, s, photoId, { owner: true });
      requireThat(
        current.lease === lease && current.state === "processing",
        "processing_cancelled",
        409,
      );
      await this.vault.put(photoId, "raw", raw);
      await this.vault.put(photoId, "preview", output.bytes);
      await c.query(
        "UPDATE photos SET state='privacy_review',raw_fingerprint=$2,derivative_hash=$3,info=$4,lease=NULL,revision=revision+1 WHERE id=$1",
        [
          photoId,
          this.vault.fingerprint(raw),
          digest(output.bytes),
          output.info,
        ],
      );
      await this.audit(c, s.account_id, "photo_ready_for_privacy", photoId);
      return { state: "privacy_review" };
    });
    await this.vault.removeChunks(photoId);
    return result;
  }
  async preview(s, photoId) {
    return this.tx(async (c) => {
      const { f } = await this.photo(c, s, photoId);
      requireThat(
        [
          "privacy_review",
          "privacy_cleared",
          "needs_information",
          "rejected",
        ].includes(f.state),
        "preview_unavailable",
        409,
      );
      const bytes = await this.vault.get(photoId, "preview");
      requireThat(
        digest(bytes) === f.derivative_hash,
        "preview_integrity",
        503,
      );
      await this.audit(c, s.account_id, "private_preview_read", photoId);
      return bytes;
    });
  }
  async decide(s, photoId, input) {
    const d = decisionInput(input);
    freshReview(s);
    return this.tx(async (c) => {
      const { f } = await this.photo(c, s, photoId, { review: true });
      const grant = await this.grant(c, s, "privacy_reviewer");
      requireThat(
        [
          "privacy_review",
          "needs_information",
          "rejected",
          "privacy_cleared",
        ].includes(f.state),
        "not_reviewable",
        409,
      );
      requireThat(f.revision === d.revision, "stale_revision", 409);
      await c.query(
        "INSERT INTO privacy_decisions(id,photo_id,reviewer_id,grant_id,revision,derivative_hash,decision) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          randomUUID(),
          photoId,
          s.account_id,
          grant,
          f.revision,
          f.derivative_hash,
          d,
        ],
      );
      await c.query(
        "UPDATE photos SET state=$2,revision=revision+1 WHERE id=$1",
        [photoId, d.decision],
      );
      await this.audit(c, s.account_id, "privacy_decision", photoId);
      return { state: d.decision, revision: f.revision + 1 };
    });
  }
  async erase(s, packageId) {
    await this.tx(async (c) => {
      await this.access(c, s, packageId, { owner: true, receipt: true });
      requireThat(this.erasures, "erasure_journal_unavailable", 503);
      await this.erasures.append(packageId);
      await c.query(
        "INSERT INTO tombstones(package_id) VALUES($1) ON CONFLICT DO NOTHING",
        [packageId],
      );
      await c.query(
        "UPDATE packages SET deleted_at=now(),metadata='{}' WHERE id=$1",
        [packageId],
      );
      await c.query(
        "UPDATE photos SET state='deleted',lease=NULL,chunks='[]',raw_fingerprint=NULL,derivative_hash=NULL,info=NULL WHERE package_id=$1",
        [packageId],
      );
      await c.query(
        "UPDATE privacy_decisions SET decision=jsonb_build_object('erased',true),derivative_hash='' WHERE photo_id IN(SELECT id FROM photos WHERE package_id=$1)",
        [packageId],
      );
      await this.audit(c, s.account_id, "erasure_requested", packageId);
    });
    await this.purge();
    return { state: "deleted", backups: "expires_with_retention" };
  }
  async purge() {
    const packages = await this.pool.query(
      "SELECT id FROM packages WHERE deleted_at IS NOT NULL AND NOT purge_complete",
    );
    for (const p of packages.rows) {
      const photos = await this.pool.query(
        "SELECT id FROM photos WHERE package_id=$1",
        [p.id],
      );
      for (const f of photos.rows) await this.vault.remove(f.id);
      await this.vault.sync();
      await this.pool.query(
        "UPDATE packages SET purge_complete=true WHERE id=$1",
        [p.id],
      );
    }
  }
  async expire() {
    // Fixed, disclosed pilot retention, not an academic/publication retention rule.
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(50405)");
      const rows = await c.query(
        "SELECT p.id FROM packages p WHERE p.deleted_at IS NULL AND (p.created_at<now()-interval '30 days' OR (p.created_at<now()-interval '24 hours' AND NOT EXISTS(SELECT 1 FROM photos f WHERE f.package_id=p.id AND f.state IN('privacy_review','privacy_cleared','needs_information','rejected')))) FOR UPDATE",
      );
      for (const p of rows.rows) {
        await this.erasures.append(p.id);
        await this.audit(c, null, "pilot_retention_expired", p.id);
      }
      await c.query(
        "DELETE FROM sessions WHERE expires_at<now() OR last_seen<now()-interval '15 minutes'",
      );
      await c.query("DELETE FROM login_attempts WHERE expires_at<now()");
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
    await this.erasures.apply(this.pool);
    await this.purge();
  }
}
