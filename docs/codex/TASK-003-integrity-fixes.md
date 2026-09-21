# TASK-003 review corrections

Baseline: 034ed9fb0a0259d16c7dfc6bcca36a7ba53dd453. Review findings R1–R4.

- R1: initial/noninitial claim audit source shape CHECK plus statement-wide
  assessment validation against its immutable predecessor. No new column or
  history backfill. Multi-row reverse-order revision insertion remains valid.
- R2: statement-wide recursive traversal rejects supersession cycles. UNION
  deduplication terminates invalid loops. Migration validates old graphs under an
  exclusive table lock; ordinary inserts use no global advisory lock. This relies
  on immutable references and immediate FK enforcement, not on a general claim
  that graph triggers eliminate write skew.
- R3: role configuration rejects database/schema/relation/function owners before
  any grant modifications. Existing role privilege/membership checks remain.
- R4: fresh unused audit events independently mismatch claim/revision/target
  state, checking exact 23503 and FK name. Removing that FK in a rolled-back test
  transaction makes the rejection assertion fail; a positive control succeeds.

Validation on local PostgreSQL 17: 17/17 integration tests, including COPY, CTE,
2/3-node cycles, branching, competing successor transactions, assessment races,
pre-existing invalid-history rollback, valid-history preservation and ownership
refusal. Domain 16/16 and clinical-path guard 10/10 passed. Existing 001 unchanged.

No patient data or anatomical seed. All regression fixtures use temporary schemas
and synthetic rows. Runtime role still has no write workflow. Large-chain
performance and production workload behavior were not benchmarked. Tests are not
academic review, clinical validation or publication approval.
