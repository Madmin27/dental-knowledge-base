# packages/mesh-pipeline

Geometry QC, transforms and LOD processing.

TASK-001 placeholder. Implementation is deferred to its scoped task under Architecture v0.1.

## Media candidate preparation

`media-contract.mjs` implements pure planning and provenance-manifest validation
for ADR0008. It neither processes images nor authorizes jobs or publication.
Inputs must eventually be resolved from trusted server-side identity, privacy and
rights records; the present module is not wired to an HTTP upload endpoint.
Tests use synthetic metadata only. See `docs/adr/0008-media-contributions-and-model-candidates.md`.
