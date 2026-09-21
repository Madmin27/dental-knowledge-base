# TASK-002 — Domain IDs, classifications and state machines

Status (2026-09-16): architectural feedback from
`CHATGPT-TASK002-DESIGN-REVIEW-20260916-01` applied; code review pending.
TASK-001 has technical PASS but is not a merged baseline. See
[the design and implementation contract](TASK-002-design-review.md), especially
section 6. PostgreSQL/migrations remain TASK-003. This module is not a real
policy/authorization provider; the trusted synchronous verifier is injected.

Objective: implement the independent domain vocabulary and transition rules in
Architecture v0.1. TASK-001 implementation and CI were inspected on 2026-09-07;
PR #2 remains a draft. This task is a separate, stacked change.

Allowed scope: `packages/domain`, domain tests, repository test commands and this
task record. No schema migrations, API, UI, auth provider or external AI calls.

Invariants: internal IDs are notation-independent; class, evidence grade and
consensus are orthogonal; AI cannot approve or publish; terminal history is not
rewritten. Domain transitions return a new object and an audit event.

Acceptance: opaque IDs survive notation changes (current generator: UUID v4); accepted E3 variants are valid;
illegal state jumps fail; AI approval/publishing fails; issue-to-variant resolution
retains history; frozen published releases cannot be edited by transitions.

Node's standard library is sufficient for this standalone module and its tests;
no product framework or provider decision is made. Review/quorum, persistence,
authorization and transaction boundaries are implemented in later scoped tasks.

Rollback: revert the TASK-002 commit; no data migration is needed.
