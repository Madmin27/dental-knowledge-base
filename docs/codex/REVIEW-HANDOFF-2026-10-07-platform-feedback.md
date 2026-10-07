# Independent review handoff — 7 October 2026 / platform feedback

Prepared by implementer; independent review pending.

## Pinned scope

- Base: `860c43e`.
- Code: `dd377403ab8019c47d404d92e12f3ae2db91605a`.
- Deployment: https://dentalopensource.org; existing preview/review services,
  unchanged network/authentication policies. No anatomical data changes.

## Behavior

Small, labelled pencil controls on public and portal pages open a native modal
without leaving the current task. Bug/usability/idea feedback accepts English or
Turkish, carries a separately validated platform context and appears under a
separate feedback filter in the private editorial desk. Context contains only
allowlisted page/section/topic values. No account identity, private URL parameters,
DOM, model snapshot or screenshot is captured. Fetch omits cookies and Referer.

Feedback uses existing durable intake, rate limits, backup, private tracking and
reasoned editor response mechanisms. Contributor URLs remain capability secrets;
users must retain their link because there is no member-account association yet.
Pending retries reuse the same ID/payload; invalid-input responses allow correction.
A successful receipt can be saved before starting another report. This is not a
live AI chat, automatic external-AI feed or automatic GitHub issue. Scientific
contributions remain separate. Feedback cannot enter the technical export gate.

## Evidence

- 108 npm tests passed in an isolated, network-disabled, resource-limited container;
  new API case checks category/context pairing, exact context projection, private
  tracking, idempotent resubmission and refusal of scientific/publication misuse.
- Synthetic Chromium fixture passed EN/TR desktop/mobile, separate queue filtering,
  failed-send retry with identical payload, private receipt, new-feedback reset,
  no cookies/Referer and private-view clearing after loss of authority. Mobile
  modal screenshot inspected; no horizontal overflow or JS exceptions.
- Initial browser container failed to mount an unnecessary node_modules path into
  the read-only source copy; removing that unused mount resolved setup.
- [Code CI](https://github.com/Madmin27/dental-knowledge-base/actions/runs/37655907565).
- Encrypted intake backup preceded service restarts. First immediate health request
  hit a transient startup502; subsequent health, review health and widget JS/CSS
  checks all returned200. Public and portal HTML include the widget.
- No synthetic reports were inserted in production. Actual human feedback flow
  acceptance and qualified anatomical review are not inferred from these tests.

## Review questions and limits

1. Can feedback context or public input impersonate anatomical claims/authority?
2. Do retry/receipt/private-link semantics remain safe across network failures?
3. Are private pages free of unintended URL, account or DOM capture?

Tracking is per-link, not per-account; drafts are tab-memory only and do not survive
closing the tab. The queue shares existing capacity/rate budgets. No email alerts,
unattended AI implementation, continuous reviewer or automatic scientific acceptance
was added. Editors must check the separate feedback queue. OTP/role-based onboarding
changes discussed with the owner remain outside this change.
