# Preparing a visual contribution

Status: preparation guide. File upload and AI generation are not yet available.
Do not send clinical images through GitHub issues, public links or the text form.
No new scan, clinical procedure or tooth extraction is requested for this project.
Use only existing material you are authorized to contribute.

## Extracted-tooth photographs

Keep each tooth in its own set. Assign an opaque specimen label unrelated to patient
identity. Record the FDI number if known; otherwise use unknown. Indicate fractures,
restorations, wear and missing regions instead of presenting them as intact anatomy.

Include buccal/labial, lingual/palatal, mesial, distal, occlusal/incisal and apical
views where feasible. For reconstruction, add overlapping intermediate angles and
multiple heights around the same stable tooth. Six reference photographs alone do
not guarantee reconstruction. Use even lighting, focus and consistent exposure;
avoid strong glare and filters. Preserve originals; do not use AI enhancement,
background replacement or geometry-changing edits as source evidence.

Use a documented scale/calibration reference visible with the specimen when
available. If no calibrated scale exists, label dimensions unknown. When rotating
or repositioning the tooth, identify the capture groups and how they relate; don't
silently mix poses or teeth. Leave unavailable areas marked missing. Photograph
handling and any specimen preparation must follow the contributor's institutional
rules; this guide does not prescribe biological-sample handling.

Before a future upload, check background labels, faces, paperwork, reflections,
filenames and metadata. The platform must still perform its own privacy review.
Camera calibration fields needed for reconstruction can be retained in a reviewed
structured record; patient/location metadata must not be copied indiscriminately.

## Radiographs and volumetric images

Identify the imaging type, region and existing-image purpose, without patient
identifiers. Do not describe a panoramic image as CBCT. Keep calibration, orientation
and series provenance available for the restricted reviewer; screenshots/cropped
exports may lose essential geometry and can be unsuitable for reconstruction.

Removing a name or DICOM header is not sufficient evidence of anonymization. Pixel
text, embedded metadata and recognizable anatomy also need review. Do not upload
until the controlled clinical channel is enabled and the relevant permissions are
recorded. A permission to process does not automatically permit publication or AI
training. Human privacy review and rights review remain separate from anatomy.

## What experts will see

They receive the approved source derivatives, candidate model, support/missing-data
map, method/version/configuration, scale limitations, QC report and the submitter's
English explanation. They may request more evidence, reject, revise or accept a
specific educational use. One 2D radiograph does not automatically establish the
specimen's exact 3D shape; inferred portions stay labelled.

Even an accepted model remains open to evidence-backed criticism. New findings
attach to the exact version; changes produce a new version with a new decision.

See [the design and delivery gates](adr/0008-media-contributions-and-model-candidates.md).
