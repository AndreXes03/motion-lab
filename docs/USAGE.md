# Usage

Motion Lab is a local rendering engine for Three.js scenes and Canvas2D motion graphics. The 3D test is a 10-second film with a radio, mechanical emblem and gyroscope. The gyroscope uses deterministic kinematics, rather than a physics simulation. The procedural demo builds generative graphics directly from code.

## Start

Requires Node.js, npm and Google Chrome on macOS:

```sh
npm ci
node scripts/cli.mjs viewer
```

The viewer opens at `http://127.0.0.1:4173/`. Choose a 3D or procedural project, a preset and scene controls. Moment buttons jump to useful shots. Properties groups the scene’s selected tools into Motion, Lens, Lights, Compositing and other supported categories; the complete catalog, advanced tools and references have separate views.

The layout controls offer a balanced view, expanded controls and a large video. Drag the divider or use arrow keys to resize the panel. Layout and panel width persist in the browser.

## Tools, curves and preview

Properties uses an agent-selected layout for each scene. Lighting and Compositing panels offer curated presets; the complete catalog adds supported controls without changing that layout. Numeric fields beside sliders allow precise values. Every scene has neutral contrast/saturation finishing controls, and adapted PULSE, CAMERA, DOT and REPLAY now expose real scene-owned tools.

Motion edits one camera or object group inside an authored shot. Create a linear motion curve to retain the original pose clock, then edit progress keys or choose suggested interpolation. Save the key to apply its suggestion. Selected target rate changes only that group; cuts, captions, music and other groups keep their timing. Advanced parameter tracks animate individual numeric values with independent rates. See [Scene controls and motion curves](ADAPTIVE_CONTROLS.md) for the group table, limits and recipe schema.

Preview modes are Auto, Balanced, Fast and Sharp. Auto adapts resolution during interaction and from measured frame cost; Fast simplifies expensive supported effects. Preview quality is a browser-local preference and does not change the recipe or final output. Use full-effect preview when judging depth of field, bloom and materials.

For agent authoring:

```sh
npm run controls -- catalog --scene pulse
npm run controls -- plan --scene pulse --file manifest.json
npm run controls -- set --scene pulse --file manifest.json
npm run controls -- preset-catalog --scene pulse
npm run controls -- preset-plan --scene pulse --category compositing --file profile.json
npm run controls -- preset-set --scene pulse --category compositing --file profile.json
```

Plans validate without saving; setters change only the selected scene/category. Preset categories are `lights`, `compositing` and `interpolation`, with at most four variants and at most 15 native values in a lighting/compositing profile. Unsupported lighting categories have no presets.

## Render

The gear beside Export controls resolution up to 4K, frame rate, output format, bitrate, motion blur and **Renderer**. Three.js supports PNG frames plus MP4/WebM/ProRes video. The local PULSE Cycles adapter supports PNG/MP4; select Three.js for WebM/ProRes. Auto follows the scene recommendation when local capability and budget permit it. PULSE currently prefers Cycles at 96 samples; this is a chosen setting, not a render-time estimate. Unavailable explicit engines are blocked with a reason.

Install Blender separately or set `BLENDER_PATH` for Cycles. Local preflight checks the real executable, scene support and available devices. Mixed requires prepared rendered layers and an explicit plan, validated before Studio queues the job; the compositor CLI is also available. The 3D preview remains Three.js for all final renderer selections; procedural 2D uses Canvas. See [Renderer selection](RENDERER_SELECTION.md) and [Compositing](COMPOSITING.md).

```sh
node scripts/cli.mjs frame --time 2.8 --out renders/frame.png
node scripts/cli.mjs contact --samples 6 --out renders/contact.png
node scripts/cli.mjs preview --out renders/preview.mp4 --temporal-samples 8
node scripts/cli.mjs export --out renders/film.mp4 --temporal-samples 16
node scripts/cli.mjs verify --time 2.8 --out renders/film.mp4
```

