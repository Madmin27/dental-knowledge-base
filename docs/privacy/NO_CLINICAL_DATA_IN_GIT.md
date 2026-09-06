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
