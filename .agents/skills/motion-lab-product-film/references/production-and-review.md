# Production and review

Use for implementation, refinement or export after the creative direction is clear. Review the user's latest feedback and existing approvals first. A request for high quality is not a request to rerender unchanged work, spend without limits or ignore a later “do not export yet.”

## Build on the installed engine

Read [the product kit](../../../../docs/PRODUCT_KIT.md), [3D look development](../../../../docs/3d-lookdev.md) and the applicable [renderer contract](../../../../docs/RENDERER_SELECTION.md). Use `src/engine/studio-baseline.js`, `studio-lookdev.js` and `composite.js` through their actual interfaces.

For a new product scene, copy `src/scenes/product-starter.js` and import through `src/product-kit/index.js`. Reuse suitable existing film assets (`camera`, `turntable`, `headphones`), optical cells, rotary controls or housing panels before constructing bespoke geometry. Keep the customer's actual identity. A reused asset is not automatically an accurate model of a new product.

Use a scene-owned material kit and `variant()`. Shared textures need explicit ownership; clone before changing a map's repeat independently. Reuse functions, not another film's shot times or object names. Inspect the starter's real output before adapting it. The kit supplies construction and motion, not automatic art direction.

For a mechanical assembly, measure the entire swept volume, including support parts. Verify pivots, axes, attachment chains, contact bounds and the order of separation. Keep spring overshoot on the allowed side of contact. Describe constrained animation as such; do not claim a rigid-body or fluid simulation.

Reset poses and procedural state from authored values at each absolute time. Particle positions, trails, coating masks and random choices must reproduce under backward and random seeking. Stable emission identities must not freeze the emitted graphics: continue their authored drift, rotation or deformation as age advances, and check continuity when new elements appear. Do not compound existing easing when exposing an authored motion channel.

## Choose a renderer without overpromising

Inspect current adapter support in the installed code and run local capability checks. Three.js/Canvas remains the interactive route; Cycles needs a supported conversion, Blender and a usable local device. A new product scene does not gain Cycles support simply by selecting that engine. Mixed rendering needs actual prepared layers and a validated composition plan.

Compare representative converted frames for texture scale, material response, lighting, lens, alpha, color and typography. Raster GLSL, screen-space effects and optical finishing do not transfer automatically. Keep 3D beauty, background, type and UI separable when supported; this enables inexpensive recomposition and crisp graphics.

A quick preview and a high-sampling final are different stages. Distinguish **Cycles light-transport samples** from **Three.js temporal samples** used for motion blur. The raster `--quality premium` preset uses 1080p/48 temporal samples; `supersampled` uses 1440p/48 temporal samples before downsampling. These are not Cycles sample counts.

Use small native proofs before long exports. Select final sampling, denoising and shutter from noise, fine-detail stability and the user's budget. LOOP's high-sampling master is an example, not a 1024-sample minimum for every founder. Estimate duration from measured local frame cost when available; label estimates. Stop samples from crossing hard cuts and inspect near-cut motion blur.

## Make refinement practical

Follow [AGENTS.md](../../../../AGENTS.md) and [adaptive controls](../../../../docs/ADAPTIVE_CONTROLS.md). Every revised scene needs implemented controls, an agent-selected layout, meaningful animation groups/shot windows and a supported render intent.

Expose controls that actually help refine this film: camera distance/lens/size compensation, product travel, light balance, material response and relevant graphic timing. Advanced groups can include title Bézier handles, entry/exit time, letter delay, intro zoom softness, trail density and coating progress when implemented. Keep an understandable normal workspace. Hiding controls must preserve saved tracks.

Use identity defaults to preserve the authored picture. Test a representative change and reset. Scene-local retiming must not move unrelated captions, music, cuts or total duration. Preserve versions; do not reset a founder's local adjustments to make a prepared preview appear current.

## Review in the order that saves work

| Pass | Evidence to inspect | Fix before progressing |
| --- | --- | --- |
| Meaning | Muted low-resolution preview; first seconds; visible action/result; ending. | Unclear product, unsupported claim, irrelevant graphic, missing intended next step. |
| Direction | Contact sheet plus shot plan; compare axes, scales, silhouettes, depth and light. | Repetitive hero orbits, tiny subject when a full macro was requested, interchangeable UI shots. |
| Craft | Same-time clean/clay and beauty frames; material crops; near-travel intermediates. | Intersections, bad normals, wrong pivot, coarse weave, generic finishes, broken reflections. |
| Motion | Short moving passage including approach, cut and recovery; then the entire edit with sound. | Rigid easing, unreadable type, constant high speed, mismatched velocity, lagging UI consequence. |
| Finish | Effects on/off and full-resolution crops; actual encoded video. | Wide glow haze, doubled edges, excessive aberration, denoise shimmer, smeared detail or graphic artifacts. |
| Delivery | All requested variants; actual Studio/destination files. | Wrong version, stale preview, absent audio, broken seek, mismatched dimensions/hash or incomplete export. |

Record **pass / needs revision / not checked** with frame/time evidence and a concrete next action. Do not invent a score that turns technical checks into proof of aesthetic quality. A blocking visible defect is not offset by many successful metadata checks.

### Translate repeated feedback into a cause