`frame` evaluates one time; `contact` produces six review frames. Preview defaults to 960 × 540; export to 1920 × 1080, encoded through FFmpeg. CLI output is JSON with status, paths and errors. Use `--start` and `--end` on frame boundaries to export a section. `--width`, `--height` and `--parameters '{"display":"TEST"}'` create variants without editing the saved scene.

`verify` checks the same frame after different seeks and, with `--out`, video metadata. Enable modular 2D/3D audio with `--sound on`; `--sound off` produces silent video. See [Sound design](SOUND_DESIGN.md).

The public Studio downloads PNG frames and JSON recipes; it does not run local video, Blender or compositing jobs. Public versions stay in that browser.

Only one Studio render job can run at a time. The export panel shows history, errors, file paths and open/download/Finder actions. Viewer exports go to Downloads; history persists after restart. The CLI's Chrome path is configured in `scripts/cli.mjs`.

## Optional local Cycles and mixed inputs

The general `cli.mjs` commands above use Three.js. Use the separate native path for a supported PULSE proof or short video:

```sh
npm run cycles -- frame --scene pulse --time 9.23 --width 384 --height 216 --samples 16 --device auto --out renders/pulse-cycles-proof.png
npm run cycles -- export --scene pulse --start 9 --duration 0.2 --width 960 --height 540 --fps 30 --samples 96 --device auto --out renders/pulse-cycles-short.mp4
```

Pass `--snapshot /path/to/recipe.json` to keep authored controls and curves. Cycles freezes a source snapshot and settings, then bakes absolute-time poses. It retains job/cache manifests and only resumes compatible renders. Its material/light translation and color response can differ from Three.js; raster GLSL and optical/compositing passes do not transfer automatically. A completed proof still needs visual review.

For prepared image or frame-sequence layers:

```sh
npm run composite -- --plan /path/to/plan.json --assets /path/to/rendered-layers --check true
npm run composite -- --plan /path/to/plan.json --assets /path/to/rendered-layers --out renders/composite-proof --encode true
```

Check the plan and its sources before execution. Renderer policy describes strategy; the separate plan describes actual layer files, timing, alpha/masks and grading. No mixed render starts from metadata alone.

## Versions and recipes

Save version stores complete settings in `project/versions/`. Restore them from the menu or transfer them as JSON recipes. Preview and export use the current settings; links marked demo open existing films.

Each render writes a `.project.json` sidecar with its settings. It does not receive live viewer changes. Use `--snapshot renders/film.mp4.project.json` to reproduce a frame; verification automatically uses the video's sidecar.

The Three.js exporter flags renders if their source fingerprints change; it does not freeze an isolated source copy, so finish those renders before editing. The separate Cycles path does freeze its own source snapshot and rejects incompatible resume caches. Viewer and export share compositing; temporal blur is calculated during export.

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

Use the appropriate scene factory, register it in `src/scene-registry.js` and `src/engine/runtime.js`, and supply real control definitions, supported motion groups, an agent-selected panel layout and renderer intent. New product scenes start from `src/scenes/product-starter.js`; the BAX scene uses `createScene(renderer, config)`. Keep frame calculation a function of absolute time, including backward seeks. See [Studio](STUDIO.md).

Rendering is repeatable on the same machine/browser version; GPUs and drivers may change pixels. The 3D demo uses real geometry, perspective, PBR materials, procedural reflections and textures, 2D overlays, adjustable bloom, chromatic aberration and optional depth of field. `--temporal-samples` accepts 1–64 samples; never integrate across hard cuts. glTF import, arbitrary product insertion and reconstruction from images are not implemented.

Share sources, `project/`, lockfile and docs, excluding dependencies and temporary files. The local `ffmpeg-static` binary uses `--enable-nonfree` and must not be redistributed. See [Third-party notices](../THIRD_PARTY.md) and `licenses/`.
