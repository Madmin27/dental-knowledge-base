// Aggregate successful HTML responses only. No request headers or identifiers enter storage.
import { readFile, writeFile, rename, stat } from "node:fs/promises";
const categories = new Map([
  ["/", "atlas"],
  ["/anatomy", "atlas"],
  ["/tooth-interior", "interior"],
  ["/overview", "project"],
  ["/media-guide", "guide"],
  ["/contributions", "contributions"],
  ["/report", "report"],
]);
const allowed = new Set(categories.values());
const day = (d) => d.toISOString().slice(0, 10);
export class DailyUsage {
  constructor(path) {
    this.path = path;
    this.data = {
      version: 1,
      startedAt: new Date().toISOString(),
      updatedAt: null,
      days: {},
    };
    this.chain = Promise.resolve();
    this.disabled = false;
  }
  async init() {
    try {
      if ((await stat(this.path)).size > 131072) throw Error("size");
      const data = JSON.parse(await readFile(this.path, "utf8"));
      if (
        data.version !== 1 ||
        !data.days ||
        Array.isArray(data.days) ||
        Object.keys(data.days).length > 92 ||
        !Number.isFinite(Date.parse(data.startedAt))
      )
        throw Error("format");
      for (const [date, counts] of Object.entries(data.days)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error("date");
        for (const [k, n] of Object.entries(counts))
          if (!allowed.has(k) || !Number.isSafeInteger(n) || n < 0)
            throw Error("count");
      }
      this.data = data;
    } catch (e) {
      if (e.code !== "ENOENT") this.disabled = true;
    }
    if (!this.disabled)
      this.heartbeat = setInterval(
        () => this.flush().catch(() => {}),
        60000,
      ).unref();
    return this;
  }
  record(path, now = new Date()) {
    if (this.disabled || !categories.has(path)) return;
    const key = day(now),
      category = categories.get(path);
    const cutoff = day(new Date(+now - 89 * 86400000));
    for (const d of Object.keys(this.data.days))
      if (d < cutoff || d > key) delete this.data.days[d];
    const counts = (this.data.days[key] ??= {});
    counts[category] = Math.min(
      (counts[category] ?? 0) + 1,
      Number.MAX_SAFE_INTEGER,
    );
    if (!this.timer)
      this.timer = setTimeout(() => {
        this.timer = null;
        this.flush().catch(() => {});
      }, 5000).unref();
  }
  async flush() {
    if (this.disabled) return;
    const today = day(new Date()),
      cutoff = day(new Date(Date.now() - 89 * 86400000));
    for (const d of Object.keys(this.data.days))
      if (d < cutoff || d > today) delete this.data.days[d];
    this.data.updatedAt = new Date().toISOString();
    const snapshot = JSON.stringify(this.data);
    this.chain = this.chain
      .then(async () => {
        await writeFile(this.path + ".new", snapshot, { mode: 0o640 });
        await rename(this.path + ".new", this.path);
      })
      .catch(() => {
        this.disabled = true;
      });
    await this.chain;
  }
  async close() {
    clearInterval(this.heartbeat);
    clearTimeout(this.timer);
    this.timer = null;
    await this.flush();
  }
}
