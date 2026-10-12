# Validation and evidence

## Scene tools and renderer contracts, October 12, 2026

The current release adds 104 catalog controls across eight scenes, independent camera/object group clocks, per-parameter rates, curated scene presets and browser-local preview quality. These are implementation and contract results; this section does not assert a completed Pages deployment or approval of newly converted films.

Confirmed checks:

- `npm run prebuild`: scene-control contract, motion workflow, render policy and Cycles option/dispatch contract passed.
- The scene contract covers all eight saved tool layouts, safe paths and category taxonomy, universal neutral contrast/saturation, group windows, bounded presets and renderer recommendations.
- The motion workflow validates independent group clocks, identity/outside/disabled behavior, per-parameter rate migration, preset schemas and API round trips. Neutral display grading performs no pixel read/write.
- `npm run test:compositor`: alpha, identity, masks, grading, glow, frame timing, bounded asset paths, small H.264 encodes and explicit audio passed.
- Four browser suites passed: 8 scene layouts and legacy migration, key editing and undo, deterministic 2D/3D switching, preset batches and Custom state, independent camera/group clocks, input coalescing and mobile 480 px preview limits. Public-build checks passed with no local API requests.
- `node scripts/test-renderer-studio-api.mjs`: mocked Studio dispatch passed. A mock worker confirms routing, capability rejection and metadata preservation; it is not a Blender or device render.

Keep the following evidence separate:

| Check | Scope and required evidence |
| --- | --- |
| `test-adaptive-controls-browser.mjs` | Actual local Studio key editing, undo/redo, recipes and preview/renderer comparisons; requires Chrome and Studio on port 4194 |
| `test-scene-tools-browser.mjs` | Actual scene panels, filters, motion targets and legacy selections; requires the same local Studio |
| `scripts/cycles/test-browser.mjs` | Browser baking/scene adapter checks; does not alone prove Blender produced an output |
| `test-cycles-studio.mjs` | Real Studio → local Blender/Cycles → PNG job; record completed status, device, samples, dimensions and retained frame proof after it finishes |
| A converted video | Complete decode, duration/frame count, metadata and arbitrary seek, followed by contact-sheet/playback visual inspection |
| Public deployment | Confirm the completed deployment and inspect the deployed page separately from a local build |

A real Studio → Cycles → PNG job completed on Metal (Apple M4 Max), at 384 × 216 and 16 samples. The retained local proof is `outputs/release-review/cycles-studio-frame.png`. A separate real Studio → Mixed → PNG proof matched the prepared Cycles RGBA and graphic-layer composite byte for byte. PULSE is the supported Cycles scene; its Auto recommendation prefers 96 samples but still requires local capability checks. Cycles currently exports PNG/MP4. Three.js also supports WebM/ProRes, and prepared Mixed output runs through Studio after plan, asset, dimensions and timeline preflight; the compositor CLI remains available. An unsupported explicit engine is blocked.

Fast/Auto/Balanced/Sharp preview preferences stay outside the recipe/API. Full-effect final output uses separate dimensions, frame rate and sampling; fast-preview simplifications must not leak into saved controls or an export. Group curves change only their declared pose clock, not cuts, captions, music or film duration. Renderer conversion can change materials, light units and color response, and does not transfer all raster shaders or optical passes.

The reports below describe earlier retained checks and deliveries. Their dates and media measurements are historical evidence; they do not validate this release's browser/native paths or publication.

## Earlier publication checks, October 10, 2026

Checked on October 10, 2026, on macOS with Chrome and Node.js 25.8.1.

- Vite build passed, with a bundle-size warning.
- Camera, grain and temporal sampling checks passed.
- Short MP4 exports at 24/25/30/50/60 fps, WebM and ProRes passed.
- Studio API, version saving, rendering and persistence passed.
- Runtime: 6 of 7 checks passed. Switching 2D → 3D → 2D changes the 2D pixels; returning to 3D passes.
- 3D web demo: 1920 × 1080, 25 fps, 250 frames, 10 seconds, H.264 yuv420p, 24 temporal samples, 6 Mb/s target bitrate, 7,451,311 bytes, stereo AAC at 48 kHz. Full decoding and identical-hash seeking passed.
- Gyroscope cover: 2.4-second frame with 24 samples and no corner logo. Frames from the new video and real UI screenshots were visually checked.
- 3D depth of field: on/off, restoration, deterministic seeking, inspection bypass, UI and version saving passed (`node scripts/test-dof.mjs`). Disabled by default.
- Procedural demo: 1080p, 30 fps, 300 frames, 10 seconds, stereo AAC at 48 kHz, 132 BPM techno and 57 SFX. No client references in the text.

