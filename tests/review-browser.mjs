// Headless UI fixture: no provider, production accounts or external network.
import http from "node:http";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = process.env.TEST_REVIEW_BROWSER;
if (!browser)
  throw new Error("Use an isolated fixture with TEST_REVIEW_BROWSER");
let authenticated = false,
  reviewer = false,
  recordedDecision = null,
  membershipManager = false,
  statsDenied = false,
  recordedApplication = null,
  recordedMembershipDecision = null;
const pkg = "00000000-0000-4000-8000-000000000003";
const photo = "00000000-0000-4000-8000-000000000004";
let deskDenied = false,
  deskDraft = null;
const deskRecord = {
  id: "a".repeat(32),
  revision: 0,
  status: "received",
  createdAt: new Date().toISOString(),
  submission: {
    category: "technical",
    description: "Synthetic viewer controls fail on a small screen.",
    expected: "The camera should stay centered.",
    evidence: [],
    view: { structure: "viewer" },
  },
  events: [],
};
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/review/api/desk")) {
    res.setHeader("Content-Type", "application/json");
    if (deskDenied) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: "manager_required" }));
    }
    if (req.method === "POST") {
      let data = "";
      for await (const c of req) data += c;
      const input = JSON.parse(data);
      if (req.url.endsWith("/publication")) {
        deskDraft = input;
        deskRecord.publication = {
          title: input.title,
          body: input.body,
          digest: "f".repeat(64),
          contributorApproved: false,
          editorApproved: false,
        };
      }
      deskRecord.revision++;
      return res.end(JSON.stringify(deskRecord));
    }
    return res.end(
      JSON.stringify(
        req.url === "/review/api/desk"
          ? {
              records: [
                { ...deskRecord, category: "technical", structure: "viewer" },
              ],
            }
          : deskRecord,
      ),
    );
  }

  if (req.url.startsWith("/review/api/session")) {
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify(
        authenticated
          ? {
              authenticated: true,
              authAt: new Date().toISOString(),
              uploadsEnabled: true,
              csrf: "synthetic",
              account: "synthetic",
              membership: {
                manager: membershipManager,
                applications: [],
                permissions: [],
              },
              grants: [reviewer ? "privacy_reviewer" : "photo_contributor"],
              reviewFresh: reviewer,
              packages: reviewer
                ? [
                    {
                      id: pkg,
                      owned: false,
                      metadata: { purpose: "Synthetic privacy review" },
                    },
                  ]
                : [],
            }
          : { authenticated: false, uploadsEnabled: false },
      ),
    );
  }
  if (req.url === "/review/api/applications" && req.method === "POST") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    recordedApplication = JSON.parse(Buffer.concat(chunks));
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ id: pkg }));
  }
  if (req.url.startsWith("/review/api/management/statistics")) {
    res.setHeader("Content-Type", "application/json");
    if (statsDenied) {
      res.writeHead(403);
      return res.end('{"error":"manager_required"}');
    }
    return res.end(
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        days: 30,
        members: { total: 12, enabled: 10 },
        roles: [
          { role: "photo_contributor", count: 6 },
          { role: "privacy_reviewer", count: 2 },
        ],
        applications: [
          { status: "pending", count: 4 },
          { status: "approved", count: 6 },
        ],
        photos: [{ state: "privacy_review", count: 8, bytes: "4194304" }],
        queue: { pending: 4, oldest_hours: 12 },
        photoQueue: { pending: 8, oldest_hours: 9 },
        activeMemberSessions: 2,
        photoIntakeEnabled: true,
        timeline: [
          {
            day: new Date().toISOString().slice(0, 10),
            applications: 3,
            privacy_decisions: 2,
          },
        ],
        usage: {
          available: true,
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          totals: {
            atlas: 240,
            interior: 80,
            project: 12,
            guide: 25,
            contributions: 3,
            report: 1,
          },
          daily: [{ day: new Date().toISOString().slice(0, 10), count: 361 }],
        },
      }),
    );
  }
  if (req.url.startsWith("/review/api/management?")) {
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        applications: [
          {
            id: pkg,
            account_id: "other",
            role: "privacy_reviewer",
            status: "pending",
            revision: 1,
            profile: {
              name: "Synthetic applicant <img src=x>",
              institution: "Synthetic university",
              experience: "Synthetic experience",
              evidence: "Synthetic reference",
              motivation: "Synthetic motivation",
            },
          },
        ],
      }),
    );
  }
  if (req.url === `/review/api/applications/${pkg}/decision`) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    recordedMembershipDecision = JSON.parse(Buffer.concat(chunks));
    res.setHeader("Content-Type", "application/json");
    return res.end('{"ok":true}');
  }
  if (req.url === `/review/api/photos/${photo}/preview`) {
    res.setHeader("Content-Type", "image/png");
    return res.end(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jzFoAAAAASUVORK5CYII=",
        "base64",
      ),
    );
  }
  if (
    req.url === `/review/api/photos/${photo}/decision` &&
    req.method === "POST"
  ) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    recordedDecision = JSON.parse(Buffer.concat(chunks));
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({ state: recordedDecision.decision, revision: 3 }),
    );
  }
  if (req.url === "/review/api/packages" && req.method === "POST") {
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ id: pkg }));
  }
  if (req.url === "/review/api/packages/" + pkg) {
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        id: pkg,
        owned: !reviewer,
        metadata: {
          purpose: "Synthetic specimen contribution",
          authorityReference: "Synthetic permission reference",
          fdi: "unknown",
        },
        files: reviewer
          ? [
              {
                id: photo,
                state: recordedDecision?.decision ?? "privacy_review",
                revision: recordedDecision ? 3 : 2,
                size: 68,
              },
            ]
          : [],
        decisions: [],
      }),
    );
  }
  const file = req.url.startsWith("/review/desk.js")
    ? "desk.js"
    : req.url.startsWith("/review/contributions")
      ? "desk.html"
      : req.url.startsWith("/review/admin.js")
        ? "admin.js"
        : /^\/review\/admin(?:\?|$)/.test(req.url)
          ? "admin.html"
          : req.url.startsWith("/review/membership.js")
            ? "membership.js"
            : req.url.startsWith("/review/app.js")
              ? "app.js"
              : req.url.startsWith("/review/style.css")
                ? "style.css"
                : "index.html";
  res.setHeader(
    "Content-Type",
    file.endsWith(".js")
      ? "text/javascript"
      : file.endsWith(".css")
        ? "text/css"
        : "text/html",
  );
  res.end(
    await readFile(
      new URL("../apps/review-portal/public/" + file, import.meta.url),
    ),
  );
});
await new Promise((r) => server.listen(19091, "127.0.0.1", r));
const chrome = spawn(
  browser,
  [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--no-first-run",
    "--remote-debugging-pipe",
    `--user-data-dir=/scratch/chrome-${Date.now()}`,
  ],
  { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] },
);
chrome.stderr.on("data", (b) => {
  if (
    /error while loading|symbol lookup|No usable sandbox|Failed to create/.test(
      b.toString(),
    )
  )
    process.stderr.write(b);
});
let sequence = 0,
  pending = new Map(),
  buffer = Buffer.alloc(0);
