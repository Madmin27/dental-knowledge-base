// Disabled-account privacy requests: local operator only, while portal is stopped.
import { readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { id, requireThat } from "../../apps/review-portal/policy.mjs";
import { Erasures } from "../../apps/review-portal/erasures.mjs";
import { Vault } from "../../apps/review-portal/vault.mjs";
import { Repository } from "../../apps/review-portal/repository.mjs";
const [operatorFile, portalFile, requestFile, state] = process.argv.slice(2);
for (const path of [operatorFile, portalFile, requestFile])
  requireThat(
    path && (await stat(path)).mode % 512 === 0o600,
    "private_file_required",
  );
const status = execFileSync(
  "systemctl",
  ["show", "dental-review.service", "-p", "ActiveState", "--value"],
  { encoding: "utf8" },
).trim();
requireThat(
  status === "inactive" || status === "failed",
  "stop_portal_before_operator_erasure",
);
const operator = JSON.parse(await readFile(operatorFile, "utf8")),
  portal = JSON.parse(await readFile(portalFile, "utf8")),
  request = JSON.parse(await readFile(requestFile, "utf8"));
requireThat(
  request.verifiedOwnerRequest === true,
  "verify_owner_request_first",
);
id(request.packageId);
id(request.ownerId);
const pool = new pg.Pool({ connectionString: operator.databaseUrl });
try {
  const match = await pool.query(
    "SELECT id FROM packages WHERE id=$1 AND owner_id=$2",
    [request.packageId, request.ownerId],
  );
  requireThat(match.rowCount === 1, "owner_mismatch");
  const key = Buffer.from(portal.vaultKey, "hex"),
    erasures = new Erasures(state + "/erasures.jsonl", key);
  await erasures.init();
  await erasures.append(request.packageId);
  await erasures.apply(pool);
  const repo = new Repository(
    pool,
    new Vault(state + "/vault", key),
    null,
    erasures,
  );
  await repo.purge();
  await pool.query(
    "INSERT INTO audit(event,object_id) VALUES('local_operator_verified_owner_erasure',$1)",
    [request.packageId],
  );
  console.log(
    "Verified owner erasure applied; retained encrypted backup copies remain subject to retention and the current erasure journal.",
  );
} finally {
  await pool.end();
}
