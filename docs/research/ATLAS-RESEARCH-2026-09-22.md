# Atlas research and implementation decision — 2026-09-22

## Goal and scope

User requested thorough repository research and a deployed, interactive adult
full-mouth atlas: orbit/pan/zoom, tooth selection, roots and internal layers.
Target persona: male in his thirties. No approved age/sex-specific source exists
in this project; the displayed geometry is explicitly a generic schematic adult
model. This milestone implements a viewer preview, not completion of TASK-005–015.

## Sources inspected

- Periospot: https://www.periospot.com/anatomy/explore
  Web reader failed; direct HTML fetched successfully. Metadata calls it source
  head/neck/oral anatomy and distinguishes reviewed text from unverified geometry.
  Interaction inspiration only; no copied assets or interface source.
- User's X example: https://x.com/DentalAkimoto/status/2096462767750537350
  Web reader failed; direct HTML metadata read successfully. Description mentions
  free 3D observation, isolated bone/muscle/nerve/vessel layers and movement.
  The video itself was not played/verified; movement simulation is not this scope.
- https://github.com/choxos/OMFAtlas
  Inspected README, dental-geometry.js, dental.js, package.json and MIT LICENSE;
  revision c835665a9ade09ee0b993cee6eee1b25b7f7311b.
  Useful patterns: selected-tooth isolation, tissue toggles, clipping caps,
  distinguishing schematic geometry from patient sources. Code was researched,
  not vendored. Our geometry/camera/UI implementation is original.
  Its asset licenses are separate from its MIT application code. Attribution:
  https://github.com/choxos/OMFAtlas/blob/main/public/models/dental/ATTRIBUTION.md
  Synthetic lower-jaw source is a future CC BY 4.0 candidate:
  https://doi.org/10.17632/xjsx7nfhj8.1
  It lacks pulp. Do not fabricate a patient's internal structures by combining
  unrelated sources. No mesh/archive/patient data was downloaded or ingested.
- https://github.com/Z-Anatomy/Models and
  https://github.com/vixotic/Vanatome/blob/main/ASSET-LICENSE.md
  Broader head/neck atlas direction; attribution/ShareAlike require explicit review.
  No models ingested; normative rights/privacy gate remains unchanged.
- https://threejs.org/docs/pages/OrbitControls.html
  Orbit, pan, dolly, touch and camera-target contract. Three.js 0.186.0 pinned from
  npm, MIT license retained, files served locally with no CDN/import-map dependency.
- https://www.mouthhealthy.org/all-topics-a-z/eruption-charts
  Primary-source permanent dentition reference, not approval of our mesh geometry.

## Implementation plan completed

1. Preserve previous preview at /overview and the rights engine/DB untouched.
2. Serve atlas at /: 32 FDI teeth, optional third-molar exclusion (28), upper/lower
   filters, schematic mouth opening, roots and gingiva visibility.
3. Tooth selection by chart or raycast; orbit/pan/dolly, presets and automatic
   whole-mouth/isolated-tooth scale transition with cooldown; explicit return.
4. Higher sampling in isolated mode, tissue toggles, outer opacity, section slider
   and transparent internal view. Increasing sampling is not source-detail recovery.
5. Procedural 3D root paths (not a flat projection), caps computed per shell from
   triangle/plane intersections; schematically simplified, not clinical tolerances.
6. Runtime tests, desktop/mobile browser evidence and LAN service verification.

## Limits and next academic milestone

No dimensional measurement, wear, pathology, dynamic occlusion, full skull,
vascular/nerve model, microscopic tissue or population-specific morphometry.
Different actual canal patterns, including MB2 and C-shaped variants, must not be
inferred from this schema. Third molars are optional, not universally present.
Our cap boundary sorting is appropriate only for these simple shells; it is not a
validated general-purpose capper for arbitrary branched/disconnected scan meshes.
Single-plane cuts need not intersect every 3D root/canal. Transparent view exposes
other branches without pretending all lie in one plane.

Next credible milestone: one rights-cleared, versioned dental source in physical
units, inspected by a qualified anatomy/dental reviewer, with explicit morphology,
orientation, tissue continuity, root/canal and source-registration acceptance
criteria. Initial cases remain FDI 16/36/37 per architecture. Source/derivative
hashes, reviewer evidence and rights decisions belong to the existing workflow.

## Team consultation

Gateway deepseek/deepseek-flash reviewed an anonymous design summary only. It
supported the workflow and prioritized FDI/28–32 consistency, device interaction,
and persistent schematic labels in isolated/cut views. We added a persistent
in-canvas label. Rendering tests do not establish academic correctness. Advice
that keyboard/fallback tests were missing was a question from limited context,
not a confirmed defect. No code or clinical data was transmitted.

## Validation and deployment

Four geometry tests (all 32 FDI identities, patient-side positions, finite tissue
meshes, outward root orientation, variable sections), existing domain/rights and
HTTP preview regressions. Chrome desktop 1600×1000 and emulated mobile 390×844:
raycast selection, orbit, jaw/third-molar filters, tooth isolation, section movement,
layer hiding, reset, source dialog, resource disposal and responsive controls.
GPU geometry counts stabilized across repeated focus/return cycles.

Final run: 39 JavaScript tests (16 domain, 17 rights, 2 HTTP preview, 4 atlas)
and 10 Python clinical-data guard tests passed. The existing 21 PostgreSQL tests
were not rerun for this viewer-only change. Fifteen browser flows passed with no
runtime exceptions, including actual CDP touch-pinch input, transparent canals,
persistent labels and automatic whole-mouth/tooth zoom transitions. The browser
test caught reversed zoom-button behavior, which was corrected before this run.

Browser proof is local under /tmp/dkb-atlas-proof. Software-rendered headless
Chrome is not a benchmark of a student's phone/GPU. Physical mobile-device user
acceptance remains separate. The UI renders on demand and pauses when hidden;
it caps pixel ratio and reuses/disposes scene resources.

Deployment: existing dental-preview.service, 192.168.1.192:3057, LAN-only UFW.
Rollback to prior preview: route / to index.html rather than atlas.html and restart
only dental-preview. Database migrations and clinical rights records unchanged.
