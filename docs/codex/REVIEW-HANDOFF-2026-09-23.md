# Independent review handoff — contribution reliability and viewer loading

Status: prepared by the implementation agent; independent review **pending**.
Policy: [independent review](../INDEPENDENT-REVIEW.md),
[issue #4](https://github.com/Madmin27/dental-knowledge-base/issues/4).
This supersedes the operational snapshot in the 2026-09-22 handoff, not its history.

## Pinned scope

- Base: `c1848e026d3e3726ae082a883f5655d0c2029e08`.
- Target: `0735b591037c2b16aac82e6395fb01067b7c30ab`.
- [Compare](https://github.com/Madmin27/dental-knowledge-base/compare/c1848e026d3e3726ae082a883f5655d0c2029e08...0735b591037c2b16aac82e6395fb01067b7c30ab).
- Milestones: `c75accd` contribution reliability/backups, `0735b59` viewer loading.
- Live URL: https://dentalopensource.org/. The changes were applied from this
  checkout and dental-preview restarted before the final code commit. Health,
  loading and cache behavior were checked. Runtime has no commit-attestation
  endpoint, so HTTP health alone cannot prove the deployed Git SHA.
- Relevant contracts: ADR0005–0007, expert pilot pack, source asset reviews.

## Behavior and boundaries

Contribution drafts survive modal closure; language switching guards unsaved
work. Follow-up events have stable retry IDs. `/report` works without 3D. Intake
trusts the client-IP header only from the configured loopback proxy; contributor
history leaves moderator capacity. Closed records can be archived without
losing tracking or privacy-redaction capability. A daily encrypted same-host
backup includes a decrypt/restore drill and retains 14 successful snapshots.

Viewer downloads show received MB and initialization stages. A 45-second idle
limit, reset by received bytes, and five-minute total deadline bound transfers.
A separate boot script handles module failures and 90-second no-progress startup
stalls while the main thread remains responsive. Public model assets use SHA-256
ETag revalidation; private APIs retain no-store. Geometry was not changed.

The 28-tooth Z-Anatomy specimen and research interior remain separate sources.
No pulpa/vascular geometry was invented. No individual reviewer accounts, MFA,
academic panel, votes, publication approval or expert recruitment were completed.

## Evidence and reproduction

- `c75accd`: 77 Node tests, 12 Python tests; seven contribution browser checks and
  four draft/report checks using an isolated synthetic localhost intake.
- Viewer follow-up: full suite of 80 Node tests passed before adding one additional
  progressing-stream test; the updated viewer-runtime test file then passed.
- Final target [CI](https://github.com/Madmin27/dental-knowledge-base/actions/runs/35907631294)
  completed successfully, verified at handoff preparation. Earlier milestone
  [CI](https://github.com/Madmin27/dental-knowledge-base/actions/runs/35906879393)
  also succeeded. CI is not anatomical acceptance or device-performance proof.
- Reproduce with `npm ci --ignore-scripts`, `npm test`, and
  `python3 -m unittest discover -s tests -v`. Integration tests use synthetic data;
  use the documented isolated PostgreSQL setup for `npm run test:db`.
- `scripts/validate_loading_browser.mjs CDP_URL PREVIEW_URL` needs Node 22+ and a
  disposable Chromium profile. It injects browser-local faults, performs no writes,
  and checks normal rendering, blocked modules, stalled transfer and recovery.
- Live: 28 teeth rendered; conditional public model request returned 304; private
  backup route returned 404; backend bound to loopback; backup service succeeded.
  The initial real intake was empty. Nonempty restore cases used synthetic data.
- Browser screenshots/logs are local temporary proofs, not shared repository
  artifacts. Independent research meshes remain outside Git; reproduce per
  `docs/assets/KANG-PULP-REVIEW.md`, or explicitly mark interior checks unavailable.

## Three review questions

1. Do stable event IDs, conflict handling, history reservation, archive/redaction
   and restore reconciliation preserve privacy and ordering across retries/crashes?
2. Can download/boot timeouts, caches or GPU work still leave a misleading loading
   state? Verify cold/warm cache, slow transfer, blocked module and real-device UX.
3. Do UI/docs accurately distinguish main specimen, independent interior, current
   anonymous intake and planned expert governance, without implying approval?

## Known limits and next human decisions

- Owner reported intermittent HTTPS loading. It reproduced neither as a permanent
  server outage nor a specific client fault. Repeated full downloads were a
  confirmed inefficiency; improvements do not prove the original cause resolved.
- Main-thread/GPU hangs cannot be interrupted by JavaScript timers. The model is
  roughly 14 MB and over one million triangles. Real-device performance needs
  independent testing; compatible graphics preserves the same source geometry.
- Optional nerve/artery asset failure still blocks full atlas startup. File
  errors now have a deadline; partial-layer fallback is not implemented.
- Drafts are page-memory only and can be lost on browser crash. Capability tracking
  links are not verified reviewer identities. Shared networks share an IP budget.
- Same-host backup does not survive disk/server loss. Redaction does not rewrite
  old encrypted snapshots; operators must apply the documented erasure policy.
  Lost current tombstones prevent complete reconciliation of later erasures.
- First administrator identity, scoped OIDC/MFA moderation and external backups
  remain pending; automated backup-failure notifications are not configured.
- Root morphology / FDI 16, 36, 37, gingiva, root–bone and nerve/artery presentation
  need qualified dental/anatomy reviewers using `EXPERT-REVIEW-PACK.md`. Automated
  checks cannot settle these findings. No human acceptance is recorded here.
- Rollback: code base above plus deployment notes in
  `docs/OPERATIONS-CONTRIBUTIONS.md`. Do not roll back contribution state by blindly
  restoring old files; reconcile newer events and privacy tombstones first.

Human maintainers decide priority and closure. This handoff neither closes issue
#4 nor requests academic/publication approval from the AI reviewer.
