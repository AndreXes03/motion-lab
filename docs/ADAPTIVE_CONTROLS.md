# Scene controls and motion curves

Studio uses a shared catalog of 104 implemented controls across eight scenes. Each scene ships with an agent-authored selection, categorized panels and a concise selection rationale. The coding agent chooses these tools while making the video; the editor does not require runtime AI inference.

## Workspace

**Properties** opens the selected Project tools. **Complete tool catalog** exposes additional supported controls, category filters and search. Sliders have numeric inputs for precise changes. The categories are Motion, Lens, Lights, Compositing, Character, Graphics and Appearance; a scene only shows categories it supports. Advanced panels start closed. Selecting a BAX object, camera or lights filters its contextual properties.

Lights and Compositing panels offer small, editable preset collections. Selecting a lighting or compositing preset applies its native control values; it does not change the selected animation curves. Universal `colorContrast` and `colorSaturation` controls finish the displayed image after temporal integration. Their neutral defaults are exact no-ops. Scene exposure, bloom and grain remain separate controls, with stronger adjustment ranges where the renderer supports them.

Desktop is the reference for the complete workspace. Mobile provides essential controls in a simpler layout. Saving a version or downloading a JSON recipe retains control values, the selected panel layout, animation and scene settings. Undo/redo and Reset include these authoring changes.

## Camera and object motion

Open **Motion** and choose an **Animation target** from Camera and object groups, then choose a **Motion clip**. The timing graph shows the authored pose clock. Drag a point to retime that target; the edit commits when you release, and **Escape** cancels the current gesture. Double-click an empty part of the graph to add a key. Use the **← / →** controls (or arrow keys while the graph is focused) to move between keys, then adjust the selected key's timing or easing in the editor. The **↺** button restores the authored timing. Camera curves affect camera poses; object curves affect their declared object group. Other targets, film duration, cuts, visibility, captions and music keep their timing. The original movement remains available under the read-only **Original motion** section.

Each target currently stores one clip. Choosing another shot changes the editor view; creating its curve replaces that target's previous clip. Camera targets initially suggest the first authored shot. The **Selected target rate** affects only the selected group or parameter track, within the allowed 0.25–2.5× range.

| Scene | Available motion groups |
| --- | --- |
| BAX | Camera, radio, gyro, emblem |
| PULSE | Camera, mechanisms |
| CAMERA | Camera, city vehicles |
| Product starter | Camera, product |
| DOT | Camera, character |
| REPLAY | Camera, cards |
| POP | Camera, lettering and player |
| Procedural | Graphics |

A group key's time is local seconds from the clip start, and its value is motion progress from 0 to 1. The group maps that progress onto its own source pose time. Outside the clip, the authored clock resumes. The group changes poses rather than a global video clock.

**Advanced parameter tracks** exposes individual numeric controls, including retained tracks whose Properties controls are hidden. These tracks animate native parameter values at absolute scene times. Each track has its own rate. Tracks hold their first/last values outside their key range, and integer controls are rounded after interpolation.

Every key owns its outgoing interpolation: Smooth, Linear, Hold, Ease in, Ease out, Ease in/out or cubic Bézier. **Easing preset** fills the editor from the scene's curated curves; press ✓ to apply it. The selected segment shows draggable Bézier handles without changing the recipe. Moving a point or handle updates the preview live; one Undo restores the complete gesture. The four handle coordinates are also editable under Advanced, within 0–1. The evaluator inverts Bézier x before sampling y. Simultaneous multi-track editing remains future work.

**Enable keyframes** bypasses all added group curves and parameter tracks without deleting them. Existing authored `motion.tracks` keep their smooth default and honor explicit outgoing easing. New curves do not rewrite those authored tracks.

## Interactive preview and final render

Preview offers **Auto**, **Balanced**, **Fast** and **Sharp**. Auto adjusts resolution during interaction and according to measured frame cost. Balanced uses a smaller full-effect preview; Sharp favors detail. Fast uses a smaller image and bypasses expensive effects in supported scenes. Mobile also limits preview dimensions.

