# Realistic atlas recovery — 2026-09-22

## Acceptance change

The prior procedural prototype was rejected by the user. Passing interaction
tests did not establish visual or anatomical quality. It is no longer the default
screen. Its commit a7617b7 is retained as a rollback/history point, not a successful
anatomy milestone.

The immediate replacement is an open anatomical source model, extracted in
Blender and shown in Three.js. It is a better source-based inspection candidate;
we do not call it photorealistic or ready for student publication. Photographic
tissue appearance and reviewed internal anatomy remain unresolved.

## Candidate research

| Candidate | Verified access / license | Decision |
| --- | --- | --- |
| Z-Anatomy / BodyParts3D | Pinned FBX files and model-specific license, CC BY-SA lineage | Extracted dental-only candidate; details in ../assets/Z-ANATOMY-REVIEW.md |
| University of Dundee, first-molar pulp | Official Sketchfab API returned empty license object for efcb762c4fab4a9b806b4abaf33e10dc | Not downloaded/copied; a viewable model is not a redistribution license |
| LMU Data 477 | Institutional page CC BY-SA 4.0; README describes older body-donor specimens, preparation, disease/restoration and segmented micro-CT | Potential separate advanced-study specimen, not a healthy 30s reference; no raw volume imported |
| Aichi / Kato tooth models | Downloadable micro-CT-derived tooth surfaces, some interior structures available on request; no clear reuse license verified | Not imported; permission needed before adaptation/public distribution |
| Diaz synthetic jaw via OMFAtlas | CC BY 4.0 lower-jaw study; no gingiva or pulp | Incomplete for the current full-mouth/gingiva visual target |
| Open-Full-Jaw / ToothFairy3 | Patient-specific data with separate licenses; not generic demographic anatomy | Not imported; requires separate privacy/source review and does not automatically solve tissue appearance |

Sources:
- https://github.com/LluisV/Z-Anatomy/tree/PC-Version/Resources/Models
- https://www.dundee.ac.uk/dentistry/elearning-support
- https://api.sketchfab.com/v3/models/efcb762c4fab4a9b806b4abaf33e10dc
- https://data.ub.uni-muenchen.de/477/ and /477/3/SWIRendo_Readme.txt
- https://a-kato.agu.ac.jp/English/bottom.html
- https://github.com/choxos/OMFAtlas/blob/main/public/models/dental/ATTRIBUTION.md
- https://doi.org/10.17632/xjsx7nfhj8.1

No paid/proprietary asset bought, no AI-generated mesh, no mesh ripped from a
web viewer, and no contact sent to model authors without authorization.

## Work sequence and remaining educational scope

1. Completed: source/license research, extraction of 28 teeth+gingiva+jawbones,
   fixed-source hashes, Blender visual inspection, browser integration.
2. Completed: select by FDI or mouse, isolate source tooth with roots, jaw filters,
   roots/gingiva and bone views, orbit/pan/zoom, mobile touch, attribution/downloads.
3. Next source milestone: a licensed registered crown/dentin/pulp specimen with
   verified provenance, orientation and anatomy. Do not fill Z-Anatomy with
   guessed canals. Treat different donors/datasets as separate examples, not a
   single mouth. Dundee permission or a reviewed openly licensed specimen are
   possible paths, not already secured assets.
4. Before student launch: expert review of exterior and internal examples,
   persisted rights/academic approvals, scope/limitations visible to students,
   actual device acceptance and public hosting configuration.

## Evidence

Local proof directory: /tmp/dkb-realism-research. Blender render and desktop,
mobile, FDI36 root view and bone view were visually inspected. A first mobile
capture clipped the model; camera framing was changed to fit visible source bounds
and aspect ratio. This is a source model with illustrative materials, not a scan
texture or proof of anatomy accuracy. Automated test totals and live check are
recorded after final deployment below.

Final verification: 42 JavaScript tests (16 domain, 17 rights, 2 HTTP preview,
4 legacy geometry, 3 source-asset tests) and 10 Python guard tests passed.
Eleven browser flows passed locally and on the LAN service: source count,
raycast selection, jaw/FDI mapping, source-root isolation, stable GPU geometry
counts [31,31,31], zoom direction, bone/root controls, attribution/download links,
mobile layout, touch pinch and no runtime exceptions. Existing DB tests were
not rerun; DB/migrations are unchanged. Screenshots: live-proof/mouth-final.png,
tooth36.png, bones.png, roots.png, mobile.png in the local proof directory.

LAN deployment uses the existing dental-preview.service on 192.168.1.192:3057.
Health reports anatomy-preview, databaseConnected=false. No UFW, Nginx, router
or public domain changes. Temporary testing used localhost:3058 only.
