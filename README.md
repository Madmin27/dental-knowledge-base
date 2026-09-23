# Dental Open Source

*A community for open dental knowledge, anatomy and education.*

Public preview: **https://dentalopensource.org/**. Let's Encrypt TLS is installed;
the owner has confirmed external access. Public access is not academic approval.
The internal project directory and repository retain the DentalKnowledgeBase /
dental-knowledge-base identifiers so existing deployments and links keep working.

GitHub holds code and public implementation-review findings. Contributions, academic discussion, dissent, voting
and reasoned decisions will remain on our own platform. See
[self-hosted governance design](docs/adr/0007-self-hosted-academic-governance.md)
for the delivery plan and the distinction between current intake and planned portal.

Open, education-first dental anatomy knowledge base with versioned 3D assets, claims, evidence, anatomical variants, academic peer review, provenance, rights management and AI-assisted — but human-approved — revisions.

> Status: local source-based anatomy/interior viewers, private contribution intake,
> domain/rights foundation and local PostgreSQL. Public academic release and
> qualified human anatomy review remain pending.

## Explore the preview

The installed preview is **https://dentalopensource.org/**; Nginx proxies to a
loopback-only backend. The former direct LAN `:3057` endpoint is retired. It includes a
28-tooth source atlas, an independent research tooth interior, source/license
records and private contribution tracking. `/overview` explains current scope.

See [preview setup](apps/preview/README.md),
[product quality roadmap](docs/PRODUCT-QUALITY-ROADMAP.md), and
[contribution guide](docs/CONTRIBUTING-ATLAS.md).

## Independent review

Follow the [advisory review policy](docs/INDEPENDENT-REVIEW.md) established by
[issue #4](https://github.com/Madmin27/dental-knowledge-base/issues/4).
The implementer leaves a dated handoff after substantial milestones; a separate
reviewer reports findings and human maintainers decide closure.
Latest: [2026-09-23 handoff](docs/codex/REVIEW-HANDOFF-2026-09-23.md).

## Start here

- `docs/architecture/DENTAL_KNOWLEDGE_BASE_ARCHITECTURE_v0.1.md`
- `docs/codex/TASK-001-repository-scaffold.md`
- `docs/adr/0000-template.md`

## Core rule

**AI may propose. Qualified humans approve. Published history is not silently rewritten.**

## Repository checks

Prerequisites for TASK-001 tooling: Git and Python 3 (standard library only).
This does not select a product runtime or framework.

After staging your intended changes, run from the repository root:

```sh
python3 scripts/check_clinical_data.py
python3 -m unittest discover -s tests -v
node tests/domain.test.mjs
git diff --cached --check
```

GitHub Actions runs the guard and synthetic tests on pushes and pull requests.
The guard inspects the entire current Git index, including force-added files.
It does not inspect untracked files, old commits or file contents. Passing it is
not privacy clearance. See [clinical data policy](docs/privacy/NO_CLINICAL_DATA_IN_GIT.md).

## Original foundation sequence

1. TASK-001: scaffold and repository guards; review the resulting PR.
2. TASK-002: scoped domain IDs, enums and state machines after TASK-001 review.
3. Continue the task sequence in Architecture v0.1, with tests for each increment.

The TASK-001 instructions above describe the original scaffold milestone.
Current viewer and contribution implementation details are documented separately
in `apps/preview/README.md`; the roadmap distinguishes implemented preview features
from pending academic, persistence and public-release work.

## Local database foundation

See [local development](docs/LOCAL-DEVELOPMENT.md) for reproducible setup,
synthetic integration tests, migration checks and the read-only runtime role.
