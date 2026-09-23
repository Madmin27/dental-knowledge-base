import { createHash, timingSafeEqual } from "node:crypto";

export const LIMITS = Object.freeze({
  file: 20 * 1024 ** 2,
  chunk: 1024 ** 2,
  pixels: 40_000_000,
  files: 120,
  package: 512 * 1024 ** 2,
  account: 1024 ** 3,
  daily: 512 * 1024 ** 2,
  global: 20 * 1024 ** 3,
  reserve: 2 * 1024 ** 3,
  packages: 20,
});
export class Denied extends Error {
  constructor(code, status = 400) {
    super(code);
    this.status = status;
  }
}
export const requireThat = (test, code, status = 400) => {
  if (!test) throw new Denied(code, status);
};
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export const id = (value) => {
  requireThat(
    typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        value,
      ),
    "invalid_id",
  );
  return value;
};
export function equal(a, b) {
  return (
    typeof a === "string" &&
    typeof b === "string" &&
    a.length === b.length &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
export function text(value, max = 2000) {
  requireThat(
    typeof value === "string" &&
      value.trim().length >= 3 &&
      value.length <= max &&
      !/[\x00-\x08\x0b-\x1f]/.test(value),
    "invalid_text",
  );
  return value.trim();
}
export function packageInput(input) {
  requireThat(input.modality === "photo", "photo_only");
  requireThat(
    input.sameSpecimen === true && input.noPatientIdentifiers === true,
    "specimen_declaration_required",
  );
  const consent = input.consent;
  requireThat(
    consent?.privateInspection === true && consent?.processing === true,
    "processing_permission_required",
  );
  // Future permissions deliberately unavailable in this photo-only pilot.
  for (const key of [
    "inference",
    "derivativePublication",
    "rawPublication",
    "training",
  ])
    requireThat(consent[key] === false, "permission_not_available");
  requireThat(
    input.fdi === "unknown" || /^(?:[1-4][1-8]|[5-8][1-5])$/.test(input.fdi),
    "invalid_fdi",
  );
  return {
    modality: "photo",
    purpose: text(input.purpose),
    authorityReference: text(input.authorityReference),
    fdi: input.fdi,
    consent: {
      privateInspection: true,
      processing: true,
      inference: false,
      derivativePublication: false,
      rawPublication: false,
      training: false,
    },
    policy: "private-photo-pilot-v1",
  };
}
export function fileInput(input) {
  requireThat(["image/jpeg", "image/png"].includes(input.type), "photo_only");
  requireThat(
    Number.isSafeInteger(input.size) &&
      input.size > 0 &&
      input.size <= LIMITS.file,
    "file_limit",
    413,
  );
  requireThat(
    [
      "front",
      "back",
      "left",
      "right",
      "occlusal",
      "root_apex",
      "oblique",
      "unknown",
    ].includes(input.view),
    "invalid_view",
  );
  return { type: input.type, size: input.size, view: input.view };
}
export function assurance(claims, now = Date.now()) {
  requireThat(claims.email_verified === true, "verified_contact_required", 403);
  requireThat(
    Array.isArray(claims.amr) &&
      claims.amr.includes("otp") &&
      claims.amr.includes("pwd"),
    "mfa_required",
    403,
  );
  requireThat(
    Number.isInteger(claims.auth_time) &&
      claims.auth_time * 1000 <= now + 30000 &&
      now - claims.auth_time * 1000 <= 300000,
    "fresh_login_required",
    403,
  );
}
export function freshReview(session, now = Date.now()) {
  requireThat(
    session.mfa === true &&
      now - new Date(session.auth_at).getTime() <= 15 * 60 * 1000,
    "reauthenticate",
    403,
  );
}
export function decisionInput(input) {
  requireThat(
    ["privacy_cleared", "needs_information", "rejected"].includes(
      input.decision,
    ),
    "invalid_decision",
  );
  const checks = input.checks;
  requireThat(
    checks && typeof checks === "object" && !Array.isArray(checks),
    "checklist_required",
  );
  if (input.decision === "privacy_cleared")
    for (const key of ["pixels", "metadata", "authority", "scope"])
      requireThat(checks[key] === true, "checklist_required");
  const allowed = [
    "specimen_only",
    "linked_research",
    "clinical_context",
    "identifiable",
  ];
  requireThat(
    Array.isArray(input.riskTags) &&
      input.riskTags.length > 0 &&
      input.riskTags.every((x) => allowed.includes(x)),
    "risk_tags_required",
  );
  if (input.decision === "privacy_cleared")
    requireThat(
      !input.riskTags.includes("identifiable"),
      "identifiable_not_clearable",
    );
  requireThat(
    Number.isSafeInteger(input.revision) && input.revision > 0,
    "invalid_revision",
  );
  return {
    decision: input.decision,
    reason: text(input.reason),
    checks: Object.fromEntries(
      ["pixels", "metadata", "authority", "scope"].map((k) => [
        k,
        checks[k] === true,
      ]),
    ),
    riskTags: [...new Set(input.riskTags)],
    revision: input.revision,
    scope: "private_photo_inspection_only",
  };
}