Preview preferences are browser-local. The transient `previewQuality` flag never enters a saved recipe or the Studio API. Final output uses its own export dimensions, frame rate, temporal samples and full authored effects. A fast preview does not lower final export quality. Select a full-effect preview when judging focus, bloom or fine material detail.

In browsers with canvas recording support, the public Studio exports browser-rendered video at 720p or 1080p, PNG frames and JSON recipes. MP4 is offered when the browser supports its encoder; otherwise it offers WebM. Browser video uses the real-time Three.js/Canvas path. Cycles and prepared Mixed renders remain local-only; their selections may be preserved in recipes but are not executed on the public site. Renderer strategy and local capability checks are separate from preview quality; see [Renderer selection](RENDERER_SELECTION.md) for Auto, Three.js, the PULSE-only Cycles adapter and prepared mixed compositing plans. `project/render-plans.json` stores agent recommendations. PULSE currently recommends Auto with a Cycles preference at 96 samples; Auto still resolves against local capabilities and time budget. Unsupported explicit engines are blocked, and Mixed currently uses the prepared local compositor CLI. Engine selection or a successful export is not visual approval.

## Agent authoring contract

Every new or revised scene must ship real editable capabilities, a chosen tool layout and supported motion groups. Register only parameters the renderer consumes, preserve the approved defaults and use absolute-time evaluation.

`src/engine/control-catalog.js` owns safe public parameter bindings. `src/engine/scene-capabilities.js` declares study controls resolved through `parameters.sceneControls`; product starter uses `parameters.product`. Paths are arrays: `['objectEdits', 'device.root', 'x']` preserves the dotted object name. Existing composition controls use `binding: 'value'`; additional parameter controls use `binding: 'parameter'`. Bounds and persistence must agree with server validation.

`src/viewer/control-widget.js` supplies shared widgets. The current catalog uses ranges with number inputs, color, text and toggles. Reuse widgets and category panels before adding scene-specific UI. Add another widget type only alongside a real binding and validation.

The agent-selected layout lives in `project/control-selections.json`. Recipes retain it in `parameters.studio.controlManifest`. A manifest lists selected IDs, a rationale, and panels with IDs, titles, categories, controls and advanced flags. Every selected control belongs to exactly one panel. The manifest controls visibility and ordering; hiding a tool must retain its animation tracks.

A minimal version 1 manifest is still accepted:

```json
{"version":1,"scene":"bax","controls":["shell","energy","fov"]}
```

It receives category panels automatically. Missing or empty early draft selections migrate to the scene's current authored recommendation. Invalid nonempty selections are rejected. DOT, PULSE, CAMERA and REPLAY now have real adapters and saved selections; they no longer depend on empty legacy control lists.

Use the CLI to make the selection reviewable before saving it:

```sh
node scripts/controls.mjs catalog --scene pulse
node scripts/controls.mjs plan --scene pulse --controls mechanismMotion,lensStrength,keyLight,exposure --advanced compositing --reason "Mechanism, lens and key light, with exposure available for finishing"
node scripts/controls.mjs set --scene pulse --file manifest.json
node scripts/controls.mjs check
```

Pass `--file` to `plan` when the scene needs custom panel titles, order or advanced flags. `set` updates only that scene and requires a rationale plus a usable numeric animation tool. Motion groups and recommended shot windows are declared in `src/engine/animation-groups.js`; a new scene must register them and implement independent target clocks.

## Author lighting, compositing and interpolation presets

`project/control-presets.json` stores curated scene profiles. Keep three useful variants where appropriate, with at most four per scene/category and at most 15 controls in a lighting or compositing profile. Use native values from the catalog, not slider percentages. Each profile needs a concise label and a rationale explaining its visible purpose. Unsupported Lights categories return no lighting presets.

Compositing and interpolation can inherit shared profiles or use a scene override. Editing a scene override must preserve other scenes. Curves use `ease` plus optional `bezier` handles; they do not contain lighting or grading values.

A scene lighting profile has this shape:

```json
{
  "id":"soft",
  "label":"Soft studio",
  "description":"More supporting light reveals molded surfaces without harsh shadows.",
  "values":{"keyLight":0.85,"fillLight":1.3}
}
```

Validate it before saving:

