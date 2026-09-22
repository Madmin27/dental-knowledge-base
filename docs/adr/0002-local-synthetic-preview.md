# ADR 0002 — Isolated synthetic preview

Status: Accepted for local preview only, 2026-09-22.

The user requested a live visual preview after TASK-004. The public atlas and API
are still placeholders. To make current behavior inspectable, serve a standalone
HTML/CSS/JavaScript page and read-only synthetic scenario endpoints using the
already established Node runtime. No new dependencies are needed.

This is not a choice of the eventual frontend framework, auth provider, cloud or
clinical storage. The normative architecture and TASK-005–015 sequence remain
unchanged. The UI labels its fixtures as synthetic and does not depict an invented
anatomically validated tooth. Rights scenarios execute the existing policy engine;
the demo verifier cannot access or approve real records.

Bind to localhost and use VS Code port forwarding until the user selects a public
address. Run under a dedicated systemd DynamicUser with only the three necessary
code directories mounted read-only. No DB/environment credentials are available.

The preview may be removed when the actual application becomes ready. It does not
constitute production publication, clinical validation, TASK-010 completion or an
approved asset release.
