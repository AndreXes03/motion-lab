# Studio: controlli e percorsi camera

I controlli ad hoc delle due demo sono definiti in `project/studio.json`. `src/engine/project-controls.js` esporta `studioProjects` per costruire il pannello e `resolveParameters(scene, values, presetId, baseLook)` per produrre i parametri del renderer. Il preset `original` conserva il look 3D di progetto; `objectMotion` varia solo il movimento degli oggetti, senza spostare la camera.

Per i prossimi animatic, `src/engine/camera-path.js` offre una traiettoria camera riusabile, indipendente dalla scena BAX attuale:

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

Coordinate e `lookAhead` sono in metri, `duration` e `sample(t)` in secondi. `position`, `target` e `tangent` sono nuovi `THREE.Vector3` per ogni campione; `length` è la lunghezza totale in metri e `speed` è in m/s. La Catmull-Rom usa campionamento per lunghezza d’arco (`getPointAt`), così la velocità lungo il percorso rimane quasi costante anche con segmenti di lunghezza diversa. `lookAhead` mira a un punto più avanti sulla curva ed estrapola la tangente alla fine. Il campionamento è deterministico, senza stato di playback; tempi fuori intervallo vengono bloccati agli estremi. Non modifica la scena o la camera esistente finché non lo si usa esplicitamente.

Verifica: `node scripts/test-camera-path.mjs` controlla uniformità dei passi, seek arbitrari, estremi e input non validi.
