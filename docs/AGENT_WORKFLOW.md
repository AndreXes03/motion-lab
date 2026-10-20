# Agent workflow

The agent edits code and JSON. References guide visual choices; they are not automatically converted into scenes.

For a commercial or founder launch video, load the [product-film skill](../.agents/skills/motion-lab-product-film/SKILL.md) first. It adds guided discovery, a direction card, distinct shot purposes and review criteria to the implementation workflow below. Reuse the founder's known answers and choose technical defaults yourself. The [founder guide](FOUNDER_START.md) provides a ready-to-use starting prompt; this is an agent workflow, not a built-in conversational wizard.

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


## Default for new 3D work

Start from the approved wide/contrast baseline in [3d-lookdev.md](3d-lookdev.md), using `studio-baseline.js` and `createStudioMaterials`. Use matte plastic, rubber and metal deliberately, neutral shadow fill, restrained scene bloom, and temporal motion blur. Preserve existing approved scenes. Render a few frames and a 540p preview before a final export; require the user's creative approval before replacing approved films.


## Required scene authoring contract

Every new or revised video needs implemented controls, agent-selected category panels and rationale, independent camera/object motion groups, and a supported renderer intent. Follow [AGENTS.md](../AGENTS.md) and [Scene controls and motion curves](ADAPTIVE_CONTROLS.md). Inspect with `controls.mjs catalog`, validate selections with `plan` and profiles with `preset-plan`, then save only the chosen scene through `set` or `preset-set`. Keep at most four preset variants per scene/category and at most 15 native values in a lighting/compositing profile. Preserve unrelated scenes and the approved default picture.

Preview quality never changes final output or renderer choice. Select a final-render recommendation within implemented adapter support, verify local preflight separately, and record native-frame evidence before claiming a working conversion. [Renderer selection](RENDERER_SELECTION.md) and the installed adapter define current scene support; Mixed requires prepared local inputs. Run the browser-free prebuild contracts, focused browser checks and any real native proof independently. Technical success and creative approval remain distinct.
