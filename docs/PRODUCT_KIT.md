# Start from the product kit

The reusable entry point is `src/product-kit/index.js`. Open **Product starter** in the studio (`?scene=starter`) or render it directly:

```sh
node scripts/cli.mjs frame --scene starter --time 3 --quality lookdev --out renders/starter.png
node scripts/cli.mjs preview --scene starter --quality preview --out renders/starter.mp4
node scripts/cli.mjs export --scene starter --quality premium --sound off --out renders/starter-final.mp4
```

Copy `src/scenes/product-starter.js` to author a different product. Register the new scene in `scene-registry.js` and its factory in `engine/runtime.js` (the studio/CLI use that registry). Include its ID in `isNewScene`; provide shutter/cut metadata and a source-inspector entry. The starter demonstrates runtime controls, absolute-time animation, focus, resizing and clean/clay views. It uses the existing temporal export pipeline; a live frame itself does not contain temporal blur. The kit is a construction baseline, not a promise that every new shot inherits the films' art direction.

## What to reuse

| Function | Contract |
| --- | --- |
| `createProductStage(renderer, options)` | Scene, camera, material kit, contrast lighting, restrained finishing, `prepare()`, `render(time, options)`, `dispose()`. Options: `colors`, `lighting`, `look`, `background`, initial width/height. Caller owns renderer and model geometry. |
| `createStudioMaterials(renderer, {colors})` | Named rubber, leather, matte/satin plastic, brushed/anodized metal, enamel, fibre, glass, copper, ceramic. `variant(name, overrides)` makes a tracked material variant while sharing textures. Dispose only after all models are removed. |
| `createStudioLighting(scene, options)` | `scale`, `keyStrength`, `rimStrength`, `fillIntensity`, `environmentIntensity`. Defaults preserve the earlier studio baseline. Scale assumes a roughly three-unit subject. |
| `createFilmAsset(kind, options)` | Access to the **existing film models**: `camera`, `turntable`, `headphones`. Returns `root`, named `parts`, `dispose()`. `size` normalizes the longest dimension; `environment` is borrowed. Camera also requires `renderer`. Original labels/materials remain; change deliberately. |
| `createHousingPanel(materials, options)` | Rounded, bevelled panel with real circular openings and instanced fasteners. Width/height/depth/radius and `holes: [{x,y,radius}]`. Rejects overlapping/edge-breaking holes. |
| `createRotaryControl(materials, options)` | Layered control with rubber body, instanced knurling, metal collar and satin cap. Radius/depth/ridge count. |
| `createOpticalCell(materials, options)` | Open sleeve, spaced baffles, curved glass, collars and fasteners. Radius/depth/ridge count. Raster glass limitations still apply. |
| `createImpactMotion(options)` | A function of absolute time returning an outward offset. Start/hit/end, travel, accelerating power, recoil, decay and bounce count. Never crosses the seat; this is constrained animation, not collision physics. |
| `createProductCameraMove(options)` | Points, optional fixed target, start/duration, FOV, bank, linear/accelerating/decelerating pace and power. `apply(camera,time)` resets pose; arbitrary seeking is safe. |

## A real film model in a new scene

```js
import {createProductStage, createFilmAsset} from '../product-kit/index.js';
const stage = createProductStage(renderer, {
  lighting: {fillIntensity: .06, rimStrength: 1.1},
  look: {fisheye: .12, dofAuto: false, dofFocus: 4}
});
const asset = createFilmAsset('camera', {
  renderer, environment: stage.kit.environment, size: 3
});
stage.scene.add(asset.root);
stage.prepare(); // after building lights, models and textures
// Set camera and object poses for each absolute time, then stage.render(time).
// On teardown: asset.dispose(); stage.dispose(); renderer.dispose();
```

The camera adapter currently builds companion props offscreen too; it is a reuse bridge, not a cheap downloadable asset format. Load it once, not per frame. Material maps and environments are created once per stage. Film asset instances own their geometry and material resources; procedural components borrow kit materials and own only geometry. Do not dispose the stage while its materials are used elsewhere.

## Efficient authoring

1. Choose existing models/components before writing new geometry. Use `kit.variant('rubber', {color:'#151617'})` rather than rebuilding a material library. Texture variants share maps: clone a map before changing its repeat independently, and dispose that clone yourself.
2. Evaluate one clean/clay frame and a beauty frame at the **same time**. Check silhouette, holes, material scale and reflection shape. Then review a short moving section around the contact/cut.
3. Keep neutral fill low, actual matte materials on broad surfaces, and glow above normal surface brightness. Enlarge the camera path for parallax; lens distortion alone does not add parallax.
4. Freeze the scene before a premium render. More samples smooth temporal blur; shutter angle sets its length. See [render workflow](3d-lookdev.md#shorter-iteration-loop) and [compositing limits](COMPOSITING.md).

Run `npm run test:product-kit` for contact bounds, deterministic camera motion, model ownership and controls. Browser checks in `scripts/test-product-kit-browser.mjs` exercise actual rendering, parameters, diagnostic views and resource teardown. The original published films are not rewritten by the starter.
