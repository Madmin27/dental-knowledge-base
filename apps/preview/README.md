# Source anatomy candidate and rights preview

The landing route `/` (also `/anatomy`) now uses a pinned Z-Anatomy dental subset
extracted in Blender: 28 teeth, gingiva and jaw bones. The procedural atlas was
rejected for visual quality; ADR0004 supersedes its use as the landing screen.
The previous status/rights screen stays at `/overview`.

This source has no pulp/canal volumes, no third molars and no independently
verified 30s-male demographic. The viewer does not invent them. Local engineering
candidate, not an approved student release. See docs/assets/Z-ANATOMY-REVIEW.md
and docs/research/REALISM-RECOVERY-2026-09-22.md.

`npm test` includes source hash, geometry, FDI, license distribution and HTTP
checks alongside the existing suites. `node scripts/vendor-three.mjs` refreshes
pinned local Three.js, OrbitControls and RoomEnvironment with its MIT license.

Model conversion is reproducible from hash-checked external source files:

```sh
blender -b --threads 2 --python scripts/assets/build_z_anatomy.py -- SOURCE_DIR OUTPUT_DIR
```

With a separate local debugging Chrome instance open to the preview, replay the
source-model browser checks (Node 20 requires the WebSocket flag):

```sh
node --experimental-websocket scripts/validate_anatomy_browser.mjs \
  http://127.0.0.1:9222 http://192.168.1.192:3057/ /tmp/dkb-anatomy-proof
```

Browser emulation is not physical-device performance or academic verification.
Close the isolated debugging browser after validation.

## Previous rights-scenario preview

A separate, read-only preview of project status and the existing rights engine.
It is not TASK-010's 3D viewer or a public clinical/educational release. It accepts
only six fixed scenario IDs, uses synthetic in-memory fixtures, and imports the
real rights gate. The synthetic review registry recognizes only the locally
constructed fixture digest; it cannot grant rights to a caller-provided record.

No database, `.env`, uploads, filesystem browsing or external AI calls.
Only the named reviewed-source anatomy files are allowlisted for local preview.
`/health` explicitly reports `databaseConnected: false`. Only GET is supported;
static files are allowlisted. The 64-test figure on the page is a dated TASK-004
verification record, not a real-time CI indicator. Two additional preview tests
cover the scenarios, read-only HTTP boundary and file disclosure attempts.

```sh
node apps/preview/server.mjs
node tests/preview.test.mjs
```

The standalone command defaults to **127.0.0.1:3057**. The installed service uses
`PREVIEW_HOST=192.168.1.192`, so LAN clients open **http://192.168.1.192:3057/**.
UFW permits only 192.168.1.0/24 to this TCP port and denies other sources. No router
port forwarding is configured. Set PREVIEW_HOST to a specific IPv4 address to
change the binding; wildcard binding is rejected.

The installed `dental-preview.service` is defined in `infra/dental-preview.service`.
It uses DynamicUser, a read-only filesystem, and explicit read-only bindings for
preview/domain/rights code. It cannot access the repository's .env or database.

```sh
systemctl status dental-preview
systemctl restart dental-preview
systemctl disable --now dental-preview  # stop and remove startup activation
```

No public hostname or Nginx route was configured; port 3057 is allowed only on LAN. A public URL needs
the chosen hostname/path and corresponding proxy configuration. Health and HTTP
scenario checks passed after service installation; desktop 1440px and mobile
390px browser checks confirmed the approval/NC-denial interactions and no mobile
overflow. Local screenshot proof: /tmp/dkb-preview-proof/desktop.png and mobile.png.

## Tissue inspection

Gingiva transparency runs from 0% (opaque) to 100% (hidden); partial transparency
reveals the original root surfaces without removing the gingiva. Bone opacity is
independent. The tissue preset turns on six source nerve and eight artery surfaces,
80% gingiva transparency and 85% bone transparency. Nerves/arteries retain the
source jaw pose (separation zero); no intrapulpal/venous/capillary network is implied.
See docs/ATLAS-QUALITY-PLAN.md for remaining student-publication acceptance work.

## Root / tissue context correction

The initial assembly now includes bone at the source pose (jaw separation zero).
Gingiva transparency brings in bony context and adjusts its transparency on a
5-percent step; the separate bone slider remains available. Whole-mouth root
inspection cannot hide bone completely (minimum opacity 15%). No anatomy mesh
was reshaped. A permanent explanation distinguishes layered inspection from a
complete external mouth. The three study presets reset only display state.
The former 15-percent gingiva / hidden-bone case is a browser regression case.
An expert review scenario pack is in docs/EXPERT-REVIEW-PACK.md; it has not been
signed or treated as academic acceptance.

## Atlas katkı kuyruğu

Üst menüde **Katkıda bulun**: sürümlü yapı/görünümle bildirim, özel takip, ek açıklama, bakımcı geçmişi. Kurulum, bakımcı CLI, gizlilik ve yedek: [katkı rehberi](../../docs/CONTRIBUTING-ATLAS.md). Ayrı StateDirectory ve systemd credential gerekir; yapılandırılmadığında katkı yazımı kapalıdır. Akademik kabul/yayın yetkisi vermez.
