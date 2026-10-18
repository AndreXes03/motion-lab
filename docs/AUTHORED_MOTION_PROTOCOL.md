# Authored motion: editor and agent contract

The original movement and a timing override are separate data. A straight progress
line from zero to one means “keep the authored clock”; it does not mean the film's
camera travels linearly. Inspect the source channels before changing timing.

`getAuthoredAnimationProtocol(scene, {motion, animation})` in
`src/engine/authored-animation.js` exposes a JSON-safe description of the current
recipe. Studio's Code workspace can hand this contract to an agent. The protocol
is an inspection view, not a second project format.

| Data | Saved location | Time domain | Value | Editability |
| --- | --- | --- | --- | --- |
| OBJECTS native camera/object channels | `parameters.motion.tracks` | Absolute source scene seconds | Scene units or radians | Existing keys: time, scalar axis value, outgoing easing |
| Target timing | `parameters.animation.groups[groupId]` | Seconds relative to `start` | Normalized source progress 0–1 | Independent target timing inside `start`–`end` |
| Numeric parameter automation | `parameters.animation.tracks[controlId]` | Source scene seconds | Catalog parameter units | Bounds and binding come from the control catalog |
| Function-authored pose observations | Runtime inspection only | Source scene seconds | Actual evaluated pose | Read-only samples; no invented editable keys |

Every native scalar descriptor has a stable `id`, `binding.track`, optional vector
`binding.component`, recipe `binding.path`, units, `editable`, `timeDomain` and
`easingOwner`. Native vector tracks share key times and outgoing easing across XYZ.
Editing a scalar value changes only that component. Changing time or easing changes
all three axes at that source key; the UI must state this explicitly.

Use the immutable bridge to change an existing native source key:

```js
const nextMotion = editAuthoredKey(
  'objects', 'camera', 'camera.position.x', 1,
  {value: -2.4, ease: 'bezier', bezier: [.2, .1, .7, .85]},
  {motion: parameters.motion}
);
// Save as parameters.motion; leave parameters.animation unchanged.
```

The index refers to the complete source track, even when the editor shows one shot.
Times must remain strictly increasing; invalid edits throw without changing input.
The current bridge edits existing keys. It does not silently add, remove, or resample
keys. The UI owns undo history; recipes and local rendering retain the same document.

Each key owns the easing **leaving** it. Missing native easing means `smooth`, the
exact quintic `6u^5 - 15u^4 + 10u^3`. It is not interchangeable with cubic smoothstep
or a visually similar Bézier curve. Native rendering and editor sampling share
`easeProgress`; Bézier evaluates y after inverting x and accepts four values in
`[0,1]`. `hold` retains the left value until the next key time. `linear`, `in`, `out`
and `inOut` use their actual runtime definitions. Merely opening a curve must never
replace these easing modes with approximations.

For function-authored scenes, implement `animationState(groupId, time, parameters)`
and `animationChannels(groupId)` to expose actual evaluated movement. Until a scene
provides a real source-key binding consumed by its renderer, those channels remain
observations. Connecting samples with linear lines is a display convention, not
evidence that the original movement has linear easing. Retiming is still available
as a separate operation and must not be described as editing source keys.

Validate with `node scripts/test-authored-motion-protocol.mjs`. It checks exact
source/editor sampling, immutable edits, shared vector timing, native Bézier recipe
round trips, rejection of invalid patches, and unchanged defaults across all scenes.
