import pg from "pg";
import { readFile } from "node:fs/promises";
const config = JSON.parse(await readFile(process.argv[2], "utf8"));
const pool = new pg.Pool({ connectionString: config.databaseUrl });
try {
  await pool.query(
    await readFile(
      new URL("../../apps/review-portal/schema.sql", import.meta.url),
      "utf8",
    ),
  );
  await pool.query(`GRANT SELECT ON accounts,grants TO dental_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON sessions,login_attempts TO dental_runtime;
GRANT SELECT,INSERT,UPDATE ON packages,photos,privacy_decisions,daily_quota,tombstones TO dental_runtime;
GRANT SELECT,UPDATE ON quota_lock TO dental_runtime;
GRANT SELECT,INSERT ON audit TO dental_runtime;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO dental_runtime;`);
  await pool.query(
    await readFile(
      new URL("../../apps/review-portal/membership.sql", import.meta.url),
      "utf8",
    ),
  );
  await pool.query(`GRANT SELECT ON membership_settings,member_profiles,membership_managers,membership_applications,membership_events TO dental_runtime;
GRANT SELECT,INSERT,UPDATE ON membership_applications TO dental_runtime;
GRANT SELECT,INSERT ON membership_events TO dental_runtime;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO dental_runtime;
GRANT EXECUTE ON FUNCTION enroll_member(uuid,text,text,text),membership_decide(text,uuid,integer,text,text,integer,boolean),membership_revoke(text,uuid,text),membership_intake(text,boolean,text) TO dental_runtime;`);
  console.log("Private portal schema and restricted runtime grants installed.");
} finally {
  await pool.end();
}
