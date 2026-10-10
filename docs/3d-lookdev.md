# Fast 3D look development

Use `createStudioMaterials(renderer)` from `src/engine/studio-lookdev.js` once per scene. It provides fibre, leather, enamel, brushed metal, and an HDR reflection environment. Reuse materials across meshes; dispose the kit when the scene is removed. These are starting points, not a guarantee of photorealism. Match texture scale and reflection-card placement to the object.

## Render only what you need

- `node scripts/cli.mjs frame --scene camera --quality lookdev --time 4.43 --out frame.png`: one 1440p frame, one temporal sample.
- `node scripts/cli.mjs preview --scene pulse --quality preview --out preview.mp4`: 540p for timing.
- `node scripts/cli.mjs export --scene camera --quality final --out final.mp4`: 1080p, 16 temporal samples, 28 Mbps. Scene adaptive sampling remains active (PULSE uses 32 on its fastest speaker transition).

Explicit width, height, bitrate and temporal-sample flags override the preset. No preset changes camera paths or animation. Existing CLI calls without `--quality` retain their defaults.

Use AgX tone mapping for highlight handling and inspect a clean frame alongside the composite. Narrow reflection cards and dark gaps articulate glossy surfaces; avoid raising roughness everywhere. Normal maps describe micro-relief; they are not displacement. Motion blur integrates actual scene time samples. The WebGL renderer does not provide path-traced global illumination.

The v6 publication preserves the approved audio and adds a restrained highlight-only glow after rendering. Its exact finishing command and input versions are recorded in the delivery script, not in the scene motion.

Reproduce the restrained glow and preserve approved AAC audio with `node scripts/finish-film.mjs --video silent.mp4 --audio approved.mp4 --out final.mp4`. It refuses to overwrite an existing output. Match input durations before finishing.