| Feedback | Investigate and change |
| --- | --- |
| “The renders all look the same.” | Compare axes, object scale, depth, mechanism and light rigs. Replace the redundant shot premise before adjusting color. |
| “Too static.” | Establish dominant travel or a revealing light/reflection move; remove dead waiting. Do not add jitter everywhere. |
| “Too fast / random.” | Restore readable intervals, slow the graphic proof and connect it to the product. Keep impact at selected transitions. |
| “The UI is boring / rigid.” | Strengthen the demonstrated result and animate cursor, hover, press, control and consequence as one gesture. |
| “Materials look cheap.” | Check surface scale, roughness contrast, thickness, bevels, texture and the reflected light shape before raising samples. |
| “The fabric is flat / plastic.” | Check the crossing structure, pores, backing depth, tension and yarn scale in a neutral macro. Strengthening a texture alone can make it look more like embossed plastic. |
| “The letters always arrive in reading order.” | Author a few stable clusters around a meaningful letter, word edge or product trajectory. Separate their timing from word travel, and verify that the variation is visible before the whole word lands. Randomizing every frame produces flicker, not choreography. |
| “The supers look basic.” | Compare actual mixed-case words, distinctive glyphs, weight and spacing; then compose around the moving product and inspect entry/read/exit at real speed. Do not solve every complaint by changing color or picking a more decorative font. |
| “The wide angle barely reads.” | Move nearer, add foreground depth and retune FOV/distance together; inspect clearance. |
| “Glow is huge.” | Inspect the actual kernel/threshold and a bright-edge crop. Reduce spatial radius, not only intensity. |
| “Wrong effect on the wrong panel.” | Map control → property → affected shot explicitly; restore unrelated accepted animation. |
| “The ending does not match.” | Compare adjacent frames for position, direction, scale and velocity, then simplify the closing layout. |

Use a bounded improvement pass: identify the most consequential visible issues, fix them, inspect the affected sequence, and stop when those issues are resolved within the brief. Avoid endless variants or unrequested redesign.

## Efficient rendering and verification

1. Start with a few same-time diagnostic and beauty frames, then a short 540p motion passage around the change. Use `scripts/quality.mjs` where it covers the selected scene. Check fast intermediate frames as well as hero poses.
2. Freeze source/settings before a long render. Follow the installed exporter's snapshot/resume contract: Cycles has a source cache, while raster source fingerprinting is not the same as an isolated snapshot. Never resume changed sources/settings as if compatible. Keep existing jobs, finalizers and file locks in mind; do not duplicate a running render.
3. Reuse the expensive beauty for a graphics/background/UI correction only when the change does not require altered 3D. Do not pass an old beauty off as a new model or camera render.
4. Preserve an approved mix. Render silent picture when appropriate, then mux the selected track without unrequested gain or picture-color changes. Keep separately licensed standalone tracks and private references out of the public repository. Listen to the SFX stem and mix; loudness metrics do not prove good sound design.
5. Use `scripts/export-social.mjs` for a compatible delivery encode when suitable; read its current constraints. Encoding does not improve geometry or lighting. Keep the master and prior accepted versions.
6. Check frame count, duration, dimensions, fps, audio, complete decode and arbitrary seek. An audio stream existing is not enough: compare its actual duration with the intended soundtrack interval and check the tail against the source; full video duration can hide truncated AAC. Inspect each compressed musical/format variant, especially interpolated edges, rings, UI and type. A checked master does not automatically validate retimed alternatives.
7. Install the correct local preview through the supported route and verify its source/version, playback and seek. Distinguish interactive Three.js from a prepared Cycles movie. Source changes must invalidate stale prepared previews rather than displaying them as the latest render.
8. Verify actual destination copies and hashes when delivering files. Save representative screenshots and a concise report. `prepare-demo.mjs` handles supported PULSE/CAMERA demo installation with backups; it is not a generic installer for arbitrary scenes and does not publish.

When the user requests a version without supers, preserve the master and generate the clean variant through headline-layer visibility, retaining the agreed UI, sound and official closing brand. Verify both variants independently. If a handoff to another chat is requested only after approval/export or after a font decision, record that condition and send the exact filenames, locations and chosen style only after it is satisfied. Draft work and a shortlist are not a chosen font or a delivered film.

For shared component changes, run `npm run test:product-kit` and focused checks. For scene/control/render changes, follow the required contracts and build in AGENTS. Do not rerender unchanged films just to test a helper. A passing build is technical evidence only.

Report what visibly changed, which version/export was inspected, remaining limitations and the destinations actually updated. Keep **implemented / previewed / rendering / exported / verified / creatively approved / published** distinct. Follow existing user authorization; do not add a new approval round for routine reversible work. If the user explicitly postpones export, implement and inspect the preview without restarting the master or delivery automation.

## Optional photorealism stills

For a requested photorealism test or hero still, read [Photorealism](../../../../docs/PHOTOREALISM.md). This separate experiment does not replace the film renderer.

Reuse a product-kit asset, compare the same scene through `scripts/photoreal.mjs`, and begin with a small framing test such as 640×480/64 samples. The documented selected-still settings include 1440×1080/1024 samples; a requested high-quality still can use 2880×2160/2048 samples after the framing is settled. Install its pinned dependencies separately.

Inspect actual exported files and metrics. The sample counter can advance before queued GPU work completes: retain explicit canvas presentation, bounded GPU readback checkpoints and the duplicate-image guard. Do not publish timings without those checkpoints.

Art-direct the foreground feature, useful perspective, finishes and warm/cool hierarchy before raising samples. Inspect bevels, long perforated-panel triangles, legibility and new surfaces at crop scale. Bending a sparsely triangulated perforated plate produces ridges. An emissive glossy display is not verified refractive glass.

Keep experimental model detail isolated. Report clearcoat/material adaptations, remaining noise and missing parity for animation, glass, blur or compositing. Preserve resource ownership and publish only within authorization.
