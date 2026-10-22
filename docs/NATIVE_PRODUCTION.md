# Native production migration

Framevolve keeps the web Studio for authoring and interactive preview while final production moves toward native rendering. The starting baseline is Cycles main revision `f3ff402`, component `0.1.0-preview.2` (PR #39). This first migration phase adds CPU Skia canvases and native scene preparation on top of that unchanged standalone component. It does not make all scenes or the Studio browser-free.

## Current browser boundary

- The Studio UI and its Three.js interactive preview need a browser DOM, WebGL and Canvas. Vite serves the local interface.
- The established Three.js CLI renderer uses Playwright to run the scene in Chromium. This is the remaining browser dependency in that local final-render route.
- Public Studio video recording uses browser Canvas/Three.js and MediaRecorder; it remains a web convenience path.
- The native Cycles preparation path uses `skia-canvas` instead of a DOM canvas. Cycles traces supported scene geometry; browser preview remains available. Support is limited to PULSE and LOOP and needs scene-specific visual review.
- A browser-free procedural path is available for local production and is advertised only after a CPU Skia canvas allocation succeeds on macOS Apple silicon. Local procedural storyboard thumbnails use the same bounded native path; other scenes keep their interactive browser previews. Do not describe other scenes, Mixed jobs, or the overall product as fully native until their production paths are migrated and reviewed.
- The native CLI can synthesize the authored motion-driven sound layer. Imported or prepared soundtrack files remain part of the separate Mixed compositor plan; they are not a general imported-track path for native Skia exports.

## Phased migration

1. Keep the existing web Studio and local API as the authoring shell. Preserve project recipes, job manifests, progress, cancellation and download behavior while renderer adapters change.
2. Use native Skia for procedural 2D scene preparation and export, then compare representative frames and complete films against approved references. Keep Three.js preview for interactive editing.
3. Migrate 3D scenes through explicit adapters, starting with the existing PULSE/LOOP Cycles path. Verify shape, materials, lighting, animation, output dimensions and timing per scene before widening support.
4. Retire Chromium from local final production only after each supported scene has a native path and production checks. Keep public browser recording as an optional route unless that product behavior is separately changed.

## Local assistant and browser access

Recommended use is the local assistant with Framevolve's local MCP/API connection, with Studio served on localhost for visual authoring. Use an integrated browser only when it can actually reach that localhost address. Otherwise open the same local Studio in Safari or Firefox. Do not expose the service through a cloud tunnel.

## Evidence at this baseline

The existing Cycles validation report records real PULSE/LOOP frames, local API viewport rendering and the checks run for that revision; see [Standalone Cycles validation](CYCLES_STANDALONE_VALIDATION.md). These checks cover the Cycles adapter and do not establish native coverage for all scenes. `scripts/test-studio-api.mjs` covers completed-job restoration, interrupted-job recovery, synchronous process-launch failure, local file serving, and the thumbnail endpoint's scene/dimension bounds with a renderer stub. `scripts/test-renderer-studio-api.mjs` checks explicit Skia dispatch and confirms that status preserves requested engine separately from actual backend/device metadata.

## Verified first phase (22 October 2026)

- `skia-canvas` 4.0.0 and its platform binary are pinned through npm lockfile integrity hashes. Native production setup is tested on macOS Apple silicon only. The setup installs no rendering browser in native mode, preserves optional legacy browser selection, and offers the existing optional Cycles component with checksum and manual macOS authorization. Developer ID signing and notarization are planned; no signed release or date is promised.
- Procedural uses a version-1 evaluated 2D graph from the existing scene factory, shared absolute-time parameter evaluation and seeded node construction. Existing schema-2 recipes are preserved; output recipes record the production backend. This is not yet the universal project/asset/camera/audio schema.
- Native Procedural still, contact sheet, video, motion-driven audio, temporal sampling, final grain/grade, Render View and local storyboard thumbnail API are wired. Unsupported explicit Skia scene selection fails. An explicit Three.js choice remains an explicit legacy browser render.
- Cycles standalone now bakes PULSE/LOOP without a browser. Geometry, camera, lights, world transforms, texture images and overlay snapshots come from the same authored factories. The native environment path keeps equirectangular textures and projects the actual HDR studio cards instead of round-tripping through GPU PMREM. Custom shaders and prior Cycles adapter limitations remain.
- Visual review: [Procedural native](native-evidence/procedural-native.png) versus [browser](native-evidence/procedural-browser.png), at 2 s, 480×270. Mean absolute pixel-byte difference 0.326/255; small raster edge differences, matching layout/text positioning. [PULSE/LOOP comparisons and settings](native-evidence/comparison-review.json): four actual Metal frames, 480×270, 8 samples. Cameras/lights/exposure match; mean RGB differences 0.432/255 PULSE and 0.042/255 LOOP. These macro frames do not prove all typography/shots.
- Actual Skia/CPU Render View succeeded at 1920×1080 in the Codex integrated browser (895 ms UI timing) and [Safari](native-evidence/safari-render-view.png) (844 ms UI timing). Firefox has not been checked. The screenshot records the actual renderer, not just its selector.
- A 6-frame, 30 fps Procedural H.264/AAC clip exported with a nonexistent browser/Blender override; ffprobe reported 0.200000 s for video and audio, 6 video frames. A separate macOS process sandbox denied browser/Blender reads and launches plus compiler/build-tool launches: Procedural still and a real 64×64 Cycles CPU PULSE still completed. No installed browsers or Blender copies were removed or altered. This simulates denied dependencies, not a freshly provisioned Mac.
- Bounded 4-sample Procedural frame measurement at 7.5 s, M4 Max, Node 25.8.1, CPU Skia: 1920×1080 **196 ms**, peak RSS **173,536 KiB**; 3840×2160 **630 ms**, process cumulative peak RSS **504,880 KiB**. Times exclude process startup; one frame per resolution, not a sustained-video benchmark or promised speedup. Random seeking produced identical PNG bytes.
- Focused checks cover clipped alpha, parameter changes, deterministic seeking, setup native selection, API bounds, launch failures and interrupted-job recovery. The standard prebuild checks and Vite build passed. CLI rendering is independent of a Studio tab; tab closure during a long active render has not yet been visually exercised.

## Remaining work — not a completed Chromium removal

Other scene factories, their production renders and storyboard thumbnails remain legacy. Filament has not been built or benchmarked and is not adopted. Imported/prepared audio still uses the existing FFmpeg compositor route; a unified editable imported-track model and native Skia import UI are pending. Full PULSE/LOOP animated comparisons, hybrid typography/alpha across shots, end-to-end storyboard editing/reopening, Firefox and a truly clean Mac installation remain unverified. Existing browser dependencies stay in the package until their callers are migrated; native mode does not download or launch Chromium. See `licenses/skia-canvas/SOURCES.md` for the limited notice audit; no separate Skia binary bundle is republished.
