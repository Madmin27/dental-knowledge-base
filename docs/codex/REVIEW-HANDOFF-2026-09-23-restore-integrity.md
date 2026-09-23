# Independent review handoff — restore integrity / audit #5

Status: candidate fix prepared by implementer; independent acceptance pending.
Finding: [issue #5](https://github.com/Madmin27/dental-knowledge-base/issues/5),
which remains open. No automatic closing keyword is used.

## Pinned scope

Base: `1d24f20` (the preceding independent-review documentation milestone).
Target code: `3bda01c` (restore reconciliation and expert-handover policy).
[Compare](https://github.com/Madmin27/dental-knowledge-base/compare/1d24f20...3bda01c).
This handoff supplements the earlier 2026-09-23 snapshot without rewriting it.

## Behavior

The restore reconciler verifies immutable identity fields, then requires event
histories to match for the entire length of the shorter history. Equal-length
branches must therefore be identical. Semantic comparison ignores object-key
order but preserves event order and field content. Conflicts abort before the
output directory is created; existing spool and archive are untouched.

A compatible redacted record takes precedence, but a redaction flag cannot
bypass conflicting events. Appended events beyond a redacted record, conflicting
redaction timestamps/submissions and duplicate current live/archive IDs also stop.
The tool does not choose a branch based solely on event counts.

## Executed evidence

- `python3 -m unittest discover -s tests -v`: **19 tests passed**, including seven
  new restore test methods with multiple synthetic cases.
- Ran the equal/unequal divergent-history cases against the previous committed
  script: all three were silently accepted. The same cases reject after the fix.
- Coverage includes equal and unequal branches in both directions, valid prefixes,
  identical histories, identity/submission conflicts, compatible redaction
  precedence, rewritten legacy redactions and events extending a redaction.
- Failure tests assert no destination creation and no mutation of either input.
- Clinical-data index guard and `git diff --check` passed.
- No runtime web change, restart, anatomical edit or production restore performed.
  The scheduled backup wrapper imports this script on its next execution; no new
  live scheduled-run success is claimed for this revision.
- CI must be checked for the pushed revision; local Python results are not CI proof.

## Three review questions

1. Can any unequal non-prefix or equal-length divergent event sequences still
   select a record, including with redaction metadata?
2. Is failing closed for legacy redactions sufficiently explicit and operationally
   actionable without risking revival of erased prose?
3. Are the immutable-field and pre-write checks adequate for the current spool
   format? Identify any additional corruption cases with a synthetic fixture.

## Limits and human decisions

Legacy redaction rewrites event notes/evidence and stores no pre-redaction chain
proof. A valid privacy redaction may therefore conflict with a cleartext backup:
restore intentionally stops for private operator review. No masked comparison
that could conceal divergent original prose has been introduced. Neither input
is automatically overwritten or discarded. Verifiable redaction lineage remains
future work; this fix does not claim tamper-proof or cryptographically chained logs.

Backup retention and same-host disaster-recovery limits remain unchanged. Closure
of #5 belongs to the human maintainer after evidence review, not this implementer.

Owner clarification is now recorded: prepare a realistic source-based model first;
after explicit handover to the qualified human team, AI stops autonomous anatomy
proposals/edits/review. Further anatomical AI assistance needs that team's explicit
request. Authorized software maintenance remains separate. FDI 16/36/37 and root
morphology still require qualified human review; none is claimed by this fix.
