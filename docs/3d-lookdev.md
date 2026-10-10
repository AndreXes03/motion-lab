# Fast 3D look development

Use `createStudioMaterials(renderer)` from `src/engine/studio-lookdev.js` once per scene. It provides fibre, leather, enamel, brushed metal, and an HDR reflection environment. Reuse materials across meshes; dispose the kit when the scene is removed. These are starting points, not a guarantee of photorealism. Match texture scale and reflection-card placement to the object.

## Render only what you need

- `node scripts/cli.mjs frame --scene camera --quality lookdev --time 4.43 --out frame.png`: one 1440p frame, one temporal sample.
- `node scripts/cli.mjs preview --scene pulse --quality preview --out preview.mp4`: 540p for timing.
- `node scripts/cli.mjs export --scene camera --quality final --out final.mp4`: 1080p, 24 temporal samples, 28 Mbps. Scene adaptive sampling remains active (PULSE uses 32 on its fastest speaker transition).

Explicit width, height, bitrate and temporal-sample flags override the preset. No preset changes camera paths or animation. Existing CLI calls without `--quality` retain their defaults.

Use AgX tone mapping for highlight handling and inspect a clean frame alongside the composite. Narrow reflection cards and dark gaps articulate glossy surfaces; avoid raising roughness everywhere. Normal maps describe micro-relief; they are not displacement. Motion blur integrates actual scene time samples. The WebGL renderer does not provide path-traced global illumination.

The v6 publication preserves the approved audio and retains only the scene bloom; no additional post-render glow. Its exact finishing command and input versions are recorded in the delivery script, not in the scene motion.

Preserve rendered colors and approved AAC audio without re-encoding with `node scripts/finish-film.mjs --video silent.mp4 --audio approved.mp4 --out final.mp4`. It refuses to overwrite an existing output. Match input durations before finishing.

PULSE uses a 270–320 degree shutter for visible motion blur. Temporal exposure is clipped at cuts by the shared sampler; do not blend across shots. Use `--temporal-samples 24` for its final export (32 samples remain adaptive on the fast speaker turn). Preserve colors by remuxing the approved audio: the finishing tool performs no color or glow transform.


## Approved wide / contrast baseline (PULSE + CAMERA v9)

For a **new** 3D scene use `STUDIO_BASELINE`, `configureStudioRenderer` and `createStudioLighting` from `src/engine/studio-baseline.js`. Pass `STUDIO_BASELINE.look` to `createComposite`. Pair the rig with `createStudioMaterials(renderer)` and assign its `rubber`, `mattePlastic`, `satinPlastic`, `leather`, `brushedMetal`, `enamel` and `fibre` materials by function. Keep metal on actual metal parts; avoid coating every surface in clearcoat. Colors remain scene-specific.

```js
configureStudioRenderer(renderer);
const kit = createStudioMaterials(renderer);
scene.environment = kit.environment;
const lighting = createStudioLighting(scene, {scale: 1});
const composite = createComposite(renderer, scene, camera, {
  width: 1920, height: 1080, look: {...STUDIO_BASELINE.look}
});
// Choose materials per object, e.g. grip.material = kit.materials.rubber.
// Restore authored camera pose/FOV first, then apply once per frame:
applyWideStudioLens(camera, target, {baseFov: 38, minDistanceRatio: .85});
// When finished: lighting.dispose(); kit.dispose();
```

The wide helper changes perspective and distance: inspect for intersections, offscreen subjects and focus shifts. Use a higher minimum distance ratio for exploded assemblies. For FPV paths preserve the authored position and widen only FOV. Autofocus can choose foreground geometry: set `dofAuto:false` with a measured camera-space `dofFocus` when needed. Use shallower focus selectively, keeping the important face readable.

Start at 270 degrees shutter and 24 temporal samples for fast product motion; sample the actual animation and clip exposures at cuts. Do not add blur to graphic overlays. Camera v9 retains its authored scene shutter. Final delivery uses 1080p/30 fps, 28 Mbps, 24 samples for PULSE and 16 for CAMERA, preserving approved audio via `finish-film.mjs`.

Keep neutral fill low, rim lights behind the subject, environment reflections restrained, bloom threshold above ordinary surfaces. Do not add post-encode screen-blended glow: it previously contaminated neutral blacks. Inspect black rubber, chrome highlights, focus and fastest cuts at full resolution before publication. This baseline is a reusable raster studio setup, not path-traced global illumination or a guarantee of reference-level output.

## Detailed product films

PULSE and CAMERA include instanced fasteners, gaskets, optical/LED elements, PCB assemblies and mechanical hardware. Attach detail to the moving component, not the scene root. Use material differences by function (ABS, rubber, copper, ceramic and machined metal), and inspect exploded poses for clearance.

