# ADR 0004 — Replace rejected procedural landing with a source anatomy candidate

2026-09-22. Accepted for local engineering preview by the user's request to
research and build an openly licensed realistic educational atlas.

ADR0003's procedural geometry was explicitly rejected for visual quality. Replace
the landing experience with a pinned dental-only Z-Anatomy derivative prepared in
Blender. Retain Three.js/Node preview stack and LAN service. No framework change,
clinical volume ingestion, database mutation or external public launch.

Source model licensing/compatibility, provenance, modifications and limitations
are recorded in docs/assets/Z-ANATOMY-REVIEW.md. This is not an automated rights
approval or completion of the existing academic publication gates.

Do not synthesize missing teeth or pulp. The source has 28 teeth and exterior
surfaces. Remove the old simulated internal anatomy from the default experience.
Preserve source credits, share-alike terms and derivative downloads.

Rollback: revert this change to a7617b7 and restart only dental-preview.service;
that restores the rejected prototype for technical rollback, not user acceptance.
