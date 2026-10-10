# Procedural motion graphics

The Canvas2D engine calculates every frame from absolute time. Position, rotation, scale and masks can be functions: one rule animates hundreds of elements and supports arbitrary seeking.

The [demo](../src/scenes/procedural-demo.js) combines 55 flows, 60 parametric torus rings, 720 grid/spiral elements, 100 interference waves and a 26-frame tunnel. Edit [seed, density, speed and color](../project/graphics.json).

## Writing a scene

```js
const nodes = Array.from({length: 100}, (_, i) => ({
  id: `dot.${i}`, type: 'circle', radius: 8,
  x: t => 960 + Math.cos(t + i * .1) * 350,
  y: t => 540 + Math.sin(t + i * .1) * 350,
  fill: '#c2ff38'
}));
renderProcedural(ctx, time, {width: 1920, height: 1080, nodes, seed: 42});
```

Nodes include groups, circles, rectangles, text and paths, with transforms, opacity, blending and clipping. For SFX, `nodesAt(time, parameters)` returns the same graph used for drawing. `sound:false` excludes a node. `clear:false` allows overlays on an existing frame.

The demo uses 132 BPM techno and cuts every four beats. Manual BPM changes affect music and pulses, while cuts retain their original editorial timing. Export avoids motion blur across chapter boundaries.

## Checks

```sh
node scripts/test-procedural.mjs
node scripts/test-procedural-showcase.mjs
```

Rendering is repeatable within the same environment; fonts and browsers can change pixels. The 2D mode does not import footage or apply the 3D renderer's optical effects. [Live example](PROCEDURAL-EXAMPLE.md) · [Sound design](SOUND_DESIGN.md)
