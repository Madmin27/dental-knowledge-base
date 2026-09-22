# Interactive atlas and synthetic preview

The landing route `/` now serves the schematic 3D atlas. The previous status and
rights-scenario screen remains at `/overview`. See ADR 0003 and the atlas research
report for sources, limitations, tests and rollback. Geometry is generated locally;
no clinical scan or actual age/sex-specific source has been ingested. The target
persona (male in his thirties) is distinct from the generic adult model displayed.

## Atlas verification

`npm test` runs the domain, rights, HTTP preview and atlas geometry suites.
`node scripts/vendor-three.mjs` refreshes local browser files from the exact
Three.js dependency; its MIT license is retained alongside them.

For browser replay, open the preview in a separate Chrome instance with remote
debugging enabled. Pass its local debugging endpoint, preview URL and proof
directory (Node 20 needs the experimental WebSocket flag):

```sh
node --experimental-websocket scripts/validate_atlas_browser.mjs \
  http://127.0.0.1:9222 http://192.168.1.192:3057/ /tmp/dkb-atlas-proof
```

The replay exercises 15 flows and writes screenshots and browser-result.json.
Mobile emulation verifies interaction/layout, not physical-device performance
or anatomical correctness. Keep the debugging endpoint local and close that
test browser after verification.

## Previous rights-scenario preview

A separate, read-only preview of project status and the existing rights engine.
It is not TASK-010's 3D viewer or a public clinical/educational release. It accepts
only six fixed scenario IDs, uses synthetic in-memory fixtures, and imports the
real rights gate. The synthetic review registry recognizes only the locally
constructed fixture digest; it cannot grant rights to a caller-provided record.

No database, `.env`, uploads, assets, filesystem browsing or external AI calls.
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
