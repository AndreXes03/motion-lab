# Rendering and local tools

[cli.mjs](cli.mjs) is the entry point. Main commands are also available through `npm run`.

| Command | Output |
| --- | --- |
| `npm run viewer` | Local studio at `127.0.0.1:4173` |
| `npm run frame -- --time 2.4 --out renders/frame.png` | Frame at a precise time |
| `npm run contact -- --out renders/contact.png` | Contact sheet for review |
| `npm run export -- --out renders/film.mp4 --temporal-samples 24 --bitrate-mbps 6` | 1080p film with motion blur |
| `npm run export -- --sound on --out renders/film.mp4` | Video with audio; `--sound off` disables it |
| `npm run sound:bank` | Sound samples in WAV format |
| `npm run verify -- --out renders/film.mp4 --time 2.4` | Metadata and seek stability checks |

## Scene tools and presets

[controls.mjs](controls.mjs) inspects real renderer capabilities and validates the agent-authored tool layout or preset before saving it. These commands do not render or publish a film.

| Command | Result |
| --- | --- |
| `npm run controls -- catalog --scene pulse` | IDs, native bounds, paths, categories and supported animation parameters |
| `npm run controls -- plan --scene pulse --file manifest.json` | Validate a proposed panel selection without saving |
| `npm run controls -- set --scene pulse --file manifest.json` | Save only that scene's selection and rationale |
| `npm run controls -- preset-catalog --scene pulse` | Lighting, compositing and interpolation recipes |
| `npm run controls -- preset-plan --scene pulse --category lights --file profile.json` | Validate a proposed scene preset without saving |
| `npm run controls -- preset-set --scene pulse --category lights --file profile.json` | Save only that scene/category; replace an existing ID when full |
| `npm run controls -- check` | Validate every registered scene's chosen tools |

Preset categories are `lights`, `compositing` and `interpolation`. Keep at most four variants per scene/category and at most 15 native values per lighting/compositing profile. Camera/object curves use independent group clocks; advanced numeric tracks have per-target rates. See [Scene controls and motion curves](../docs/ADAPTIVE_CONTROLS.md) for exact schemas and the mandatory agent workflow.

## Local Cycles and compositing

[cycles.mjs](cycles.mjs) bakes supported Three.js scene data, freezes source/settings and invokes the local Blender renderer. The current adapter supports **PULSE only**, with PNG frames and MP4 video. Install Blender separately or set `BLENDER_PATH`; device support comes from local preflight. A requested engine is not proof of a working device.

```sh
npm run cycles -- frame --scene pulse --time 9.23 --width 384 --height 216 --samples 16 --device auto --out renders/pulse-cycles-proof.png
npm run cycles -- export --scene pulse --start 9 --duration 0.2 --width 960 --height 540 --fps 30 --samples 96 --device auto --out renders/pulse-cycles-short.mp4
```

Use a saved `--snapshot` to preserve the video's controls, group curves and per-parameter rates. The default sample count is 96; this is a setting, not a measured render-time guarantee. CLI jobs retain a source snapshot, fingerprint, frame cache and status manifest. Matching `--resume on` reuses compatible frames; changed settings or sources require a fresh output. Material/light units and color response are adapted. Raster GLSL, optical/compositing passes and deformation/texture motion blur do not transfer automatically; compare the resulting image before accepting a converted film.

[composite.mjs](composite.mjs) executes a prepared plan against rendered inputs. Renderer strategy metadata alone never runs a mixed render.

```sh
npm run composite -- --plan /path/to/plan.json --assets /path/to/rendered-layers --check true
npm run composite -- --plan /path/to/plan.json --assets /path/to/rendered-layers --out renders/composite-proof --encode true
```

The local compositor handles ordered image/frame-sequence layers, alpha, masks, restrained glow and display grading. Audio is attached only through explicit CLI options. See [Renderer selection](../docs/RENDERER_SELECTION.md) for policy, capability checks and the separate executable composition-plan contract.

The Studio's **Export settings → Renderer** chooses Auto, Three.js, Cycles or a prepared mixed strategy. PULSE's agent recommendation is Auto with a 96-sample Cycles preference; Auto still checks local support and budget. Explicit unsupported engines are blocked. Cycles supports PNG/MP4 here; Three.js also supports WebM/ProRes. Mixed currently runs through the local compositor CLI. The public Studio supports PNG frames and JSON recipes, without running Blender or video jobs.

## Test boundaries

