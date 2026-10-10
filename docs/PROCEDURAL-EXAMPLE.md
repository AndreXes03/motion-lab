# Procedural example

[Live animation](https://andrexes03.github.io/motion-lab/examples/procedural-field.html) · [Scene and formulas](../src/scenes/procedural-demo.js) · [Video with audio](https://andrexes03.github.io/motion-lab/)

Flows, a parametric torus, grid/spiral, waves and a tunnel are built in code. Time, seed and parameters determine each frame, without individual keyframes for every element.

The live preview and [GIF](../demo/procedural-showcase.gif) show the animation and personal logo. The [1080p film](../demo/procedural-techno.mp4) includes the edit, original 132 BPM techno and modular SFX.

Edit the [scene](../src/scenes/procedural-demo.js) and [parameters](../project/graphics.json). Regenerate the GIF with:

```sh
node examples/render-procedural.mjs
```

GIFs have no audio. Manual BPM changes affect pulses and music; cuts keep the demo's editorial timing. [Canvas2D engine](PROCEDURAL.md)
