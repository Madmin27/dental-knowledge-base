# Z-Anatomy dental subset — source and compatibility record

2026-09-22. Engineering assessment; NOT a human rights/academic approval, a DB
asset_rights record, or authorization to mark any asset published.

## Decision and source

The user rejected the procedural mouth as visually inadequate and authorized
research/building an open, free educational atlas without proprietary paid assets.
The replacement candidate uses existing anatomical surface meshes, not generated
capsules. Local LAN preview only; public educational release remains pending.

Pinned upstream: https://github.com/LluisV/Z-Anatomy/tree/6c7f9016bd5899ac8edafd31b9900c151df42ed6

Files: Resources/Models/FBX/SkeletalSystem100.fbx and VisceralSystem100.fbx.
SHA-256 values and original URLs are recorded in the distributed dentition.json.
The raw FBX files stay outside Git in the local research workspace. No clinical
volume, patient scan or identifying metadata was ingested.

Source license: https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/License.txt

Required credits are retained verbatim in ATTRIBUTION.txt and the viewer:
BodyParts3D / The Database Center for Life Science / CC BY-SA 2.1 Japan;
Z-Anatomy / The open source atlas of anatomy / CC BY-SA 4.0.
Lluís Vinent Juanico's FBX distribution is linked separately. No endorsement implied.

## ShareAlike compatibility assessment

The dental derivative and contributions are distributed under CC BY-SA 4.0 with
the upstream 2.1 Japan attribution/terms preserved, not relicensed as unrestricted
project-owned content. Both licenses remain visible. CC's official FAQ says
ShareAlike versions after 1.0 permit a later version for the adapter's contribution;
original terms still apply to the original material. The exact Japanese legalcode
endpoint was inaccessible during this run; that limitation is recorded rather
than replaced with a claim of legal clearance.

Official guidance: https://creativecommons.org/faq/#if-i-derive-or-adapt-material-offered-under-a-creative-commons-license-which-cc-licenses-can-i-use
License: https://creativecommons.org/licenses/by-sa/4.0/

Technical compatibility: standalone anatomy binary+manifest, unchanged upstream
notice, license text, visible credit and direct downloads without DRM. Application
code and anatomy content remain separate. No paid asset, subscription, per-seat
fee or runtime commercial model service. An open license allowing commercial use
is not a paid/proprietary commercial license.

The upstream bundle has NC exceptions for other structures. Extraction uses an
explicit tooth-name map, Gingiva, Mandible and Maxilla.l/.r only. No inner ear,
kidney or nerves included. Tests bind the 34 allowed output structures and hash.

## Transformations and anatomical limits

28 permanent teeth (FDI 11–17,21–27,31–37,41–47), three disconnected gingiva
components, mandible and two maxilla components. Source material boundaries
between crown/root are preserved; they are NOT enamel/dentin volume segmentation.

Blender 4.0.2: extract subset, preserve world transforms before detaching parents,
separate loose gingiva components, one Catmull-Clark subdivision for presentation,
source metres to millimetres and rigid axis conversion, smooth normals, binary
packing. Coordinates preserve the original assembly. No deformation to invent
ideal alignment. Subdivision is a presentation modification, not extra anatomical
evidence. Material colors and lights are illustrative, not captured tissue colors.

The jaw-separation slider translates the lower assembly for inspection; it is not
TMJ motion, occlusion simulation or a quantitative distance tool. Source third
molars are absent; no copies are synthesized. No pulp/canal/interior toggles,
cut planes or hollow surfaces pretending to be internal anatomy. No demographic
claim about a male in his thirties. Root display is the source external geometry.

BodyParts3D itself flags possible anatomical errors and artistic modifications:
https://lifesciencedb.jp/bp3d/info_en/index.html

## Reproduction

Download the two pinned URLs in dentition.json to an external SOURCE_DIR.
The extractor refuses source hashes different from those reviewed here:

    blender -b --threads 2 --python scripts/assets/build_z_anatomy.py -- SOURCE_DIR OUTPUT_DIR

The build was rerun directly from FBX and its output is shipped. An earlier
intermediate .blend reload changed only normal floating-point results, not
positions or structure metadata; it is not the shipped path. No claim of
byte-identical output across Blender versions/platforms.

## Team and publication boundary

Gateway DeepSeek deepseek-flash reviewed an anonymous design summary, not meshes
or code. It emphasized explicit missing anatomy, source hashes, exclusion of NC
structures, license lineage and visual checks. We implemented these checks and
consulted official CC guidance for its version-compatibility question. Its remark
calling LMU incompatible is not adopted: LMU's obstacle here is older treated
specimens and raw-data processing/privacy review, not its CC BY-SA license.

Before student publication: named dental/anatomy reviewer verifies FDI mapping,
cusps, root morphology, gingival margins, source-to-display changes and limitations;
record rights and academic decisions through the project's existing gates. These
are human evidence, not values an AI should invent. No published DB status set.
