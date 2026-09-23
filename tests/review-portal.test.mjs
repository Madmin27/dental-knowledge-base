import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import {
  packageInput,
  fileInput,
  assurance,
  decisionInput,
  freshReview,
  LIMITS,
  equal,
} from "../apps/review-portal/policy.mjs";
import { Vault } from "../apps/review-portal/vault.mjs";
const input = () => ({
  id: randomUUID(),
  modality: "photo",
  purpose: "Synthetic external surface study",
  authorityReference: "Synthetic permission fixture only",
  fdi: "36",
  sameSpecimen: true,
  noPatientIdentifiers: true,
  consent: {
    privateInspection: true,
    processing: true,
    inference: false,
    derivativePublication: false,
    rawPublication: false,
    training: false,
  },
});
test("photo intake separates permissions and rejects declared non-photo modalities", () => {
  assert.equal(packageInput(input()).consent.training, false);
  assert.equal(packageInput({ ...input(), fdi: "55" }).fdi, "55");
  assert.throws(() => packageInput({ ...input(), fdi: "58" }), /invalid_fdi/);
  assert.throws(
    () => packageInput({ ...input(), modality: "radiograph_2d" }),
    /photo_only/,
  );
  const x = input();
  x.consent.training = true;
  assert.throws(() => packageInput(x), /permission_not_available/);
  delete x.consent.processing;
  assert.throws(() => packageInput(x), /permission/);
});
test("file reservation restricts formats, byte ceiling and capture views", () => {
  assert.equal(
    fileInput({ type: "image/png", size: LIMITS.file, view: "unknown" }).size,
    LIMITS.file,
  );
  for (const type of [
    "image/svg+xml",
    "application/pdf",
    "application/zip",
    "application/dicom",
  ])
    assert.throws(() => fileInput({ type, size: 5, view: "front" }));
  assert.throws(() =>
    fileInput({ type: "image/png", size: LIMITS.file + 1, view: "front" }),
  );
});
test("login needs verified contact, freshly performed password and OTP authentication", () => {
  const c = {
    email_verified: true,
    amr: ["pwd", "otp"],
    auth_time: Math.floor(Date.now() / 1000),
  };
  assurance(c);
  assert.throws(() => assurance({ ...c, email_verified: false }));
  assert.throws(() => assurance({ ...c, amr: ["pwd"] }));
  assert.throws(() => assurance({ ...c, auth_time: c.auth_time - 301 }));
  assert.throws(() =>
    freshReview({ mfa: true, auth_at: new Date(Date.now() - 901000) }),
  );
});
test("privacy clearance requires four human checks and rejects identifiable pixels", () => {
  const d = {
    decision: "privacy_cleared",
    reason: "Synthetic private inspection only",
    revision: 2,
    riskTags: ["specimen_only"],
    checks: { pixels: true, metadata: true, authority: true, scope: true },
  };
  assert.equal(decisionInput(d).scope, "private_photo_inspection_only");
  assert.throws(() =>
    decisionInput({ ...d, checks: { ...d.checks, pixels: false } }),
  );
  assert.throws(() => decisionInput({ ...d, riskTags: ["identifiable"] }));
  assert.throws(() => decisionInput({ ...d, revision: 0 }));
});
test("authenticated encryption detects corruption, swapped object identity and wrong key", () => {
  const vault = new Vault("/unused", randomBytes(32)),
    bytes = Buffer.from("synthetic pixels");
  const enc = vault.seal(bytes, "object-a/raw");
  assert.deepEqual(vault.open(enc, "object-a/raw"), bytes);
  assert.throws(() => vault.open(enc, "object-b/raw"));
  const bad = Buffer.from(enc);
  bad[20] ^= 1;
  assert.throws(() => vault.open(bad, "object-a/raw"));
  assert.throws(() =>
    new Vault("/unused", randomBytes(32)).open(enc, "object-a/raw"),
  );
  assert.notEqual(vault.fingerprint(bytes), bytes.toString("hex"));
  assert.throws(() => vault.path("../escape", "raw"));
  assert.throws(() => vault.path(randomUUID(), "../raw"));
});
test("CSRF comparison does not accept missing tokens", () => {
  assert.equal(equal(undefined, undefined), false);
  assert.equal(equal("first", "other"), false);
  assert.equal(equal("same", "same"), true);
});
export { input };
