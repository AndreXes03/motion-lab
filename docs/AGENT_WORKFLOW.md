# Agent workflow

The agent edits code and JSON. References guide visual choices; they are not automatically converted into scenes.

1. **Read the brief and references.** Inspect images and videos for camera, lighting, palette and movement.
2. **Edit the scene.** Look settings live in `project/look.json`, tracks in `project/motion.json`, geometry in `src/components/` and compositions in `src/scenes/`. Use absolute time and seeded randomness.
3. **Compare frames.** Use matching timestamps, then a contact sheet to check clipping, reflections, text and camera transitions.
4. **Watch a full preview.** Check movement, transitions and the audio mix.
5. **Export and verify.** Check dimensions, duration, frame rate and seeking; open the final video. Record technical validation separately from creative approval.

```sh
npm run contact -- --samples 6 --out renders/contact.png
npm run preview -- --sound on --out renders/preview.mp4
npm run export -- --sound on --out renders/film.mp4
npm run verify -- --out renders/film.mp4 --time 2.8
```

## Audio

`parameters.sound` stores enable state, volumes, density, timbres, seed and BPM. `--sound off` omits audio.

Assign `userData.sound` profiles to new 3D mechanisms. For 2D scenes, expose `nodesAt` and `render` from the same graph construction so sound follows the actual animation. `sound:false` excludes a node. See [controls and limits](SOUND_DESIGN.md).

Keep sources, recipes and tracks. Personal references, local versions, intermediate renders and `node_modules` stay outside the public repository.
