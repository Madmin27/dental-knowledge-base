import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DailyUsage } from "../apps/preview/usage.mjs";
import { readUsage } from "../apps/review-portal/statistics.mjs";
test("aggregate counters retain only allowlisted pages and survive reload", async () => {
  const dir = await mkdtemp(join(tmpdir(), "stats-"));
  let usage;
  try {
    const path = join(dir, "usage.json");
    usage = await new DailyUsage(path).init();
    usage.record("/");
    usage.record("/anatomy");
    usage.record("/tooth-interior");
    usage.record("/review/callback?code=private");
    usage.record("/?email=private");
    await usage.close();
    const raw = await readFile(path, "utf8");
    assert.ok(!raw.includes("private"));
    assert.ok(!raw.includes("email"));
    let stats = await readUsage(path, 30);
    assert.equal(stats.totals.atlas, 2);
    assert.equal(stats.totals.interior, 1);
    usage = await new DailyUsage(path).init();
    usage.record("/");
    await usage.close();
    stats = await readUsage(path, 30);
    assert.equal(stats.totals.atlas, 3);
  } finally {
    await usage?.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("missing or corrupted counters are unavailable, not zero usage", async () => {
  const dir = await mkdtemp(join(tmpdir(), "stats-"));
  const path = join(dir, "usage.json");
  try {
    assert.equal((await readUsage(path, 7)).available, false);
    await writeFile(path, "broken");
    const u = await new DailyUsage(path).init();
    u.record("/");
    await u.close();
    assert.equal(await readFile(path, "utf8"), "broken");
    assert.equal((await readUsage(path, 7)).available, false);
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        days: { "2026-09-27": { atlas: -1 } },
      }),
    );
    assert.equal((await readUsage(path, 30)).available, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("old daily counters expire at 90 UTC dates", async () => {
  const dir = await mkdtemp(join(tmpdir(), "stats-"));
  let u;
  try {
    u = await new DailyUsage(join(dir, "usage.json")).init();
    const now = new Date();
    u.record("/", new Date(+now - 100 * 86400000));
    u.record("/", now);
    await u.close();
    const data = JSON.parse(await readFile(u.path, "utf8"));
    assert.equal(Object.keys(data.days).length, 1);
  } finally {
    await u?.close();
    await rm(dir, { recursive: true, force: true });
  }
});
