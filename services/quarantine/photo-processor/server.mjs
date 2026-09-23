import http from "node:http";
import { spawn } from "node:child_process";
import {
  mkdir,
  chmod,
  stat,
  readFile,
  writeFile,
  rm,
  unlink,
} from "node:fs/promises";
const maximum = 20 * 1024 ** 2;
let busy = false;
function run(command, args, timeout) {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args, {
      env: {
        PATH: "/usr/local/bin:/usr/bin:/bin",
        HOME: "/tmp",
        TMPDIR: "/tmp",
      },
      stdio: "ignore",
    });
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error("timeout"));
    }, timeout);
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on("exit", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error("processor_rejected"));
    });
  });
}
async function definitions() {
  for (const file of ["daily.cld", "daily.cvd"]) {
    try {
      const s = await stat("/definitions/" + file);
      if (Date.now() - s.mtimeMs < 72 * 3600000) return true;
    } catch {}
  }
  return false;
}
const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead((await definitions()) ? 200 : 503);
    return res.end("processor");
  }
  if (req.url !== "/process" || req.method !== "POST" || busy) {
    res.writeHead(503);
    return res.end();
  }
  busy = true;
  try {
    if (
      !(await definitions()) ||
      !["image/jpeg", "image/png"].includes(req.headers["content-type"]) ||
      !/^\d+$/.test(req.headers["content-length"] ?? "") ||
      Number(req.headers["content-length"]) > maximum
    )
      throw new Error("unavailable");
    let size = 0;
    const chunks = [];
    for await (const b of req) {
      size += b.length;
      if (size > maximum) throw new Error("limit");
      chunks.push(b);
    }
    if (!size || size !== Number(req.headers["content-length"]))
      throw new Error("size");
    const bytes = Buffer.concat(chunks);
    if (
      (req.headers["content-type"] === "image/png" && bytes[0] !== 137) ||
      (req.headers["content-type"] === "image/jpeg" && bytes[0] !== 255)
    )
      throw new Error("type");
    await mkdir("/tmp/job", { mode: 0o700 });
    await writeFile("/tmp/job/input", bytes, { mode: 0o600 });
    await run(
      "/usr/bin/clamscan",
      [
        "--database=/definitions",
        "--no-summary",
        "--max-filesize=20M",
        "--max-scansize=40M",
        "--max-scantime=10000",
        "--max-recursion=5",
        "--max-files=10",
        "--alert-exceeds-max=yes",
        "/tmp/job/input",
      ],
      30000,
    );
    await run(
      process.execPath,
      ["--max-old-space-size=128", "/processor/decode.mjs"],
      20000,
    );
    const output = await readFile("/tmp/job/output"),
      info = await readFile("/tmp/job/info", "utf8");
    if (output.length > maximum || info.length > 2000)
      throw new Error("output");
    res.writeHead(200, {
      "Content-Type": "image/jpeg",
      "Content-Length": output.length,
      "X-Image-Info": info,
    });
    res.end(output);
  } catch {
    if (!res.headersSent) res.writeHead(422);
    res.end();
  } finally {
    await rm("/tmp/job", { recursive: true, force: true });
    busy = false;
  }
});
server.requestTimeout = 60000;
server.headersTimeout = 5000;
server.maxHeadersCount = 20;
await unlink("/socket/processor.sock").catch((e) => {
  if (e.code !== "ENOENT") throw e;
});
server.listen("/socket/processor.sock", async () => {
  await chmod("/socket/processor.sock", 0o600);
  console.log("Isolated photo processor ready");
});