`npm run prebuild` runs the scene-control, motion-workflow, render-policy and Cycles option contracts without a browser or Blender render. `npm run test:compositor` separately exercises small image/video encodes. `node scripts/test-renderer-studio-api.mjs` verifies Studio engine dispatch using a mocked worker; it does not establish native-render success.

`node scripts/test-cycles-studio.mjs` performs a real local Studio → Cycles → PNG proof and requires Blender, an available device and Chrome for scene baking. Browser tests such as `test-adaptive-controls-browser.mjs` and `test-scene-tools-browser.mjs` require the local Studio on port 4194. Record their actual returned results; Node contracts do not imply that browser or native-render checks passed.

[studio-api.mjs](studio-api.mjs) manages versions and render jobs. [project-store.mjs](project-store.mjs) reads and saves recipes. [reference.mjs](reference.mjs) collects references; [quality.mjs](quality.mjs) and [review.mjs](review.mjs) generate review sheets.

[soundtrack.mjs](soundtrack.mjs) adds audio to an existing video without re-encoding it, using the matching recipe. [Audio commands and controls](../docs/SOUND_DESIGN.md).

The `test-*.mjs` files check camera, timing, grain, export and APIs. Some require Chrome and write reports to `renders/`, which is excluded from Git.

[Usage](../docs/USAGE.md) · [Validation and limitations](../docs/VALIDATION.md)

`prepare-demo.mjs` installs an **already muxed local PULSE or CAMERA master** into `demo/`:

```sh
node scripts/prepare-demo.mjs --film pulse --video /absolute/path/master.mp4 --version v12 --temporal-samples 24 --poster-time 7.8
```

All five arguments are required. Before replacing files, it validates an MP4 with H.264 1920×1080/30 fps and AAC audio, the expected duration within one frame (13.9 s / 15.4 s), exactly 417 / 462 decoded video frames, size below 100 MiB, and a complete error-free audio/video decode. It extracts the poster, hashes the staged video and updates only the selected film in `demo/render-manifest.json`. Legacy global versions migrate to per-film versions; no approval is inferred. Temporal sample count is supplied provenance, not recoverable from an encoded video.

Existing video, poster and manifest are backed up under Git-ignored `renders/demo-backups/`. Each file replacement is atomic, with the manifest written last, and ordinary failures trigger rollback. This is not a filesystem-wide transaction: forced process termination or power loss between renames may require restoring the retained backup. A concurrent-run lock prevents manifest updates from racing; after a forcibly killed run, inspect the PID in `.prepare-demo.lock` before manually removing a stale lock. The script never uploads or commits files.

`export-social.mjs` makes a local delivery MP4 plus a `.mp4.json` hash/header report:

```sh
node scripts/export-social.mjs --video /absolute/path/master.mp4 --out /absolute/path/film-x.mp4 --target x
node scripts/export-social.mjs --video /absolute/path/master.mp4 --out /absolute/path/film-web.mp4 --target web
```

X uses H.264 High 4.1, slow two-pass 8 Mbps average / 10 Mbps peak / 20 Mb buffer. Web uses slow CRF 17 / 24 Mbps peak / 48 Mb buffer. Both use yuv420p, two-second GOPs, AAC-LC 48 kHz stereo at 256 kbps and faststart. Frames fit 1920×1080 (1080×1920 portrait), retain aspect ratio to even-pixel rounding and never upscale. X halves CFR sources above 30 fps to stay within Level 4.1 at 1080p; 30 fps stays 30. Web retains source CFR up to 60 fps. Variable frame rate and rates above 60 are rejected using decoded frame timestamps.

Use a square-pixel, unrotated SDR master with stereo audio and explicit color primaries, transfer, matrix and range. The filter converts the declared source color to limited-range BT.709 and writes matching tags; missing tags and HDR are rejected rather than guessed. No gain/normalization, bloom or sharpening is added. Audio is re-encoded, so it is not byte-identical to the source. Complete decode, duration/frame count, dimensions, color/audio metadata and MP4 atom order are checked before exclusive atomic installation. Existing output or report files are never overwritten; temporary files are cleaned. No publishing or upload is performed.

## Optional path-traced still

Install the isolated dependencies with `npm ci --prefix experiments/photoreal --ignore-scripts`, then use `npm run photoreal -- --asset headphones --width 640 --height 480 --samples 64 --out renders/photoreal-lab/preview`. For the published high-quality setup, see [Photorealism](../docs/PHOTOREALISM.md). Run `npm run test:photoreal` to check snapshot ownership and material adaptation. This does not change the video exporter.
