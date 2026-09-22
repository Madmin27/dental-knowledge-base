# API and event contracts

`anatomical-review.mjs` implements the ADR0006 v1 variant-context and reasoned
review data contracts. `validateVariantProfile` checks source/evidence references,
explicit unknown demographics, primary/permanent FDI, independent developmental
context, coverage limitations and scoped population claims. `createReviewDossier`
binds criterion-by-criterion rationale to the entire profile digest and rubric.

These functions validate structure, not truth, expertise, authentication or
publication. Evidence IDs must be resolved and rights/privacy checked by the
future trusted repository adapter. The review engine must independently check
specialty, current role grants, conflicts, frozen roster/quorum and editor signoff.
A successful draft always has `authorizationGranted: false`.

`node tests/anatomical-review.test.mjs` uses synthetic fixtures only. No patient
records, source demographic assertions or real reviewer decisions are introduced.
See [ADR0006](../../docs/adr/0006-variant-context-and-reasoned-review.md).
