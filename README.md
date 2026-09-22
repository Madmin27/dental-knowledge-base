# DentalKnowledgeBase

Open, education-first dental anatomy knowledge base with versioned 3D assets, claims, evidence, anatomical variants, academic peer review, provenance, rights management and AI-assisted — but human-approved — revisions.

> Status: local source-based anatomy/interior viewers, private contribution intake,
> domain/rights foundation and local PostgreSQL. Public academic release and
> qualified human anatomy review remain pending.

## Explore the local preview

The installed LAN service is **http://192.168.1.192:3057/**. It includes a
28-tooth source atlas, an independent research tooth interior, source/license
records and private contribution tracking. `/overview` explains current scope.

See [preview setup](apps/preview/README.md),
[product quality roadmap](docs/PRODUCT-QUALITY-ROADMAP.md), and
[contribution guide](docs/CONTRIBUTING-ATLAS.md).

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
