# Third-party software and research

Framevolve uses the installed packages listed below. Their original
license and notice files are preserved under [`licenses/`](licenses/). Package
versions are those in the tested `package-lock.json`; reinstalling dependencies
may change them within the declared version ranges.

| Component | Tested version | License / source | Use |
| --- | --- | --- | --- |
| [three.js](https://github.com/mrdoob/three.js) | 0.186.1 | [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE) | WebGL scene, geometry, materials, lights, cameras |
| [Playwright](https://github.com/microsoft/playwright) and playwright-core | 1.64.0 | [Apache 2.0](https://github.com/microsoft/playwright/blob/main/LICENSE), [NOTICE](https://github.com/microsoft/playwright/blob/main/NOTICE) | Local Chromium control and frame screenshots |
| [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) | 5.3.0 | GPL 3.0 or later for the npm package; see copied `LICENSE` | Locates a local FFmpeg executable for video encoding |
| [ffprobe-static](https://github.com/joshwnj/ffprobe-static) | 3.1.0 | MIT; see copied `LICENSE` | Locates a local ffprobe executable for output inspection |
| [Vite](https://github.com/vitejs/vite) | 8.3.4 | [MIT](https://github.com/vitejs/vite/blob/main/LICENSE.md) | Local viewer server and asset build |
| [sharp](https://github.com/lovell/sharp) | 0.35.5 | [Apache 2.0](https://github.com/lovell/sharp/blob/main/LICENSE) | Contact-sheet image assembly |

Three.js addons include RoundedBoxGeometry, RoomEnvironment, GTAOPass,
RectAreaLightUniformsLib and toCreasedNormals under the same MIT notice.

The bundled FFmpeg executable found at `node_modules/ffmpeg-static/ffmpeg` was
verified locally as FFmpeg 6.0. Its configure flags include `--enable-gpl`,
`--enable-version3`, `--enable-libx264` and `--enable-nonfree`. FFmpeg's own
[legal notes](https://ffmpeg.org/legal.html) explain that GPL components change
the applicable license; the package's copied `ffmpeg.LICENSE` states that an
`--enable-nonfree` binary is unredistributable. Therefore the deliverable should
contain the project files and lockfile, **not `node_modules` or this executable**.
Running `npm install` installs the required local toolchain on the user's
machine. A separate system `ffmpeg` was not present during testing.

## Demo assets

The wind texture in `src/assets/audio/wind-magnific.mp3` was generated with
Magnific / ElevenLabs. [Provenance](src/assets/audio/provenance.json) records
its source and use. This generated audio asset is separate from the application
license. The editable application synthesizes its fallback music locally.

The PULSE and CAMERA demo films include music downloaded through the project
owner’s Artlist account:

- PULSE: [Mansij — RoboRhythm](https://artlist.io/royalty-free-music/song/roborhythm/132753).
- CAMERA: [Evgeny Bardyuzha — Let It Drop (Instrumental version)](https://artlist.io/royalty-free-music/song/let-it-drop-instrumental-version/116014).

These soundtracks are separately licensed stock assets, not application code. The
original tracks and standalone edited stems are not distributed in this
repository. Obtain your own appropriate music rights when reusing them.

Demo marks and visual assets retain their owners’ rights. The Andrea Salvo
logo belongs to its owner. Their inclusion does not grant rights to reuse the
marks, and the application license does not cover them.

## References

[Howseen’s motion-design repository](https://github.com/howseen-ai/claude-motion-design)
was studied for seeking, frame capture and encoding. No code or media was copied.

## Helvetiker Bold

Font JSON from the official Three.js examples. Copyright (c) 2004 MAGENTA Ltd. The embedded permission notice is also retained in `src/assets/fonts/LICENSE.txt`.

## Optional Photorealism experiment

Installed separately with `npm ci --prefix experiments/photoreal --ignore-scripts`.
These packages are not added to the main application or the Pages studio bundle.

| Component | Pinned version | License | Use |
| --- | --- | --- | --- |
| [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer/tree/v0.0.24) | 0.0.24 | MIT | Optional WebGL path-traced stills |
| [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | 0.9.1 | MIT | Ray intersection acceleration |
| [xatlas-web](https://github.com/mozillareality/xatlas-web) | 0.1.0 | MIT | Upstream dependency; no atlas generation in this test |
| Three.js | 0.181.2 | MIT | Isolated version for this experiment |

Original notices are retained in `licenses/photoreal/`. The rendered headphones,
surface maps and studio lighting reuse Motion Lab code; no external HDR image or
AI-generated bitmap is used for this test.

## Studio interface icons

The interface uses Flaticon Uicons Regular Rounded 3.3.1. The local sprite's
original package source, version, checksum and included glyphs are recorded in
[the source manifest](public/vendor/uicons/SOURCE.json); the upstream
[Flaticon License](public/vendor/uicons/LICENSE.txt) is preserved separately.
These icons are third-party assets, not Andrea Salvo's code and not MIT assets.
They are interface controls, not an icon library offered for reuse or rendering.

The project owner reports a paid Flaticon subscription. Flaticon's
[official terms, section 8.1](https://www.flaticon.com/legal) permit use without
visible attribution when the relevant content is downloaded during the Premium
subscription. The currently recorded acquisition is the public npm package,
without an account-specific Premium download certificate. Until that acquisition
is verified or replaced with a documented Premium download, the existing Uicons
credit is retained. Do not discard upstream license/provenance files, or infer
that this subscription relicenses icons for other users' independent reuse.

## Space Grotesk

LOOP editorial headlines use embedded glyph outlines from Space Grotesk at weight 600.
Source: [Space Grotesk by Florian Karsten](https://github.com/floriankarsten/space-grotesk),
distributed through [Google Fonts](https://github.com/google/fonts/tree/main/ofl/spacegrotesk).
The [SIL Open Font License](src/assets/fonts/space-grotesk-OFL.txt) is preserved.
The [outline asset](src/assets/fonts/space-grotesk-headlines.json) records provenance,
weight and checksum. No system font installation is required. The official logo is separate.