## Audio

Dedicated checks: `npm run test:sound`, `node scripts/test-sound-browser.mjs`, `node scripts/test-sound-2d.mjs` and `node scripts/test-sound-2d-browser.mjs`. Synthesis, 2D/3D movement, transport, WAV and persistence passed on the public checkout.

Browser checks covered 202 3D events and 35 2D events, unchanged frames, play/pause/seek, WAV, BPM and recipes without errors. 2D exports with audio on and off passed. The 3D demo audio mux preserves all 250 video packets unchanged.

Technical validation does not establish listening or creative approval. Windows and Linux have not been tested.

The public copy excludes previous Git history, personal references and screenshots, local versions, logs, intermediate output, caches and installed dependencies. Selected text was checked for personal paths, email addresses and common credential patterns. Third-party notices retain their original attribution.

The crisp procedural update preserves decoded audio exactly. Order/Chaos exported with one or four temporal samples produces identical PNG pixels.

## Dark studio and public browser preview

Checked October 10, 2026: English interface, live scene backdrop, contextual controls, expandable recipe/source panel, deterministic relative object edits and parameter validation. Five targeted checks passed. The static Pages build was checked without a local API: scene switching, version storage in the browser, undo and source inspection. Video export and project references require the local app.


## Product-film refinement, October 11, 2026

PULSE and CAMERA now include layered hardware, restrained material variation,
selective extreme optics, close camera passes and bounded impact recoil. PULSE
shows the rear speaker assembly and separated display electronics; CAMERA's
final assembly replaces decorative particles with visible mechanical details.

- The public Vite build passes (existing bundle-size warning remains).
- Frame-cache checks pass (7 cases); temporal-sampling checks pass (12 cases).
- Delivery-tool validation passes 23 checks, including real short X/web encodes.
- New motion is seek-deterministic at PULSE 9.8 s and CAMERA 14.65 s, tested at
  480 × 270 with intervening seeks and identical PNG hashes.
- CAMERA's constrained blade animation retains positive vertical clearance
  across 860 sampled assembly poses. This is a targeted assembly check, not
  a general-purpose collision simulation.
- Three-frame MP4, WebM and ProRes exports decode with BT.709 color. ProRes
  carries nclc 1/1/1 in its MOV container; the bundled legacy ffprobe omits those
  fields, so they were also checked with the FFmpeg decoder.
- Clean stills and short motion clips were inspected before the full export.

The repository product-film skill documents framing, functional construction,
material scale, clearance, review, and delivery. Premium and supersampled presets
use source/settings-fingerprinted resumable frames; changed sources do not reuse
stale frames. The social exporter checks color metadata, timestamps, audio,
complete decoding and faststart before producing a delivery report.


The final audio revision keeps the selected music edits sample-identical before
AAC encoding and replaces the previous effect layers with three quiet contacts
per film. Effect peaks are at or below −26.5 dBFS; the PCM masters measure
−14.08 LUFS / −3.72 dBTP (PULSE) and −14.04 LUFS / −6.69 dBTP (CAMERA), with
no clipped samples. These measurements verify levels, not subjective sound quality.

Final deliveries: PULSE 417 frames / 13.9 s and CAMERA 462 frames / 15.4 s,
1920 × 1080 at 30 fps, downsampled from 2560 × 1440 / 48-sample renders.
H.264 High 4.1, yuv420p, BT.709 limited range, stereo AAC-LC at 48 kHz,
faststart, complete decoding and frame counts are verified. Website copies use
CRF 17 with a bitrate cap; X copies use two-pass 8 Mb/s average / 10 Mb/s peak.
The corrected PULSE audio was muxed without changing any video packet. Final
compressed contact sheets and new posters were inspected. DOT and REPLAY media
are unchanged.
