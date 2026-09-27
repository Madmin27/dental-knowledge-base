import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import pg from "pg";
import { dispatchOne } from "./notifications.mjs";
const dir = process.env.CREDENTIALS_DIRECTORY;
let pool;
try {
  const mailPath = dir + "/mail.json";
  const mail = JSON.parse(await readFile(mailPath, "utf8"));
  if (mail.enabled !== true || !mail.smtp?.password) {
    console.log(
      "Notification delivery waiting for private SMTP configuration. Queue retained.",
    );
  } else {
    const config = JSON.parse(
      await readFile(dir + "/notification.json", "utf8"),
    );
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      max: 1,
      connectionTimeoutMillis: 5000,
    });
    const send = (id) =>
      new Promise((resolve, reject) => {
        const child = spawn(
          "/usr/bin/python3",
          [
            new URL("./send-notification.py", import.meta.url).pathname,
            mailPath,
          ],
          {
            env: {
              PATH: "/usr/bin:/bin",
              LANG: "C.UTF-8",
              PYTHONDONTWRITEBYTECODE: "1",
            },
            stdio: ["pipe", "ignore", "ignore"],
            timeout: 30000,
            killSignal: "SIGKILL",
          },
        );
        child.on("error", reject);
        child.on("close", (code) =>
          code === 0 ? resolve() : reject(new Error("smtp_failed")),
        );
        child.stdin.on("error", () => {});
        child.stdin.end(id);
      });
    for (let i = 0; i < 5 && (await dispatchOne(pool, send)); i++) {
      /* bounded batch */
    }
  }
} catch {
  console.error(
    "Notification worker failed; inspect configuration and queue counts privately.",
  );
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
