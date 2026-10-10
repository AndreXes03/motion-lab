# Local viewer

[main.js](main.js) builds the studio: composition selection, timeline, presets, controls, versions and export. [style.css](style.css) handles layout and panels. The [reference panel](reference-panel.js) collects local media and notes.

The viewer uses the [runtime](../engine/runtime.js) for preview and the [local API](../../scripts/studio-api.mjs) for saves and exports. Run the full studio with `npm run viewer`; the published web demo plays the rendered films.

[Usage](../../docs/USAGE.md) · [Controls schema](../../project/studio.json)
