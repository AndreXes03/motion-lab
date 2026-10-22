# Standalone Cycles: development verification, 2026-10-22

**Working development integration; not a stable downloadable component.** Started from `main` `347e315` (PR #38) in an isolated checkout and branch. No active user checkout, project, Blender installation or existing Studio server was changed.

## What is implemented

The default Cycles path runs `framevolve-cycles`, a C++ host linked directly to the pinned Cycles libraries. It has no Blender executable, `bpy`, Python runtime or Blender UI dependency. The old adapter remains available only through explicit developer CLI `--backend blender-reference`. Three.js, WebGL, Canvas and Chromium still prepare scenes and provide interactive previews. There is no silent fallback for an explicit Cycles request.

The host reuses the upstream XML node reader after auditing its sockets and mesh support. The adapter transfers mesh groups, normals, tangents, UVs, hierarchical and instance transforms, shader graphs, baked material/texture changes, camera pose/FOV/physical DOF, lights and shutter samples. A small reader patch transfers light object motion. The host adds real device probing, progress, error exits, denoised combined output and OCIO Filmic/Medium High Contrast with straight PNG alpha. The stock standalone gamma-only output is not used.

Scene support is restricted to PULSE and LOOP, exposed as experimental under the development runtime override. Native render work is serialized (one worker); Studio keeps its existing active-render reservation. Viewport progressive passes, single-frame export, MP4 encoding, Canvas composition and audio use the same job path. Local export and Render View now have actual cancellation, and report the backend and device emitted by the process.

## Actual evidence

Machine: macOS 26.6.2, Apple M4 Max. Native source revision `a456b761034dda42c32eef9f4aae0fa5a5c9f604`; library revision `5a140a8ccc8c070221b1b06e2c6f89f136c5758d`. Metal reported **Apple M4 Max (GPU - 40 cores)**. The existing comparison installation is **Blender 3.3.1**, not the same Cycles revision.

![Reference left; standalone right](cycles-evidence/comparison.png)

- PULSE at 2.0s: Metal, 480×270, 16 samples, same camera/material placement. Bright highlights and denoising differ slightly.
- PULSE at 7.5s: CPU, 480×270, 32 samples, transparent PNG and motion blur. Alpha is retained; the standalone blur and highlighted edges differ slightly from the old renderer.
- LOOP at 4.0s: Metal, 480×270, 16 samples. Framing, geometry and focus transfer; the knob's reflection and ribbed-material response visibly differ. This is **not pixel parity or creative approval**.
- LOOP at 6.0s: Metal, motion blur, native Canvas rings above the beauty pass. The overlay geometry, timing and placement are retained.
- PULSE MP4: six frames at 30 fps, 0.2s, H.264 plus AAC, complete decode and matching stream duration. LOOP MP4: six frames at 12 fps, 0.5s, H.264, complete decode. LOOP had no explicit soundtrack supplied for this proof; edited-track playback was not assessed.
- CPU rerender in a separate HOME with empty environment and OS sandbox denying Blender, Cycles source/build/tooling and `/Library/Developer`: completed with **identical pixel bytes** to the corresponding native CPU render. This proves the renderer runtime does not need Blender or compilation tools. It does **not** prove a complete first-use installer on a clean user account.
- Actual local Studio API viewport job: completed 64×64 Metal PNG, progressive stages 1 and 2 observed. A second real native job was cancelled during scene baking, retained its reservation until child exit, reached `cancelled` and had no download. Real cancellation during GPU tracing and end-to-end user clicks in the final installer remain unverified.
- Three.js native Storyboard browser check, browser MP4 export with audio/progress/cancellation, and standard local frame API passed. Final production build and its required prebuild contracts passed.
- Focused adapter and component tests passed: transform/shutter/camera/material/UV fixtures; explicit unavailable GPU rejection; checksum failure, unsafe archive entries, interrupted download retry, compatible reuse and failed-update preservation. The install validator is mocked in package fixtures: those tests do not substitute for signing/notarization or real download proof.

[Machine-readable measurements](cycles-evidence/results.json) record frame differences and clip metadata. Low sample counts and different Cycles generations mean pixel differences are diagnostic only. These are deliberately small integration probes, not complete-film delivery tests or performance benchmarks.

## Remaining release blockers

1. **Downloaded-package authorization:** Developer ID is not a requirement for Cycles to render. On 2026-10-22 the user chose to proceed without it for now. This Mac runs the locally built runtime directly; Gatekeeper was not disabled and quarantine was not removed. The current download validator still requires Developer ID/notarization. Public unsigned distribution needs an explicit manual macOS authorization flow implemented and verified before that requirement can be relaxed. No valid signing identity is present, and `spctl --assess --type execute` rejects the development executable.
2. **Color data notices:** the pinned Blender OCIO configuration points to `ocio-license.txt`, but that notice is absent from the pinned source tree. The historical notice is recorded separately, not asserted to cover all current LUTs. Final dependency attribution and color-data provenance must be completed before redistribution; package assembly currently refuses it.
3. **Release and clean setup:** no production binary/archive was uploaded; `native/cycles/releases.json` is deliberately empty. The install/download UI explains unavailability, and base setup remains usable. A signed archive with pinned checksum, clean install/retry/update/removal, and actual Studio first-use download must be verified before a stable manifest is added.
4. **Remaining picture coverage:** arbitrary shaders, per-material environments, hemisphere ambient lights and browser post effects are not equivalent. Deformation/animated-texture blur remains unsupported, as in the old adapter; object/camera/light transform blur is transferred. Animated light energy and material values are sampled once per output frame. Only the pictured PULSE/LOOP frames were visually inspected. Long-film seeking, rapid camera cuts, high-resolution throughput and complete soundtrack playback need release review. Other operating systems and architectures are unavailable.

Because these gates are open, this change must remain a draft PR: no merge and no replacement of the user's working installation. The repository's safe updater is not bypassed.

## Usable local installation (2026-10-22)

A separate persistent Studio is running at `http://127.0.0.1:4190/`, using the already-built native runtime. The user's existing Studio on port 4174 remains untouched. A local **Framevolve Cycles.app** launcher on the Desktop starts/reuses this isolated Studio, without requiring terminal input, compilation, a Developer ID certificate or Blender. It depends on the existing local checkout/runtime paths; it is not a portable public installer.

Open that launcher, choose PULSE or LOOP, then **Export → Renderer → Cycles**. **Render view** renders the current frame; **Export MP4** renders the video. Start with Draft for quick feedback. A real UI-triggered PULSE frame completed at 1280×720 in 11.3s with the device label **METAL · Apple M4 Max (GPU - 40 cores)**. This adds actual Render View user-flow evidence; complete installer/download approval remains outstanding.

![Actual Cycles Render View on the local Mac](cycles-evidence/studio-ready.png)

## Interface once a stable component is published

Setup will offer optional **Rendering Cycles**. In local Studio choose **Cycles**, use **Install Rendering Cycles** if offered, then **Render View** for the current frame or Export for video. The panel offers update/removal of the component only. Today the release is unavailable; these instructions describe the implemented flow, not a published installable package.
