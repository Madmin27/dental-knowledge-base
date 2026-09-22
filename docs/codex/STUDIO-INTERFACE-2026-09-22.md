# Studio interface revision — 2026-09-22

## Outcome

A shared modern interface now serves the source anatomy viewer, separate research
interior, project/rights overview and private contribution pages. Main changes:
light/dark UI, common navigation, darker model background, clearer panels, FDI/name
search, focused-canvas keyboard controls, fullscreen/fallback, help and source
access on mobile, and reload action for WebGL failure/context loss.

Project/README descriptions now acknowledge the working source viewers and
contribution intake. Static TASK-004 test-count advertising was removed from the
project page. A new product roadmap lists human review, persisted governance,
English/Latin content, real-device acceptance and public operation separately.

No anatomical mesh, demographic assertion, license, academic approval or database
record was changed. No new runtime package, paid asset or plugin was needed.
The existing name is retained while the public name/domain remains undecided.

## Verification

- `npm test`: 63 tests passed (domain, rights, HTTP boundary, original atlas,
  source assets, contributions, anatomical review contract, interior).
- Python repository guard suite: 10 tests passed.
- `git diff --check` and restricted-clinical-path guard passed.
- Anatomy browser suite: 20 checks passed; local and installed LAN viewer.
- Interior browser suite: 18 checks passed against temporary intake, including
  view replay; 17 read-only checks also passed against installed LAN viewer.
- Contribution browser suite: 7 checks passed using temporary intake only;
  private tracking, hostile-text rendering, evidence history, maintenance updates,
  view replay and mobile form fit.
- New studio browser suite: 12 checks passed on installed LAN; search across jaw
  filters, accent-insensitive search, absent teeth, keyboard rotation, theme
  persistence, help/source access, fullscreen, reload after simulated context loss,
  responsive navigation, mobile interior controls, current overview and no runtime
  exceptions. The context-loss test dispatches an event; it is not a GPU crash test.
- Screenshots inspected at desktop and 390px, light/dark; no page overflow also
  checked at 360, 768 and 1024px. A final narrow-screen interior inset keeps the
  source description and legend outside the model viewport.

Proofs and test logs: `/tmp/dkb-studio-review/` (temporary local artifacts).
Original preview backup: `/tmp/dkb-studio-review/preview-before.tar.gz`.
The browser used software WebGL in a separate profile; this does not establish
physical-phone performance or anatomical correctness. User acceptance is pending.

## Installed service

`dental-preview.service` restarted on its existing LAN address:
`http://192.168.1.192:3057/`. `/health` returned OK with contributions and interior
research enabled. Shared styles/script/favicon and four pages returned HTTP 200.
No public DNS/HTTPS, firewall, database or contribution storage changes.

## Next work

Follow `../PRODUCT-QUALITY-ROADMAP.md`. This interface iteration is not the
completion of all governance tasks or authorization to label the atlas academically
validated. Source limitations and the separation of the two specimens remain visible.
