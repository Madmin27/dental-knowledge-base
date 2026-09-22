# Reported MATE Chromium model-start failure

User reported the generic startup error on MATE Chromium after the studio revision.
The follow-up desktop test reproduced a Chrome WebGL2 blocklist failure in the
MATE/XRDP session; the user subsequently confirmed the atlas opens on another PC.

## Evidence

- Installed service and all four Z-Anatomy model/manifest files returned HTTP 200.
- Installed Chromium 153.0.8010.36 loaded the original viewer in an isolated headless
  profile without explicitly enabling unsafe software-rendering flags.
- This did not reproduce the user's error. The original catch incorrectly advised
  a WebGL-capable browser for every exception, including file and application errors.

## Changes

- Browser-selected GPU instead of requiring the high-performance preference.
- Automatic no-antialias retry on a fresh canvas; stencil preserved for interior cuts.
- Explicit compatible profile, keeping source meshes but reducing pixel ratio,
  environment processing and anatomy shadows.
- Phase-specific error messages, expandable diagnostic code/detail, reload and
  compatible-mode link; no automatic telemetry or browser-policy changes.
- Replaced removed `PCFSoftShadowMap` with the supported `PCFShadowMap` setting.

## Validation

68 JS tests passed. Seven Chromium 153 browser checks passed: normal source load,
explicit compatible mode, rejected-antialias fallback, fully blocked graphics,
source-file HTTP failure, stencil-preserving compatible interior cuts and no
uncaught exceptions. Browser faults were locally injected, not service faults.

Proof: `/tmp/dkb-load-fix/proof/`; logs: `/tmp/dkb-load-fix/`.
Installed `dental-preview.service` restarted on the unchanged LAN address; health
reported OK with both contributions and interior enabled. The MATE-specific blocklist is not fixed by these application changes. No claim
that GPU policy can be bypassed by this fix.

## Follow-up desktop evidence

A separate Google Chrome profile on the same MATE/XRDP display reproduced
`ContextResult::kFatalFailure: WebGL2 blocklisted`. `glxinfo -B` reported Mesa
llvmpipe, without hardware acceleration. Explicit ANGLE OpenGL selection did not
resolve that blocklist. Existing browser profiles and GPU policies were not changed.
The user confirmed successful access from another PC; this is functional access
confirmation, not anatomical or academic acceptance.
