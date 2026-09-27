// Operator-only deployment. Separate DB credential can read/update only the outbox.
import pg from "pg";
import { readFile, writeFile, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const [operatorPath, outputPath] = process.argv.slice(2);
if ((await stat(operatorPath)).mode % 512 !== 0o600)
  throw Error("private_file_required");
const config = JSON.parse(await readFile(operatorPath, "utf8"));
const password = randomBytes(32).toString("hex");
const url = new URL(config.databaseUrl);
url.username = "dental_notifier";
url.password = password;
// Reserve the output before touching the role. Do not overwrite existing credentials.
await writeFile(outputPath, JSON.stringify({ databaseUrl: url.href }), {
  mode: 0o600,
  flag: "wx",
});
const adminUrl = new URL(config.databaseUrl);
adminUrl.username = "postgres";
adminUrl.password = config.postgresPassword;
const pool = new pg.Pool({ connectionString: adminUrl.href });
try {
  // Only generated hex is interpolated, never operator or applicant text.
  await pool.query(`CREATE ROLE dental_notifier LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
    GRANT CONNECT ON DATABASE dental_review TO dental_notifier;
    GRANT USAGE ON SCHEMA public TO dental_notifier;
    GRANT SELECT,UPDATE ON membership_mail_outbox TO dental_notifier;`);
  console.log("Private notification credential created. No email sent.");
} catch {
  console.error(
    "Notification provisioning incomplete; reconcile the private file and database role before retrying.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