`configureDetailSampling(renderer, scene)` from `detail-sampling.js` sets anisotropic texture sampling up to the GPU limit and 4096px shadow maps. Call it after building meshes and lights. Specular environments use 1024px capture; compositing requests up to 8x MSAA, clamped to the GPU capability.

For premium delivery use `--quality premium`: 1920×1080, 48 temporal samples, 40 Mbps, resumable frames. This integrates the actual animated scene, including shutter and cut boundaries. A higher sample count smooths blur but does not change exposure length. PULSE uses 270–320 degrees; CAMERA uses 240–320.

Run `node scripts/quality.mjs --scene pulse --width 640 --height 360 --out renders/pulse-quality.png` (or `camera`) for clean/clay boards of critical macro and assembly poses. Beauty and quality boards are distinct checks. CAMERA's final lamellae follow separate parallel planes; this is a constrained assembly animation, not rigid-body dynamics.

Public film soundtracks can use separately licensed stock music. The local procedural audio fallback stays reproducible; stock WAVs are not part of the MIT source and must never be committed. See THIRD_PARTY.md for film credits.

### Shorter iteration loop

1. Freeze the approved animation; change one visual concern at a time. Use the clean/clay board above before a complete export. It uses one temporal sample so blur cannot hide geometry failures.
2. Inspect a short 540p preview around the changed shot. Render the complete premium film only after those frames pass review.
3. `node scripts/cli.mjs export --scene pulse --quality premium --out renders/pulse.mp4` retains finished PNG frames if interrupted. Rerunning the same command resumes matching frames. Source files, assets, scene parameters, browser version and sampling settings are fingerprinted; changed geometry cannot reuse obsolete frames.
4. Successful exports remove their frame cache. Add `--keep-frames on` to retain it for another encode; retained frames can consume several GB. Stop writers before removing `.motion-cache/renders/`. Never modify sources during an active render: use a frozen snapshot.

The cache skips rendering only, and always encodes a fresh output and audio. This saves interrupted work and repeat encodes; it does not make an individual 48-sample frame cheaper. Use `node scripts/test-render-cache.mjs` to check invalidation and recovery.

### Construction and impact motion

Build shells as separate load-bearing frames, housings, gaskets and functional parts. Open baskets, vents and PCB slots need real openings; black decals do not provide depth at macro distance. Lens cells use a sleeve, spaced baffles and curved optical elements, with no opaque decorative disks in front of the glass. Attach all hardware to its moving component and check the complete assembly clearance, not only the visible shell.

For PULSE, `impact-motion.js` provides deterministic bounded envelopes: approach with accelerating powers, staggered release, then a short outward recoil. The reveal retains the authored travel vectors and keeps glass/gasket phases equal. Impact motion is constrained animation, not a physics simulation. Time audio transients to `pulseImpactCues`; preserve duration when replacing stock audio.

City geometry shares continuous shadow ground without a visible plinth edge. New perimeter buildings are rejected when their footprints overlap the core, and traffic routes stay outside occupied blocks. Test both the close flight and the wider framing: a detail-only frame can hide invalid ground/support relationships.

Extreme optics can use `fisheye` (0–1) and `edgeSoftness` (pixels at 1080p) in the composite look. The fisheye mapping accounts for image aspect and keeps samples within the source image. Combine it with restrained `aberrationPx` and vignette; edge softness stays localized and the center remains sharp. It is an optical approximation, not ray-traced lens simulation. Review close passages for clipping and check typography, which should remain outside the lens pass.

Use `shadowGroundMaterial()` for dark studio floors. It restrains broad specular reflections and fades before the far clip plane, so a large support cannot become a bright rectangle or a hard horizon. Keep its geometry below the contact plane; inspect the beauty and clean passes.

## Supersampled and social delivery

For fine model detail, `--quality supersampled` renders 2560×1440 with 48 time samples and 80 Mbps; downsample once to 1080p with `export-social.mjs`. This improves spatial sampling as well as temporal blur, at a higher render cost. The `premium` preset remains the less expensive 1080p option. PNG-to-video encoding explicitly converts to limited-range BT.709 YCbCr and tags primaries, transfer, matrix and range; do not merely relabel an unknown existing video.

Keep the high-quality master, use `--target web` for the site and `--target x` for a smaller compatible social copy. See [export tools](../scripts/README.md). X can transcode all uploads; larger dimensions or bitrate do not guarantee better delivery. The social profile is a practical 1080p30/H.264/AAC choice based on [X creative specifications](https://help.x.com/en/business-and-advertising/creative-ad-specifications), not a promise to bypass compression.
