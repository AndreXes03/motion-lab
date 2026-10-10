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
