# Usage

Motion Lab is a local rendering engine for Three.js scenes and Canvas2D motion graphics. The 3D test is a 10-second film with a radio, mechanical emblem and gyroscope. The gyroscope uses deterministic kinematics, rather than a physics simulation. The procedural demo builds generative graphics directly from code.

## Start

Requires Node.js, npm and Google Chrome on macOS:

```sh
npm ci
node scripts/cli.mjs viewer
```

The viewer opens at `http://127.0.0.1:4173/`. Choose a 3D or procedural project, a preset and scene controls. Moment buttons jump to useful shots; advanced settings and references have separate panels.

The layout controls offer a balanced view, expanded controls and a large video. Drag the divider or use arrow keys to resize the panel. Layout and panel width persist in the browser.

## Render

The gear beside Export controls resolution up to 4K, frame rate, MP4/WebM/ProRes, bitrate and motion blur quality. Finishing controls grain and shutter angle. See [Compositing](COMPOSITING.md).

```sh
node scripts/cli.mjs frame --time 2.8 --out renders/frame.png
node scripts/cli.mjs contact --samples 6 --out renders/contact.png
node scripts/cli.mjs preview --out renders/preview.mp4 --temporal-samples 8
node scripts/cli.mjs export --out renders/film.mp4 --temporal-samples 16
node scripts/cli.mjs verify --time 2.8 --out renders/film.mp4
```

`frame` evaluates one time; `contact` produces six review frames. Preview defaults to 960 × 540; export to 1920 × 1080, encoded through FFmpeg. CLI output is JSON with status, paths and errors. Use `--start` and `--end` on frame boundaries to export a section. `--width`, `--height` and `--parameters '{"display":"TEST"}'` create variants without editing the saved scene.

`verify` checks the same frame after different seeks and, with `--out`, video metadata. Enable modular 2D/3D audio with `--sound on`; `--sound off` produces silent video. See [Sound design](SOUND_DESIGN.md).

Only one render can run at a time. The export panel shows history, errors, file paths and open/download/Finder actions. Viewer exports go to Downloads; history persists after restart. The CLI's Chrome path is configured in `scripts/cli.mjs`.

## Versions and recipes

Save version stores complete settings in `project/versions/`. Restore them from the menu or transfer them as JSON recipes. Preview and export use the current settings; links marked demo open existing films.

Each render writes a `.project.json` sidecar with its settings. It does not receive live viewer changes. Use `--snapshot renders/film.mp4.project.json` to reproduce a frame; verification automatically uses the video's sidecar.

Source fingerprints flag a render as invalid if code changes during rendering. There is no isolated source copy: finish rendering before editing sources. Viewer and export share compositing; temporal blur is calculated during export.

`project/look.json` defines camera, lights, surfaces, post-processing and motion strength. Viewer changes are previews; saving the look writes the recipe and keeps the previous version in `project/history/`. `project/motion.json` contains stable tracks such as `camera.position`, `camera.target`, `device.root.rotation` and `dial.rotor.rotation.z`.

## References

References have a look, camera or elements role. Local PNG/JPG/WebP/MP4/MOV files are copied into `project/references/`; HTTP(S) links remain links without automatic download. Notes tell the agent what to inspect. A video contact sheet extracts six review times.

```sh
node scripts/reference.mjs add --file /path/reference.jpg --role look --note "deep shadows and narrow reflections"
node scripts/reference.mjs link --url https://example.com/reference --role camera --note "close wide-angle shot"
node scripts/reference.mjs list
node scripts/reference.mjs sheet --id ref_XXXXXXXXXXXXXXX --out renders/reference-sheet.png
node scripts/look.mjs show
node scripts/look.mjs set --file /path/look-variant.json
node scripts/brief.mjs
node scripts/review.mjs --looks project/looks/soft-lighting.json,project/looks/contrast-lighting.json --time 2.8 --out renders/looks.png
```

The agent must inspect references and translate decisions into parameters and geometry. The app does not infer looks or reconstruct 3D models automatically. Look comparison retains individual frames and creates a side-by-side sheet. See [Agent workflow](AGENT_WORKFLOW.md).

## Lighting and inspection

Lighting presets change light position, direction, color and intensity while retaining camera and compositing. Manual lighting changes select a custom state; saving the look keeps it. Presets live in `project/lighting-presets.json`.

Inspection offers final image, clean image, clay and normals. Isolate an object with:

```sh
node scripts/cli.mjs frame --parameters '{"inspect":{"object":"device.root","yaw":20},"review":"clean"}' --out renders/inspection.png
node scripts/quality.mjs --out renders/quality-board.png
```

Lens controls include barrel distortion with overscan, chromatic fringes, vignette and GTAO contact shadows. Fringes use Full HD pixels for consistent preview/export intensity. Compositing uses linear HDR, bloom, one OutputPass for tone mapping/sRGB, then optical treatment. Temporal averaging decodes sRGB samples first. GTAO uses fixed noise. See [OutputPass](https://threejs.org/docs/pages/OutputPass.html), [color management](https://threejs.org/manual/pages/color-management.html) and [physical materials](https://threejs.org/docs/pages/MeshPhysicalMaterial.html).

## Procedural graphics

Choose the procedural project to edit title, accent color and density without assembling clips. Playback and scrubbing inspect absolute time; the 3D scene remains available.

```sh
node scripts/cli.mjs viewer --scene procedural
node scripts/cli.mjs frame --scene procedural --time 4 --out renders/procedural-frame.png
node scripts/cli.mjs contact --scene procedural --samples 9 --out renders/procedural-contact.png
node scripts/cli.mjs preview --scene procedural --temporal-samples 8 --out renders/procedural-preview.mp4
node scripts/cli.mjs export --scene procedural --temporal-samples 8 --out renders/procedural-final.mp4
node scripts/cli.mjs verify --scene procedural --time 4.2 --out renders/procedural-final.mp4
```

Example variation: `--parameters '{"graphics":{"title":"PLAY","accent":"#ef5533","density":12,"speed":1.2}}'`. Parameters are stored in the render sidecar. Download a recipe and reuse it with `--snapshot /path/procedural.project.json`.

See [Procedural graphics](PROCEDURAL.md) for the API. This Canvas2D mode handles procedural vectors and typography. Footage import, background removal and connections to generated videos are not implemented.

## Sources and limits

`src/config.js` centralizes duration, frame rate, dimensions, palette and text. Components build geometry and materials; scenes define compositions; `src/engine/studio.js` sets lighting. The engine applies tracks, renders and composites; the viewer handles UI; scripts handle CLI and export.

Add a scene module exporting `createScene(renderer, config)`, register it in `src/engine/runtime.js` and `src/config.js`, and supply matching look, motion and control definitions. Keep frame calculation a function of absolute time, including backward seeks. See [Studio](STUDIO.md).

Rendering is repeatable on the same machine/browser version; GPUs and drivers may change pixels. The 3D demo uses real geometry, perspective, PBR materials, procedural reflections and textures, 2D overlays, adjustable bloom, chromatic aberration and optional depth of field. `--temporal-samples` accepts 1–64 samples; never integrate across hard cuts. glTF import, arbitrary product insertion and reconstruction from images are not implemented.

Share sources, `project/`, lockfile and docs, excluding dependencies and temporary files. The local `ffmpeg-static` binary uses `--enable-nonfree` and must not be redistributed. See [Third-party notices](../THIRD_PARTY.md) and `licenses/`.
