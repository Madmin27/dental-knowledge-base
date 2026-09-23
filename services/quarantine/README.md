# services/quarantine

Isolated clinical ingestion service source code only. Never store clinical files here.

`photo-processor/` implements the invited JPEG/PNG pilot's malware scan and
metadata-free review derivative. It runs unprivileged without network, DB access,
vault key or web exposure. The separate definitions updater never receives photos.
See [private photo pilot](../../docs/PRIVATE-PHOTO-PILOT.md). Radiographs, volumes,
AI inference and public model generation remain outside this worker.
