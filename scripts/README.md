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