```sh
node scripts/controls.mjs preset-catalog --scene pulse
node scripts/controls.mjs preset-plan --scene pulse --category lights --file profile.json
node scripts/controls.mjs preset-set --scene pulse --category lights --file profile.json
node scripts/controls.mjs preset-plan --scene pulse --category interpolation --id balanced
```

`preset-plan` accepts an existing `--id` or a proposed `--file`. `preset-set` saves the validated profile only for the selected scene/category. Replace an existing ID when the category already contains four variants. Categories are `lights`, `compositing` and `interpolation`. The validators reject unknown controls, wrong categories, invalid types, out-of-range values and unsafe keys. Suggested interpolation can be customized under `scenes[scene].interpolation`; loading or selecting it does not apply a curve until the key is saved.

## Animation recipe schema

The optional `parameters.animation` document keeps group timing and parameter timing separate:

```json
{
  "version":1,
  "enabled":true,
  "groups":{
    "camera":{
      "start":0,"end":1.46,"rate":1,
      "keys":[
        {"t":0,"value":0,"ease":"bezier","bezier":[0.42,0,0.58,1]},
        {"t":1.46,"value":1,"ease":"linear"}
      ]
    }
  },
  "tracks":{
    "exposure":[
      {"t":0,"value":1,"ease":"smooth"},
      {"t":4,"value":1.25,"ease":"linear"}
    ]
  },
  "rates":{"exposure":1.2}
}
```

This example targets PULSE. Groups-only recipes may omit `tracks`; the validator normalizes it to `{}`. Group windows must lie inside scene duration; local key times must lie inside the window. Parameter key times use absolute scene seconds. All key times strictly increase. Progress is bounded to 0–1, parameter values obey catalog bounds, and each group or parameter rate is 0.25–2.5. The limits are 100 parameter tracks and 1000 keys total across parameter and group curves.

`src/engine/parameter-animation.js` validates and evaluates parameter tracks without mutating the input. `sampleAnimationGroupTime` returns the authored timestamp for a missing/disabled group or outside its window. Identity curves preserve that exact timestamp. Scene adapters consume only their own group's sampled pose time.

Early draft `animation.rate` is accepted only for migration: it supplies a rate for existing parameter tracks without an explicit `rates[id]`. Normalized recipes set legacy `rate` to 1. It never retimes groups or the film. New authoring uses group-local rates and per-parameter `rates`.

## Required checks

The build runs `scripts/test-scene-control-contract.mjs`, `scripts/test-motion-workflow.mjs`, `scripts/test-render-policy.mjs` and `scripts/cycles/test.mjs` before bundling. These are browser-free contract checks. They cover every registered scene's capabilities, saved panel selection, universal grade controls, supported groups, presets, API round trips, legacy rate migration and supported renderer recommendations. A future scene without its required authoring contract fails the build. `npm run test:compositor` separately checks the executable local composition plan and small media encodes.

Use `node scripts/test-adaptive-controls.mjs` for detailed parameter validation and evaluator checks. With Studio running locally, `node scripts/test-adaptive-controls-browser.mjs` exercises key editing, undo/redo, recipes and renderer comparisons; `node scripts/test-scene-tools-browser.mjs` checks selected panels and category tools across scenes. `node scripts/tools-preview.mjs --scene pulse --time 3.65 --category lights` captures a desktop panel proof; add `--mobile` for the simpler layout.

Compare representative default and changed frames, arbitrary seeks, disabled curves and restoration to the baseline. Some effects are shot-dependent: CAMERA bloom affects bright-highlight shots and may have no effect in a dark opening frame. Passing a schema, build, pixel comparison or export check is technical evidence. Changed films still require the repository's visual delivery review; full AE/C4D parity and in-app model inference are separate future capabilities.

## Original movement in the curve editor

Opening a group displays its original timing reference keys without storing an override. BAX exposes its actual source keyframes; function-authored camera motion exposes evaluated position, rotation, zoom or field-of-view observations. Sampled paths are labelled as observations and are read-only. The editable timing curve controls when the existing pose is sampled, without applying native easing twice. Inspecting the original movement restores the current preview frame and leaves saved parameters intact.
