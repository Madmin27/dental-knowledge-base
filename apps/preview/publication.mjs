import { createHash } from "node:crypto";
export const repository = "Madmin27/dental-knowledge-base";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fail = (status, message) => {
  throw Object.assign(Error(message), { status });
};
export function publicationState(r) {
  let result = null;
  for (const e of r.events) {
    const p = e.publication;
    if (!p) {
      if (result) result.stale = true;
      continue;
    }
    if (p.action === "draft")
      result = {
        ...p,
        author: e.actorId,
        contributorApproved: false,
        editorApproved: false,
        withdrawn: false,
        stale: false,
      };
    else if (result && p.digest === result.digest) {
      if (p.action === "consent") result.contributorApproved = true;
      if (p.action === "withdraw") {
        result.withdrawn = true;
        result.contributorApproved = false;
      }
      if (p.action === "approve") {
        result.editorApproved = true;
        result.reviewer = e.actorId;
      }
      if (p.action === "linked") result.issueUrl = p.issueUrl;
    }
  }
  if (result)
    result.ready =
      !r.redactedAt &&
      !r.archivedAt &&
      !result.stale &&
      !result.withdrawn &&
      result.contributorApproved &&
      result.editorApproved;
  return result;
}
export function publicationEvent(r, b, admin, actorId) {
  if (
    r.redactedAt ||
    (r.archivedAt && b.action !== "withdraw") ||
    r.submission.category !== "technical"
  )
    fail(409, "Only active technical reports can prepare a GitHub task.");
  const previous = publicationState(r);
  if (
    !admin &&
    b.action === "withdraw" &&
    previous?.withdrawn &&
    b.digest === previous.digest
  )
    return null;
  if (b.revision !== r.events.length)
    fail(409, "Report changed. Refresh before deciding.");
  if (r.events.length >= 200 && b.action !== "withdraw")
    fail(409, "Report history limit reached.");
  const action = b.action;
  if (admin && !uuid.test(actorId ?? "")) fail(403, "Named editor required.");
  const p = publicationState(r);
  let data;
  if (action === "draft") {
    if (!admin) fail(403, "Editor required.");
    if (
      typeof b.title !== "string" ||
      b.title.trim().length < 10 ||
      b.title.length > 160 ||
      /[\r\n\x00-\x1f]/.test(b.title) ||
      typeof b.body !== "string" ||
      b.body.trim().length < 30 ||
      b.body.length > 6000 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(b.body)
    )
      fail(422, "A bounded English technical title and summary are required.");
    // This is a manual summary, never automatic copying of the private submission.
    const title = b.title.trim(),
      body = b.body.trim();
    if (
      body.includes(r.id) ||
      /[#?&](?:key|token)=/i.test(body) ||
      /\/api\/contributions\//i.test(body)
    )
      fail(422, "Private tracking references cannot be exported.");
    const digest = createHash("sha256")
      .update(
        JSON.stringify({ repository, title, body, revision: r.events.length }),
      )
      .digest("hex");
    data = {
      action,
      title,
      body,
      digest,
      repository,
      sourceRevision: r.events.length,
    };
  } else {
    if (!p || b.digest !== p.digest || (p.stale && action !== "withdraw"))
      fail(409, "Draft is missing or outdated. Prepare a new draft.");
    if (action === "consent" || action === "withdraw") {
      if (action === "withdraw" && p.withdrawn && !admin) return null;
      if (admin)
        fail(
          403,
          "Only the contributor can give or withdraw publication consent.",
        );
      if (action === "consent" && p.withdrawn)
        fail(409, "Withdrawn draft cannot be reapproved; prepare a new draft.");
    } else if (action === "approve") {
      if (!admin || actorId === p.author || b.checked !== true || p.withdrawn)
        fail(
          403,
          "A second editor must check privacy, rights and technical scope.",
        );
    } else if (action === "linked") {
      if (
        !admin ||
        !p.ready ||
        !/^https:\/\/github\.com\/Madmin27\/dental-knowledge-base\/issues\/[1-9][0-9]*$/.test(
          b.issueUrl ?? "",
        )
      )
        fail(
          422,
          "An approved draft and an issue URL in the project repository are required.",
        );
    } else fail(422, "Unsupported publication action.");
    data = {
      action,
      digest: p.digest,
      ...(action === "linked" ? { issueUrl: b.issueUrl } : {}),
    };
  }
  return {
    at: new Date().toISOString(),
    actor: admin ? "maintainer" : "contributor",
    ...(admin ? { actorId } : {}),
    status: r.events.at(-1)?.status ?? "received",
    note: {
      draft: "Technical publication draft prepared; nothing sent to GitHub.",
      consent: "Contributor approved this exact public draft.",
      withdraw:
        "Contributor withdrew public-draft consent; copies already published require separate removal.",
      approve:
        "Independent editor checked this exact draft for privacy, rights and technical scope.",
      linked:
        "Editor recorded a manually created GitHub issue; no remote status synchronization.",
    }[action],
    evidence: [],
    publication: data,
  };
}
export function publicationExport(r) {
  const p = publicationState(r);
  if (!p?.ready)
    fail(
      409,
      "Contributor consent and separate editor approval of a current draft are required.",
    );
  return {
    title: p.title,
    body: p.body,
    digest: p.digest,
    repository,
  };
}
