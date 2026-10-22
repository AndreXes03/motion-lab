# Native production migration

Framevolve keeps the web Studio for authoring and interactive preview while final production moves toward native rendering. The starting baseline is Cycles main revision `f3ff402`, component `0.1.0-preview.2` (PR #39). This first migration phase adds CPU Skia canvases and native scene preparation on top of that unchanged standalone component. It does not make all scenes or the Studio browser-free.

## Current browser boundary

- The Studio UI and its Three.js interactive preview need a browser DOM, WebGL and Canvas. Vite serves the local interface.
- The established Three.js CLI renderer uses Playwright to run the scene in Chromium. This is the remaining browser dependency in that local final-render route.
- Public Studio video recording uses browser Canvas/Three.js and MediaRecorder; it remains a web convenience path.
- The native Cycles preparation path uses `skia-canvas` instead of a DOM canvas. Cycles traces supported scene geometry; browser preview remains available. Support is limited to PULSE and LOOP and needs scene-specific visual review.
- A browser-free procedural path is available for local production and is advertised only after a CPU Skia canvas allocation succeeds on macOS Apple silicon. Local procedural storyboard thumbnails use the same bounded native path; other scenes keep their interactive browser previews. Do not describe other scenes, Mixed jobs, or the overall product as fully native until their production paths are migrated and reviewed.
- The native CLI synthesizes the authored motion-driven sound layer. The Audio panel also imports local music/voice into content-addressed project assets. Native Skia and Cycles exports share frame-clock trimming, timeline positioning, volume, fades and mixing independently of the synthetic sound toggle. Prepared Mixed plans retain their separate explicit soundtrack inputs.

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
- Focused checks cover clipped alpha, parameter changes, deterministic seeking, setup native selection, API bounds, launch failures and interrupted-job recovery. The standard prebuild checks and Vite build passed. CLI rendering is independent of a Studio tab; the second-phase evidence below now includes actual tab closure during an active native export.

## Remaining work — not a completed Chromium removal

Other scene factories, their production renders and storyboard thumbnails remain legacy. Filament has a real but incomplete Metal smoke test and is not adopted; see [feasibility findings](FILAMENT_FEASIBILITY.md). The new project document API/CLI is operational, but the Studio editor does not yet load those documents and native element state is not a complete scene renderer. Full PULSE/LOOP animated comparisons, hybrid typography/alpha across shots, end-to-end native storyboard editing/reopening, Firefox and a truly clean Mac installation remain unverified. Existing browser dependencies stay in the package until their callers are migrated; native mode does not download or launch Chromium. See `licenses/skia-canvas/SOURCES.md` for the limited notice audit; no separate Skia binary bundle is republished.

## Phase 2 — imported audio and project records

The Audio panel imports self-contained audio containers, up to 100 MB and two hours. Tracks expose source start, timeline start, duration, volume, fade in/out and enable/remove controls. Sources remain local in `project/audio/`, identified and verified by SHA-256; updates must never overwrite that directory. Recipe/version serialization retains track references, not embedded source media. Copying a recipe alone to another Mac does not transfer its audio assets. At most 16 tracks may be mixed. Browser preview uses Web Audio; local final export uses FFmpeg and needs no rendering browser. Invalid or missing sources fail explicitly.

[Native project documents](NATIVE_PROJECTS.md) add versioned assets, scenes, elements, transforms, cameras, materials, numeric animation, audio and controls. Existing schema-2 recipes migrate behind explicit adapters; arbitrary authored scene code is not automatically converted into editable native elements. Local save/update uses revisions and rejects stale writes. These APIs can be used by a local agent independently of the UI; no hosted service is introduced.

### Bounded evidence, 22 October 2026

- Imported a generated two-second WAV test tone through the actual Studio file chooser, set a 0.2-second fade, disabled synthetic sound, and used the normal Export button. The native Skia render continued after closing the tab; reopening showed the completed export with Skia/CPU and a download link. [Reopened Studio](native-evidence/imported-audio-export.png). This proves UI wiring and local job persistence, not subjective music quality.
- That 1280×720 run exposed a real final-frame bug in the old `-shortest` encoding path: 299 instead of 300 frames. The fix uses the frame-clock presentation duration. The corrected 64×64 native run has exactly **300 frames / 10.000 seconds**, with AAC audio **10.000 seconds**. A permanent encoder regression also verifies 300 actual encoded frames. The original HD run's music RMS was 0.0881 during the source and exactly zero from 3–9 seconds; the reviewed image contains the authored scene and typography.
- Actual Cycles standalone **Metal / Apple M4 Max** exported two PULSE frames, 64×64, 2 samples, at 0.5 seconds with the imported track: video 0.066667 seconds and AAC 0.066 seconds. This checks audio plumbing; the earlier 480×270 comparisons remain the image evidence.
- Native audio verification compares every sample of full and partial timeline exports against the shared gain envelope, including overlapping fades, source trim and timeline delay (error below 0.00002). Media validation rejects playlists, oversized uploads, altered hashes and linked storage.
- Actual localhost project API: migrate 201, evaluate 200, revision update 200 and stale update 409. Native project elements remain evaluation-only; procedural legacy scenes also expose a native scene graph.
- Actual native export cancellation reached `cancelled` after the UI Cancel button. Stopping only the isolated Studio server and its own active render, then restarting, restored the interrupted job as failed with “Viewer stopped before this render finished” and no download link; the earlier completed job remained available.
- Standard prebuild and Vite build passed; focused audio import, native audio, project revisions and ZIP asset protection checks passed. No new Cycles binary was required or distributed.

Native setup now opens the Procedural demo so the initial scene can also export without installing a rendering browser. Legacy browser mode keeps PLAY.EXE.
