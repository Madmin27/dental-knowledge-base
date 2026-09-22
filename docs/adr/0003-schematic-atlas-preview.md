# ADR 0003 — Local Three.js atlas preview

Status: Accepted for engineering preview, 2026-09-22.

User explicitly requested prioritizing a working full-mouth atlas after research.
Use pinned Three.js 0.186.0 (MIT), locally served ES modules and OrbitControls;
keep the existing Node read-only preview and no frontend framework selection.
This adds a viewer experiment ahead of the full TASK-010 workflow without claiming
that evidence/reviewer/lineage/QC tasks or issue annotations are complete.

Original procedural geometry avoids importing unreviewed clinical or incompatible
third-party datasets merely to reach a rendering milestone. It is labeled generic
adult, schematic, not age/sex-validated and not a diagnostic or measured model.
Anatomical publication still requires the original architecture's gates. No
clinical data, external model generation or DB access is introduced.

Vendor files are copied from the pinned npm package with its MIT license; the
OrbitControls import is rewritten to its local module. Updating dependencies
requires regenerating vendor files and visual/regression checks. No npm lifecycle
scripts, CDN or externally fetched runtime anatomy assets.

Research, acceptance criteria, limitations and rollback:
docs/research/ATLAS-RESEARCH-2026-09-22.md.
