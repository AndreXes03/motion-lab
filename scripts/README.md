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