const errors = [];
chrome.on("exit", (code, signal) => {
  for (const p of pending.values())
    p.reject(new Error("Browser exited " + code + " signal " + signal));
});
chrome.stdio[4].on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  let at;
  while ((at = buffer.indexOf(0)) !== -1) {
    const message = JSON.parse(buffer.subarray(0, at).toString());
    buffer = buffer.subarray(at + 1);
    if (message.id) {
      const promise = pending.get(message.id);
      pending.delete(message.id);
      if (!promise) continue;
      clearTimeout(promise.timer);
      message.error
        ? promise.reject(new Error(message.error.message))
        : promise.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown")
      errors.push(message.params.exceptionDetails.text);
  }
});
function call(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("CDP timeout: " + method));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    chrome.stdio[3].write(
      JSON.stringify({
        id,
        method,
        params,
        ...(sessionId ? { sessionId } : {}),
      }) + "\0",
    );
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const { targetId } = await call("Target.createTarget", {
      url: "about:blank",
    }),
    { sessionId } = await call("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
  const evaluate = async (expression) =>
    (
      await call(
        "Runtime.evaluate",
        { expression, returnByValue: true, awaitPromise: true },
        sessionId,
      )
    ).result.value;
  await call("Runtime.enable", {}, sessionId);
  await call("Page.enable", {}, sessionId);
  await call("Page.bringToFront", {}, sessionId);
  async function load(url, width, height) {
    await call(
      "Emulation.setDeviceMetricsOverride",
      { width, height, deviceScaleFactor: 1, mobile: width < 600 },
      sessionId,
    );
    await call("Page.navigate", { url }, sessionId);
    for (let i = 0; i < 60; i++) {
      await wait(100);
      if (
        await evaluate(
          "document.querySelector('#signed-out')&&!document.querySelector('#signed-out').hidden||document.querySelector('#workspace')&&!document.querySelector('#workspace').hidden||document.querySelector('#stats-content')&&!document.querySelector('#stats-content').hidden||document.querySelector('#desk-content')&&!document.querySelector('#desk-content').hidden",
        )
      )
        return;
    }
    throw new Error(
      "UI did not initialise: " +
        (await evaluate(
          "document.querySelector('#stats-error')?.textContent",
        )) +
        JSON.stringify(errors),
    );
  }
  if (process.env.TEST_DESK_ONLY) {
    authenticated = true;
    membershipManager = true;
    await load("http://127.0.0.1:19091/review/contributions", 1440, 1100);
    await evaluate("document.querySelector('#desk-content button').click()");
    for (let i = 0; i < 30; i++) {
      if (
        await evaluate(
          "document.querySelectorAll('#desk-content form').length>=3",
        )
      )
        break;
      await wait(100);
    }
    assert.equal(
      await evaluate("document.querySelectorAll('#desk-content form').length"),
      3,
    );
    await evaluate(
      "(()=>{const f=document.querySelectorAll('#desk-content form')[2];f.querySelector('input').value='Synthetic technical summary';f.querySelector('textarea').value='Synthetic public reproduction steps with expected behavior and observed result.';f.requestSubmit();})()",
    );
    for (let i = 0; i < 30 && !deskDraft; i++) await wait(100);
    assert.equal(deskDraft.action, "draft");
    await wait(200);
    assert.equal(
      await evaluate("document.documentElement.scrollWidth<=innerWidth"),
      true,
    );
    await call("Page.bringToFront", {}, sessionId);
    const shot = await call(
      "Page.captureScreenshot",
      { format: "png", captureBeyondViewport: true },
      sessionId,
    );
    await writeFile(
      "/scratch/contribution-desk.png",
      Buffer.from(shot.data, "base64"),
    );
    await load("http://127.0.0.1:19091/review/contributions?lang=tr", 390, 844);
    await evaluate("document.querySelector('#desk-content button').click()");
    await wait(300);
    assert.equal(await evaluate("document.documentElement.lang"), "tr");
    assert.equal(
      await evaluate("document.documentElement.scrollWidth<=innerWidth"),
      true,
    );
    deskDenied = true;
    await evaluate("document.querySelector('#refresh').click()");
    await wait(300);
    assert.equal(
      await evaluate("document.querySelector('#desk-content').textContent"),
      "",
    );
    assert.deepEqual(errors, []);
    console.log(
      "Contribution desk browser fixture passed: EN/TR desktop/mobile, draft form, access-loss clearing, no overflow or JS exceptions.",
    );
  } else {
    if (!process.env.TEST_STATS_ONLY) {
      await load("http://127.0.0.1:19091/review/", 1440, 1050);
      assert.equal(await evaluate("document.documentElement.lang"), "en");
      assert.equal(
        await evaluate("document.querySelector('#signed-out').hidden"),
        false,
      );
      assert.equal(
        await evaluate("document.documentElement.scrollWidth<=innerWidth"),
        true,
      );
      await call("Page.bringToFront", {}, sessionId);
      await wait(250);
      let png = await call(
        "Page.captureScreenshot",
        { format: "png" },
        sessionId,
      );
      await writeFile(
        "/scratch/review-desktop.png",
        Buffer.from(png.data, "base64"),
      );
      authenticated = true;
      await load("http://127.0.0.1:19091/review/?lang=tr", 390, 844);
      assert.equal(await evaluate("document.documentElement.lang"), "tr");
      await evaluate("document.querySelector('#new-package').click()");
      assert.equal(
        await evaluate("document.querySelector('#new-panel').hidden"),
        false,
      );
      assert.equal(
        await evaluate("document.documentElement.scrollWidth<=innerWidth"),
        true,
      );
      await evaluate(
        "document.querySelector('[name=purpose]').value='Synthetic specimen contribution';document.querySelector('[name=authorityReference]').value='Synthetic permission reference';document.querySelectorAll('#package-form input[type=checkbox]').forEach(e=>e.checked=true);document.querySelector('#package-form').requestSubmit()",
      );
      for (let i = 0; i < 40; i++) {
        await wait(100);
        if (
          await evaluate(
            "document.querySelector('#detail').textContent.includes('Synthetic specimen contribution')",
          )
        )
          break;
      }
      assert.equal(
        await evaluate(
          "document.querySelector('#detail').textContent.includes('Synthetic specimen contribution')",
        ),
        true,
      );
      assert.equal(
        await evaluate("document.documentElement.scrollWidth<=innerWidth"),
        true,
      );
      await call("Page.bringToFront", {}, sessionId);
      await wait(250);
      png = await call(
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: true },
        sessionId,
      );
      await writeFile(
        "/scratch/review-mobile.png",
        Buffer.from(png.data, "base64"),
      );
      await evaluate(
        `const m=document.querySelector('#membership details');m.open=true;const mf=m.querySelector('form');['name','institution','experience','evidence','motivation'].forEach(k=>mf.elements[k].value='Synthetic application evidence');mf.elements.consent.checked=true;mf.requestSubmit()`,
      );
      for (let i = 0; i < 40 && !recordedApplication; i++) await wait(100);
      assert.equal(recordedApplication?.consent, true);
      membershipManager = true;
      await load("http://127.0.0.1:19091/review/?lang=en", 1440, 1050);
      for (let i = 0; i < 40; i++) {
        if (
          await evaluate(
            "!!document.querySelector('.management .history form')",
          )
        )
          break;
        await wait(100);
      }
      assert.equal(
        await evaluate("document.querySelectorAll('.management img').length"),
        0,
      );
      await evaluate(
        `const af=document.querySelector('.management .history form');af.elements.decision.value='approved';af.elements.verified.checked=true;af.elements.reason.value='Synthetic checked professional reference';af.requestSubmit()`,
      );
      for (let i = 0; i < 40 && !recordedMembershipDecision; i++)
        await wait(100);
      assert.equal(recordedMembershipDecision?.decision, "approved");
      assert.equal(recordedMembershipDecision?.verified, true);
      await call("Page.bringToFront", {}, sessionId);
      await wait(250);
      let mpng = await call(
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: true },
        sessionId,
      );
      await writeFile(
        "/scratch/membership-management.png",
        Buffer.from(mpng.data, "base64"),
      );
      membershipManager = false;
      reviewer = true;
      await load("http://127.0.0.1:19091/review/?lang=en", 1440, 1050);
      await evaluate("document.querySelector('.package').click()");
      for (let i = 0; i < 40; i++) {
        await wait(100);
        if (await evaluate("!!document.querySelector('#detail form')")) break;
      }
      assert.equal(
        await evaluate("!!document.querySelector('#detail form')"),
        true,
      );
      await evaluate(
        "const f=document.querySelector('#detail form');['pixels','metadata','authority','scope'].forEach(k=>f.querySelector('[name='+k+']').checked=true);f.querySelector('[value=specimen_only]').checked=true;f.querySelector('textarea').value='Synthetic review for private inspection only';f.querySelector('[name=decision]').value='privacy_cleared';f.requestSubmit()",
      );
      for (let i = 0; i < 40 && !recordedDecision; i++) await wait(100);
      assert.equal(recordedDecision?.decision, "privacy_cleared");
      assert.equal(recordedDecision.revision, 2);
      assert.equal(recordedDecision.checks.scope, true);
      assert.deepEqual(recordedDecision.riskTags, ["specimen_only"]);
      await call("Page.bringToFront", {}, sessionId);
      await wait(250);
      png = await call(
        "Page.captureScreenshot",
        { format: "png", captureBeyondViewport: true },
        sessionId,
      );
      await writeFile(
        "/scratch/review-privacy-desk.png",
        Buffer.from(png.data, "base64"),
      );
    }
    authenticated = true;
    membershipManager = true;
    console.log("Checking private dashboard");
    await load("http://127.0.0.1:19091/review/admin", 1440, 1100);
    assert.equal(
      await evaluate("document.querySelectorAll('.stat-value').length"),
      4,
    );
    assert.equal(
      await evaluate("document.documentElement.scrollWidth<=innerWidth"),
      true,
    );
    await call("Page.bringToFront", {}, sessionId);
    await wait(250);
    let dashboard = await call(
      "Page.captureScreenshot",
      { format: "png", captureBeyondViewport: true },
      sessionId,
    );
    await writeFile(
      "/scratch/private-statistics.png",
      Buffer.from(dashboard.data, "base64"),
    );
    await load("http://127.0.0.1:19091/review/admin?lang=tr", 390, 844);
    assert.equal(
      await evaluate("document.documentElement.scrollWidth<=innerWidth"),
      true,
    );
    assert.equal(
      await evaluate("document.querySelector('#title').textContent"),
      "Proje kontrol paneli",
    );
    statsDenied = true;
    await evaluate("document.querySelector('#refresh').click()");
    for (let i = 0; i < 30; i++) {
      if (await evaluate("!document.querySelector('#stats-error').hidden"))
        break;
      await wait(100);
    }
    assert.equal(
      await evaluate("document.querySelector('#stats-content').textContent"),
      "",
    );
    assert.equal(
      await evaluate("document.querySelector('#stats-error').hidden"),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      process.env.TEST_STATS_ONLY
        ? "Private statistics browser fixture passed: desktop/mobile, EN/TR, access loss clearing, no overflow or JavaScript exceptions."
        : "Browser fixture passed: English landing, Turkish mobile, contributor form, membership application and management decision, escaped applicant HTML, privacy decision form, private statistics desktop/mobile and access loss clearing, no overflow, no JS exception.",
    );
  }
} catch (e) {
  console.error("Browser fixture failure:", e.message);
  throw e;
} finally {
  for (const p of pending.values()) clearTimeout(p.timer);
  pending.clear();
  chrome.kill("SIGKILL");
  server.close();
}
