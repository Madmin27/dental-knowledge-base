# Rights Registry (TASK-004)

Implements Architecture v0.1 §13 and acceptance checks AT-P0-005/006. This is
project release policy, not an automatic legal interpretation of license text.

Every asset has an immutable metadata identity and SHA-256. Rights decisions are
append-only `asset_rights` revisions. A correction/revocation is a new revision;
the old decision remains available. Rights documents retain source and permission
references, separate boolean permissions, attribution, expiry, territory, review
identity/decision, policy version, reason and correlation ID. Store opaque safe
references, never permission-document bodies, secrets or clinical metadata here.

## Manifest contract

```js
{
  territory: 'WORLDWIDE', // or the reviewed distribution territory, e.g. TR
  assets: [{
    assetId, sha256, rightsId, rightsRevision,
    attribution: 'Exact reviewed attribution text',
    use: {
      publicWebDisplay: true, modification: true, internalProcessing: true,
      redistribution: true, endUserDownload: false, sublicensing: false,
      commercialUse: true
    }
  }]
}
```

Every use flag is explicit. This gate targets the unrestricted/public core:
public web display and commercial compatibility are mandatory even when the
current UI has no advertisements. Denying end-user download does not grant
redistribution, or vice versa. The publishing service must accurately describe
its actual delivery/derivation behavior; these flags cannot be user assertions.

## Trust boundary

`createRightsGate({loadCurrent, verifyReview, clock})` defaults to denial.
`loadCurrent` must use trusted storage; `verifyReview` must authenticate the exact
record digest and a human rights reviewer/maintainer's scoped decision. A role
label, academic approval, invoice or uploaded license string alone is insufficient.
All `()=>true` verifiers in the tests are synthetic; no production verifier is
provided until the auth/reviewer tasks. A stored APPROVED label cannot bypass this
adapter. The policy distinguishes rights approval from academic/QC/privacy review.

Use `createRightsCheckedReleaseTransition` to re-evaluate on freeze, approval and
publication. The base domain engine also denies these transitions unless a trusted
rights verifier is injected. Revocation, a newer record, asset hash change, expiry
or changed manifest invalidates a previous successful evaluation. The result is
an immutable rights check snapshot, not a reusable publication credential.
Withdrawal and supersession remain possible even if rights have been revoked.

## Storage and atomic publication

Migration 003 adds only `assets` metadata and `asset_rights`; binary storage,
lineage, spatial/QC, clinical privacy and persisted releases remain later tasks.
`rightsRepository` validates writes and always reads the latest revision. A future
release service should use `withRightsTransaction(client, async repo => ...)` and
perform its release write inside that callback. It owns a READ COMMITTED
transaction; do not nest it in another transaction. Asset share locks remain held
until commit; rights insertion takes an exclusive row lock. This prevents a
concurrent rights revocation from passing unnoticed before that commit. Batch
callers should use a consistent asset order and retry transaction deadlocks.

The returned domain transition alone writes no release and publishes nothing.
Do not cache a PASS or check in autocommit and later publish outside the transaction.
The current runtime group remains read-only; a future authorized workflow needs
narrowly scoped database permissions including those needed for row locking.
Migration/owner credentials must never become application credentials.

## Policy details

- UNKNOWN/unreviewed/rejected/revoked/missing/malformed rights block.
- CC0/public domain/CC BY 4.0 still require explicit permissions and human review.
- NC requires an independently reviewed explicit permission reference.
- ND blocks requested modifications unless separate permission covers them.
- SA requires reviewed distribution-path compatibility, or independent permission.
- CUSTOM/PURCHASED and other restricted forms require an explicit reviewed reference.
- Required attribution must exactly match the frozen manifest; expiry and territory
  apply to every selected asset. Timestamps use strict UTC ISO-8601.
- Contributor-owned material requires an authority/agreement reference;
  institutional ownership additionally requires an approval reference.
- Human-derived assets are blocked pending the separate quarantine/privacy flow;
  uploading them never assigns an open license.

No real anatomical assets, patient data, provider calls or public web endpoint are
needed for the synthetic tests.
