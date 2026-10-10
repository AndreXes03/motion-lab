# Studio controls and camera paths

Demo controls are defined in `project/studio.json`. `src/engine/project-controls.js` exports `studioProjects` for the panel and `resolveParameters(scene, values, presetId, baseLook)` for renderer parameters. The `original` preset preserves the 3D look; `objectMotion` changes object movement without moving the camera.

`src/engine/camera-path.js` provides a reusable camera path:

```js
import { createCameraPath } from './src/engine/camera-path.js';

const path = createCameraPath(
  [[0, 1.5, 4], [2, 1.8, 2], [4, 2.1, -1], [6, 1.6, -4]],
  { duration: 8, lookAhead: 0.7 }
);
const { position, target, tangent, length, speed } = path.sample(3.25);
camera.position.copy(position);
camera.lookAt(target);
```

Coordinates and `lookAhead` are in meters; `duration` and `sample(t)` use seconds. Each sample returns new `THREE.Vector3` values for `position`, `target` and `tangent`. `length` is in meters and `speed` in m/s.

The Catmull-Rom curve uses arc-length sampling (`getPointAt`) for nearly constant speed across unequal segments. `lookAhead` targets a point ahead on the curve and extrapolates the tangent at the end. Sampling is deterministic and clamps out-of-range times. It only affects a scene when explicitly applied.

`node scripts/test-camera-path.mjs` checks step uniformity, arbitrary seeks, endpoints and invalid inputs.
