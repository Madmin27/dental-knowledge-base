import { readFile, stat } from "node:fs/promises";
import { requireThat } from "./policy.mjs";
const kinds = [
  "atlas",
  "interior",
  "project",
  "guide",
  "contributions",
  "report",
];
export async function readUsage(path, days, now = new Date()) {
  if (!path) return { available: false, reason: "not_configured" };
  try {
    if ((await stat(path)).size > 131072) throw Error("size");
    const data = JSON.parse(await readFile(path, "utf8"));
    if (
      data.version !== 1 ||
      !data.days ||
      Array.isArray(data.days) ||
      Object.keys(data.days).length > 92 ||
      !Number.isFinite(Date.parse(data.startedAt)) ||
      !Number.isFinite(Date.parse(data.updatedAt))
    )
      throw Error("invalid");
    const since = new Date(+now - (days - 1) * 86400000)
        .toISOString()
        .slice(0, 10),
      today = now.toISOString().slice(0, 10);
    const totals = Object.fromEntries(kinds.map((k) => [k, 0])),
      daily = [];
    for (const [date, counts] of Object.entries(data.days).sort()) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        date > today ||
        !counts ||
        typeof counts !== "object" ||
        Array.isArray(counts)
      )
        throw Error("invalid");
      let sum = 0;
      for (const [kind, n] of Object.entries(counts)) {
        if (
          !kinds.includes(kind) ||
          !Number.isSafeInteger(n) ||
          n < 0 ||
          n > 1e12
        )
          throw Error("invalid");
        if (date >= since) {
          totals[kind] += n;
          sum += n;
        }
      }
      if (date >= since) daily.push({ day: date, count: sum });
    }
    return {
      available: true,
      startedAt: data.startedAt,
      updatedAt: data.updatedAt,
      stale: +now - Date.parse(data.updatedAt) > 120000,
      totals,
      daily,
    };
  } catch {
    return { available: false, reason: "unavailable" };
  }
}
export async function statistics(membership, s, days, usagePath) {
  requireThat([7, 30, 90].includes(days), "invalid_period");
  const data = await membership.repo.tx(async (c) => {
    await membership.manager(c, s);
    const get = async (sql, args = []) => (await c.query(sql, args)).rows;
    const [members] = await get(
      `SELECT count(*)::int total,count(*) FILTER(WHERE enabled)::int enabled FROM accounts`,
    );
    const roles = await get(
      `SELECT g.role,count(DISTINCT g.account_id)::int count FROM grants g JOIN accounts a ON a.id=g.account_id WHERE a.enabled AND g.revoked_at IS NULL AND g.starts_at<=now() AND g.expires_at>now() GROUP BY g.role ORDER BY g.role`,
    );
    const applications = await get(
      "SELECT status,count(*)::int count FROM membership_applications GROUP BY status ORDER BY status",
    );
    const photos = await get(
      "SELECT f.state,count(*)::int count,coalesce(sum(f.size),0)::text bytes FROM photos f JOIN packages p ON p.id=f.package_id WHERE p.deleted_at IS NULL AND f.state<>'deleted' GROUP BY f.state ORDER BY f.state",
    );
    const [queue] = await get(
      `SELECT count(*)::int pending,coalesce(extract(epoch FROM(now()-min(created_at)))/3600,0)::float8 oldest_hours FROM membership_applications WHERE status='pending'`,
    );
    const [photoQueue] = await get(
      `SELECT count(*)::int pending,coalesce(extract(epoch FROM(now()-min(f.created_at)))/3600,0)::float8 oldest_hours FROM photos f JOIN packages p ON p.id=f.package_id WHERE p.deleted_at IS NULL AND f.state='privacy_review'`,
    );
    const timeline = await get(
      `WITH dates AS (SELECT generate_series((now() AT TIME ZONE 'UTC')::date-($1::int-1),(now() AT TIME ZONE 'UTC')::date,interval '1 day')::date AS day)
    SELECT to_char(d.day,'YYYY-MM-DD') AS day,
    (SELECT count(*)::int FROM membership_applications a WHERE (a.created_at AT TIME ZONE 'UTC')::date=d.day) applications,
    (SELECT count(*)::int FROM privacy_decisions p WHERE (p.created_at AT TIME ZONE 'UTC')::date=d.day) privacy_decisions
    FROM dates d ORDER BY d.day`,
      [days],
    );
    const [sessions] = await get(
      `SELECT count(DISTINCT s.account_id)::int count FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE a.enabled AND s.expires_at>now() AND s.last_seen>now()-interval '15 minutes'`,
    );
    return {
      generatedAt: new Date().toISOString(),
      days,
      members,
      roles,
      applications,
      photos,
      queue,
      photoQueue,
      timeline,
      activeMemberSessions: sessions.count,
      photoIntakeEnabled: await membership.intakeOpen(c),
    };
  });
  // Do not inspect the private usage file until manager authorization succeeds.
  return { ...data, usage: await readUsage(usagePath, days) };
}
