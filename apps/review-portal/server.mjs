import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import pg from "pg";
import { Auth } from "./auth.mjs";
import { Vault } from "./vault.mjs";
import { Repository } from "./repository.mjs";
import { processor } from "./processor.mjs";
import { Erasures } from "./erasures.mjs";
import { Denied, requireThat, equal, LIMITS } from "./policy.mjs";

export async function body(req, limit) {
  const length = req.headers["content-length"];
  requireThat(
    length && /^\d+$/.test(length) && Number(length) <= limit,
    "body_limit",
    413,
  );
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    requireThat(size <= limit, "body_limit", 413);
    chunks.push(chunk);
  }
  requireThat(size === Number(length), "incomplete_body");
  return Buffer.concat(chunks);
}
const json = async (req) => {
  requireThat(
    req.headers["content-type"] === "application/json",
    "json_required",
    415,
  );
  try {
    return JSON.parse((await body(req, 12000)).toString("utf8"));
  } catch (e) {
    if (e instanceof Denied) throw e;
    throw new Denied("invalid_json");
  }
};
export function createServer({
  repo,
  auth,
  origin,
  uploadsEnabled = false,
  publicDir = fileURLToPath(new URL("./public/", import.meta.url)),
}) {
  const expected = new URL(origin),
    rates = new Map();
  let inFlight = 0;
  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    );
    const send = (status, data) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    if (inFlight >= 4) {
      res.setHeader("Retry-After", "1");
      return send(503, { error: "service_busy" });
    }
    inFlight++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        inFlight--;
      }
    };
    res.once("finish", release);
    res.once("close", release);
    try {
      requireThat(req.headers.host === expected.host, "invalid_host", 400);
      const url = new URL(req.url, origin);
      requireThat(
        !url.username && !url.password && url.origin === origin,
        "invalid_url",
      );
      const key =
        req.socket.remoteAddress === "127.0.0.1"
          ? String(req.headers["x-dental-client"] ?? "loopback")
          : req.socket.remoteAddress;
      const now = Date.now();
      for (const [k, v] of rates) if (v.until < now) rates.delete(k);
      requireThat(rates.has(key) || rates.size < 5000, "rate_limit", 429);
      const rate = rates.get(key) ?? { count: 0, until: now + 60000 };
      rate.count++;
      rates.set(key, rate);
      requireThat(rate.count <= 240, "rate_limit", 429);
      if (
        req.method === "GET" &&
        ["/review/", "/review/app.js", "/review/style.css"].includes(
          url.pathname,
        )
      ) {
        const name = {
          "/review/": "index.html",
          "/review/app.js": "app.js",
          "/review/style.css": "style.css",
        }[url.pathname];
        const content = await readFile(join(publicDir, name));
        res.writeHead(200, {
          "Content-Type": name.endsWith(".html")
            ? "text/html; charset=utf-8"
            : name.endsWith(".js")
              ? "text/javascript; charset=utf-8"
              : "text/css; charset=utf-8",
        });
        return res.end(content);
      }
      if (req.method === "GET" && url.pathname === "/review/login")
        return await auth.begin(req, res);
      if (req.method === "GET" && url.pathname === "/review/callback")
        return await auth.callback(req, res);
      if (req.method === "GET" && url.pathname === "/review/health")
        return send(200, { status: "running", uploadsEnabled });
      const s = await auth.session(req);
      if (req.method === "GET" && url.pathname === "/review/api/session")
        return send(
          200,
          s
            ? {
                authenticated: true,
                csrf: s.csrf,
                uploadsEnabled,
                account: s.account_id,
                authAt: s.auth_at,
                ...(await repo.list(s)),
              }
            : { authenticated: false, uploadsEnabled },
        );
      requireThat(s, "login_required", 401);
      if (!["GET", "HEAD"].includes(req.method)) {
        requireThat(
          req.headers.origin === origin &&
            equal(req.headers["x-csrf-token"], s.csrf),
          "csrf_failed",
          403,
        );
        requireThat(
          req.headers["sec-fetch-site"] === undefined ||
            req.headers["sec-fetch-site"] === "same-origin",
          "csrf_failed",
          403,
        );
      }
      if (req.method === "POST" && url.pathname === "/review/api/logout")
        return await auth.logout(s, res);
      if (req.method === "POST" && url.pathname === "/review/api/packages") {
        requireThat(uploadsEnabled, "pilot_not_open", 503);
        return send(201, await repo.create(s, await json(req)));
      }
      let match = url.pathname.match(/^\/review\/api\/packages\/([a-f0-9-]+)$/);
      if (match && req.method === "GET")
        return send(200, await repo.detail(s, match[1]));
      if (match && req.method === "DELETE")
        return send(200, await repo.erase(s, match[1]));
      match = url.pathname.match(
        /^\/review\/api\/packages\/([a-f0-9-]+)\/photos$/,
      );
      if (match && req.method === "POST") {
        requireThat(uploadsEnabled, "pilot_not_open", 503);
        return send(201, await repo.reserve(s, match[1], await json(req)));
      }
      match = url.pathname.match(
        /^\/review\/api\/photos\/([a-f0-9-]+)\/chunks\/(\d+)$/,
      );
      if (match && req.method === "PUT") {
        requireThat(uploadsEnabled, "pilot_not_open", 503);
        requireThat(
          req.headers["content-type"] === "application/octet-stream",
          "binary_required",
          415,
        );
        return send(
          200,
          await repo.chunk(
            s,
            match[1],
            Number(match[2]),
            await body(req, LIMITS.chunk),
          ),
        );
      }
      match = url.pathname.match(
        /^\/review\/api\/photos\/([a-f0-9-]+)\/(finalize|preview|decision)$/,
      );
      if (match && req.method === "POST" && match[2] === "finalize") {
        requireThat(uploadsEnabled, "pilot_not_open", 503);
        return send(200, await repo.finalize(s, match[1]));
      }
      if (match && req.method === "GET" && match[2] === "preview") {
        const bytes = await repo.preview(s, match[1]);
        res.writeHead(200, {
          "Content-Type": "image/jpeg",
          "Content-Disposition": 'inline; filename="private-photo.jpg"',
        });
        return res.end(bytes);
      }
      if (match && req.method === "POST" && match[2] === "decision")
        return send(200, await repo.decide(s, match[1], await json(req)));
      throw new Denied("not_found", 404);
    } catch (e) {
      if (!res.headersSent && req.url.startsWith("/review/callback")) {
        res.writeHead(303, { Location: "/review/?signin=retry" });
        return res.end();
      }
      if (!res.headersSent)
        send(e instanceof Denied ? e.status : 503, {
          error: e instanceof Denied ? e.message : "service_unavailable",
        });
      else
        res.end(); /* No input, identifiers, provider errors or credentials in operational logs. */
    }
  });
  server.requestTimeout = 75000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 40;
  server.keepAliveTimeout = 5000;
  server.setTimeout(75000, (socket) => socket.destroy());
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const credentials = process.env.CREDENTIALS_DIRECTORY;
  const config = JSON.parse(
    await readFile(join(credentials, "portal.json"), "utf8"),
  );
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: 8,
    statement_timeout: 15000,
  });
  const vault = new Vault(
    process.env.REVIEW_VAULT,
    Buffer.from(config.vaultKey, "hex"),
  );
  await vault.init();
  const erasures = new Erasures(
    process.env.REVIEW_ERASURE_LEDGER,
    Buffer.from(config.vaultKey, "hex"),
  );
  await erasures.init();
  await erasures.apply(pool);
  const repo = new Repository(
    pool,
    vault,
    processor(process.env.REVIEW_PROCESSOR_SOCKET),
    erasures,
  );
  await repo.expire();
  let maintaining = false;
  setInterval(async () => {
    if (maintaining) return;
    maintaining = true;
    try {
      await repo.expire();
    } catch {
      console.error("Private portal maintenance requires operator attention");
    } finally {
      maintaining = false;
    }
  }, 3600000).unref();
  const auth = new Auth(pool, config);
  createServer({
    repo,
    auth,
    origin: config.origin,
    uploadsEnabled: process.env.REVIEW_UPLOADS_ENABLED === "true",
  }).listen(Number(process.env.REVIEW_PORT ?? 3059), "127.0.0.1", () =>
    console.log("Private review portal listening on loopback"),
  );
}
