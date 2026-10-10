# Sound design

Enable **Sound design** and press Play. Camera, objects, accents and music have separate volumes; 0 mutes a module. Changes apply on the next playback.

- **3D:** camera whooshes, rotations, hinges and mechanical detents.
- **2D:** shapes, text, entrances and transitions drive SFX. Density selects the main gestures in grids.
- **Music:** scene, techno and ambient styles, with automatic or manual BPM. The 2D demo uses original 132 BPM techno. Manual BPM changes affect music and pulses, while cuts retain their editorial timing.
- **Output:** playback, stereo WAV and audio in video exports. Recipes and versions store volumes, timbres and variant in `parameters.sound`.

## Commands

```sh
npm run export -- --sound on --out renders/film.mp4
npm run preview -- --scene procedural --sound on --out renders/procedural.mp4
```

`--sound off` exports without audio. To add sound to an existing render:

```sh
npm run soundtrack -- --video renders/film.mp4 --recipe renders/film.mp4.project.json --out renders/film-audio.mp4
```

The video, recipe and sources must match. The command preserves the video stream and saves the WAV mix and separate stems. Use a new output filename. `npm run sound:bank` generates timbre samples as WAV files.

## Extension and limits

Audio is stereo at 48 kHz; movement is sampled at 60 Hz. 3D profiles use `userData.sound`. In 2D, `nodesAt(time, parameters)` shares the drawing graph. `sound:false` excludes a node and its children.

Local synthesis includes a [wind texture](../src/assets/audio/provenance.json). Audio visibility is geometric: it does not read pixels or simulate collisions. Imported-track BPM analysis and time-stretch are not implemented. [Workflow](AGENT_WORKFLOW.md) · [Validation](VALIDATION.md)
