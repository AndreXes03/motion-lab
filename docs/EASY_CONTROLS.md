# Author Easy for the scene, not for the catalog

Easy is a small set of decisions a first-time video user can understand. Pro retains the selected native controls and precision editors. An agent must design both while creating or revising a scene. Hiding a few advanced sliders is not an Easy design.

## Required authoring workflow

1. Inspect the actual scene, its brief and `node scripts/controls.mjs catalog --scene ID`. Decide the 2–4 visual outcomes a beginner would realistically change; the schema allows 1–5, never a quota. App Demo content remains in Edit screens & text.
2. Add `easy` to the same version-1 control manifest used for the Pro selection. Give each group a short result-oriented label, one plain sentence, and 2–3 named choices. Use scene-specific combinations of real controls; do not invent a camera, universal energy slider or unavailable effect. Avoid units, jargon, individual axes, timing handles and shader details.
3. Each choice supplies explicit native values for the same target IDs. Every target must be in `controls` and its Pro panel. Different Easy groups cannot touch the same target. Keep alternatives conservative, visibly distinct and compatible with the authored shot timing, typography, framing and identity. A label such as Original must match the authored baseline. No choice is applied merely by opening Easy.
4. Save a complete manifest with `node scripts/controls.mjs plan --scene ID --file manifest.json`, then `set` with the same arguments. A saved selection without Easy is rejected. `--controls` is a planning convenience, not a complete beginner experience.
5. Run `node scripts/controls.mjs check`, `node scripts/test-easy-controls.mjs`, and the required scene contracts. Visually inspect each changed group at a relevant frame or short passage; numeric validation alone does not prove the choice looks good. Verify a compound choice, Undo, Pro round-trip and saved/rendered parameters. Do not run a full export solely for an interface change.

## Manifest fragment

Merge this into a scene manifest whose catalog implements and selects these controls:

```json
{
  "easy": [
    {
      "id": "movement",
      "label": "Product movement",
      "help": "Coordinate product turns and the separation of its parts.",
      "choices": [
        {"id": "gentle", "label": "Gentle", "values": {"motionAmount": 0.5, "explodeAmount": 0.55}},
        {"id": "original", "label": "Original", "values": {"motionAmount": 1, "explodeAmount": 1}},
        {"id": "lively", "label": "Lively", "values": {"motionAmount": 1.2, "explodeAmount": 1.15}}
      ]
    }
  ]
}
```

Choices support bounded numeric controls, colors and toggles with direct parameter bindings. The legacy `contrast` composite is not a direct target: choose its actual lighting controls instead. Related toggles and numeric values must be bundled explicitly if needed; never rely on a hidden precondition.

## Preservation and compatibility

Easy writes the existing parameters in one undoable recipe edit; it does not add renderer-only shortcuts or an independent visual state. Current values determine the selected choice. Custom values stay untouched and are labelled as custom. Active parameter keyframes disable the affected Easy group and direct the user to Pro. Sound, timing, output settings and unrelated edits are preserved.

Old manifests without `easy` remain valid: Studio uses only compatible groups from the scene's authored definition. If none are compatible, it asks for an agent-authored Easy selection rather than exposing the entire catalog. New/revised selections must include Easy; new scenes without it fail the scene contract. For a custom recipe, save its custom Easy definition in `parameters.studio.controlManifest`, not only in the shared scene defaults.

## Compact icons and coordinated sliders

Set `icon` on a group to a semantic pictogram: `motion`, `text`, `lighting`, `color`, `finish`, `detail`, `size`, `depth`, `character`, `focus` or `glow`. Lighting choices may use `soft-light`, `balanced-light`, `dramatic-light`. Icons are decorative and always accompanied by readable labels; do not rely on them alone.

Choose `presentation: "slider"` when a continuous intensity is meaningful. Supply exactly three numeric choices ordered from the left endpoint through the middle to the right endpoint. They define native values at 0, 50 and 100; intermediate values interpolate each target between the adjacent authored anchors. The middle should normally be the original look; endpoint labels must describe the actual range. Avoid nonmonotonic curves or two positions yielding the same entire value bundle. Toggles, colors and categorical alternatives remain `presentation: "choices"` (the default). A slider is a presentation of real controls, not a new renderer parameter.

Keep the total at five or fewer. Use a mixed layout only where it reduces effort: continuous movement/finish, categorical lighting. Validate intermediate values, animation protection, live preview, one Undo per drag and Escape cancellation. A project-specific manifest stores its own presentation; updating shared defaults does not silently replace its authored choices.
