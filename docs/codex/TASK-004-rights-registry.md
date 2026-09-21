# TASK-004 — Rights Registry and release gate

Implements Architecture v0.1 §13, §23, AT-P0-005 and AT-P0-006 without changing the
normative architecture or applied migrations 001/002.

Migration 003 introduces immutable asset metadata and append-only rights decisions.
An asset version is identified by opaque ID and SHA-256; every manifest pins an
exact rights ID/revision. The gate loads the current revision, so a pinned approval
cannot hide a later rejection/revocation. Domain release freeze/approve/publish now
requires an explicit trusted rights verifier. The asynchronous rights wrapper
checks actual records rather than accepting a client-supplied PASS.

The registry records separate display, modification, internal processing,
redistribution, download, sublicensing and commercial permissions; provenance,
permission references, attribution, expiry, territory and human rights review
remain distinct. Contributor/institutional authority references are enforced.
Clinical/human-derived assets remain blocked until privacy tasks implement their
separate approval path. NC requires independent permission; unknown rights block.

See packages/rights/README.md for the manifest, trust boundary and transaction
contract. Authentication, academic quorum, clinical privacy, storage/lineage and
persisted releases are not claimed complete by this task. The runtime group has
no write authority. A rights result is one required gate, not full release approval.

Validation: 17 rights tests, 16 domain tests (including all 368 transition pairs),
21 PostgreSQL tests and 10 clinical-path tests. The new cases cover restricted
licenses, expiry during/after asynchronous checking, territory, attribution,
invalid/stale bindings, missing trusted adapters, approved-record database checks,
immutable history, latest-revocation rejection, rights/release locking and
transaction rollback. Tests contain synthetic data and synthetic trusted verifiers.

An attempted external gateway code review was rejected by automatic approval
review; no code was sent and no external review result is claimed. Local review
and automated checks are the evidence for this implementation.

Local development migration 003 was applied after tests. The container remained
healthy on 127.0.0.1:55432. Read-only runtime SELECT on both new tables succeeded;
assets/rights counts and leftover test-schema count were zero. No service, port,
GitHub push, remote CI or deployment change is claimed.
