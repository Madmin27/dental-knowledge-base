import { requireThat, freshReview } from "./policy.mjs";
export class ContributionDesk {
  constructor(membership, { origin, key, endpoint = "http://127.0.0.1:3057" }) {
    this.membership = membership;
    this.origin = origin;
    this.key = key;
    this.endpoint = endpoint;
  }
  async authorize(c, s) {
    await this.membership.repo.active(c, s);
    freshReview(s);
    const r = await c.query(
      `SELECT 1 FROM membership_managers WHERE account_id=$1 AND expires_at>now() UNION SELECT 1 FROM intake_editors WHERE account_id=$1 AND expires_at>now()`,
      [s.account_id],
    );
    requireThat(r.rowCount, "editor_required", 403);
  }
  async request(s, id = "", action = "", input) {
    requireThat(!id || /^[a-f0-9]{32}$/.test(id), "invalid_report");
    requireThat(
      ["", "events", "publication", "export"].includes(action),
      "invalid_action",
    );
    return this.membership.repo.tx(async (c) => {
      await this.authorize(c, s);
      const call = async (suffix, body) => {
        const response = await fetch(
          this.endpoint + "/api/contributions" + (id ? "/" + id : "") + suffix,
          {
            method: body ? "POST" : "GET",
            redirect: "error",
            signal: AbortSignal.timeout(10000),
            headers: {
              Host: new URL(this.origin).host,
              Origin: this.origin,
              Authorization: "Bearer " + this.key,
              "X-Dental-Client": "127.0.0.1",
              "X-Dental-Editor": s.account_id,
              ...(body
                ? { "Content-Type": "application/json", "X-DKB-Request": "1" }
                : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          },
        );
        const result = await response.json();
        requireThat(
          response.ok,
          result.error ?? "intake_unavailable",
          response.status,
        );
        return result;
      };
      let digest;
      if (
        action === "export" ||
        (action === "publication" && input?.action === "linked")
      ) {
        const r = await call("");
        const p = r.publication;
        requireThat(p?.ready, "publication_not_ready", 409);
        digest = p.digest;
        const valid = await c.query(
          `SELECT count(DISTINCT m.account_id)::int AS n FROM (SELECT account_id,expires_at FROM membership_managers UNION SELECT account_id,expires_at FROM intake_editors) m JOIN accounts a ON a.id=m.account_id WHERE a.enabled AND m.expires_at>now() AND m.account_id=ANY($1::uuid[])`,
          [[p.author, p.reviewer]],
        );
        requireThat(valid.rows[0].n === 2, "editor_authority_expired", 403);
      }
      // Only the server supplies the authenticated actor header, never the browser.
      return call(
        action
          ? "/" + action + (action === "export" ? "?digest=" + digest : "")
          : "",
        input,
      );
    });
  }
}
