# Independent review handoff

Review the current `main`, especially the source atlas, contribution intake,
independent tooth-interior viewer, studio UI and graphics recovery changes.

## Entry points

- `apps/preview/README.md`: runtime, local service and browser test instructions.
- `docs/PRODUCT-QUALITY-ROADMAP.md`: implemented features versus pending work.
- `docs/EXPERT-REVIEW-PACK.md`: concrete anatomical inspection scenarios.
- `docs/assets/Z-ANATOMY-REVIEW.md` and `docs/assets/KANG-PULP-REVIEW.md`:
  provenance, rights and scientific limitations of the two separate sources.
- `docs/codex/STUDIO-INTERFACE-2026-09-22.md`: UI change and verification record.
- `docs/codex/GRAPHICS-RECOVERY-2026-09-22.md`: reproduced MATE/XRDP limitation.
- ADR0005/0006: private intake and evidence-bound variant/reviewer contracts.

The research-interior mesh files are deliberately outside Git. Reproduction
requires the documented source conversion and `RESEARCH_ASSET_DIR`; absence of
those assets in a fresh checkout is not an unexplained viewer failure.

## Requested review

1. Find reproducible defects in source geometry handling, FDI selection, source
   pose, translucency, section caps, camera and mobile/keyboard interaction.
2. Check that the independent research interior is not presented as the interior
   of the 28-tooth specimen. Identify misleading teaching claims with evidence.
3. Review private contribution authorization, input handling, source/version/view
   binding and tracking. Use isolated synthetic intake for write tests.
4. Review graphics fallback, classification of errors, failure recovery and
   resource behavior. A headless pass is not a physical-device performance result.
5. Identify concrete license/provenance gaps from primary source records.
6. Separate present defects from roadmap features (verified reviewer identity,
   persisted panel voting, GitHub issue coordination, English/Latin content and
   public HTTPS are not claimed complete).

Report severity, file:line, reproduction, expected versus actual behavior,
impact and minimal remedy. Distinguish executed tests from hypotheses. Do not
access or publish real contribution storage, credentials or private tracking URLs.

## Current evidence and limits

Local application tests: 68 passed; repository guard tests: 10 passed in the prior
studio iteration. Browser evidence and exact scopes are in the two change reports.
GPU failure was reproduced in a separate profile on the MATE/XRDP display:
Chrome logged `WebGL2 blocklisted`; the user confirmed the site works on another PC.
Qualified human anatomical acceptance, public release and real-phone performance
are still pending. `/tmp` screenshot proofs are local artifacts, not GitHub assets.
