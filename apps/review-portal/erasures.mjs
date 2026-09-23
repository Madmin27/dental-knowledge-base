import { createHmac } from "node:crypto";
import { readFile, open, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { id, requireThat, equal } from "./policy.mjs";

export function verifyLedger(content, key) {
  requireThat(
    Buffer.byteLength(content) <= 16 * 1024 ** 2,
    "erasure_ledger_limit",
    503,
  );
  const rows = [];
  let previous = "0".repeat(64);
  for (const line of content.split("\n").filter(Boolean)) {
    const entry = JSON.parse(line);
    id(entry.packageId);
    requireThat(
      entry.sequence === rows.length + 1 &&
        entry.previous === previous &&
        Number.isFinite(Date.parse(entry.at)),
      "erasure_ledger_integrity",
      503,
    );
    const payload = {
      sequence: entry.sequence,
      packageId: entry.packageId,
      at: entry.at,
      previous: entry.previous,
    };
    const mac = createHmac("sha256", key)
      .update("dental-erasure-v1\n" + JSON.stringify(payload))
      .digest("hex");
    requireThat(equal(mac, entry.mac), "erasure_ledger_integrity", 503);
    rows.push(entry);
    previous = entry.mac;
  }
  return rows;
}
export function reconcileLedgers(snapshot, current) {
  requireThat(
    current.length >= snapshot.length &&
      snapshot.every((x, i) => x.mac === current[i].mac),
    "erasure_ledger_divergent",
    503,
  );
  return current;
}
export class Erasures {
  constructor(path, key) {
    this.path = path;
    this.key = key;
    this.queue = Promise.resolve();
  }
  async init({ create = false } = {}) {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    if (create) {
      const file = await open(this.path, "ax", 0o600).catch((e) => {
        if (e.code !== "EEXIST") throw e;
      });
      if (file) await file.close();
    }
    this.rows = verifyLedger(await readFile(this.path, "utf8"), this.key);
  }
  append(packageId) {
    const task = this.queue.then(async () => {
      id(packageId);
      if (this.rows.some((x) => x.packageId === packageId)) return;
      const payload = {
        sequence: this.rows.length + 1,
        packageId,
        at: new Date().toISOString(),
        previous: this.rows.at(-1)?.mac ?? "0".repeat(64),
      };
      const entry = {
        ...payload,
        mac: createHmac("sha256", this.key)
          .update("dental-erasure-v1\n" + JSON.stringify(payload))
          .digest("hex"),
      };
      const f = await open(this.path, "a", 0o600);
      try {
        await f.writeFile(JSON.stringify(entry) + "\n");
        await f.sync();
      } finally {
        await f.close();
      }
      this.rows.push(entry);
    });
    this.queue = task.catch(() => {
      this.failed = true;
    });
    return task;
  }
  async apply(pool) {
    for (const entry of this.rows) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        await c.query(
          "INSERT INTO tombstones(package_id,erased_at) VALUES($1,$2) ON CONFLICT DO NOTHING",
          [entry.packageId, entry.at],
        );
        await c.query(
          "UPDATE packages SET deleted_at=coalesce(deleted_at,$2),metadata='{}',purge_complete=false WHERE id=$1",
          [entry.packageId, entry.at],
        );
        await c.query(
          "UPDATE photos SET state='deleted',lease=NULL,chunks='[]',raw_fingerprint=NULL,derivative_hash=NULL,info=NULL WHERE package_id=$1",
          [entry.packageId],
        );
        await c.query(
          "UPDATE privacy_decisions SET decision=jsonb_build_object('erased',true),derivative_hash='' WHERE photo_id IN(SELECT id FROM photos WHERE package_id=$1)",
          [entry.packageId],
        );
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }
  }
}
