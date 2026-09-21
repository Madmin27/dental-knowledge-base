# No Clinical Data in Git

No raw or potentially identifiable human-derived clinical data may be committed to this repository.

Examples:
- DICOM studies/series
- raw CBCT volumes
- patient radiographs
- patient-linked intraoral scans
- exports containing patient metadata
- quarantine contents
- de-identification working files

Engineering tests must use synthetic, generated or explicitly non-identifiable fixtures.

See Architecture v0.1 for the full quarantine boundary.

## Repository enforcement

Run `python3 scripts/check_clinical_data.py` after staging changes. CI runs the
same check on the checked-out index. Restricted paths fail even when force-added
or already tracked. Matching is case-insensitive and includes compressed suffixes.

Blocked extensions: `.dcm`, `.dicom`, `.ima`, `.nii`, `.nrrd`, `.mha`, `.mhd`,
`.raw`, `.vol`. Blocked directory names: `quarantine`, `clinical-raw`,
`patient-data`. The exact `services/quarantine` directory is a source-code boundary
and is allowed; restricted extensions and nested runtime directories there still fail.
Runtime clinical data must remain outside the repository.

Tests generate harmless text in temporary repositories, including restricted
filenames, and clean up afterwards. Do not commit restricted binary fixtures.

This guard detects obvious filenames, not identifiable content in arbitrary
images, meshes, archives or renamed files. It does not scan Git history and does
not replace privacy review. The guard omits offending filenames from its output
because filenames may themselves contain identifiers.

A failure must be resolved before commit/push. Remove the restricted content from
the index without publishing it. If real data has already entered history, stop
publication and arrange a privacy/security remediation; deleting the current
file does not remove historical copies.
