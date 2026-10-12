# Studio viewer

[main.js](main.js) builds the scene workspace: Properties, Motion, timeline, presets, versions, preview and export. [style.css](style.css) handles its layout. Desktop exposes the complete authoring workspace; mobile keeps essential controls usable in a simpler layout.

Properties uses the shared [control widgets](control-widget.js), the scene catalog and the agent-authored panels in [control-selections.json](../../project/control-selections.json). Its categories are Motion, Lens, Lights, Compositing, Character, Graphics and Appearance. Advanced panels start closed. Search and category filters expose supported tools without deleting their existing animation tracks. [control-presets.json](../../project/control-presets.json) supplies curated lighting/compositing profiles and optional scene-specific interpolation suggestions.

The [Motion panel](motion-panel.js) edits a camera or object group's progress curve inside an authored shot. Each target has its own clip and rate. Advanced parameter tracks animate individual numeric values with independent rates. The film clock, cuts, captions and unrelated targets keep their timing. Suggested interpolation fills the editor; saving a key applies it. Versions and JSON recipes retain these curves and the selected tool layout.

[Preview quality](preview-quality.js) provides Auto, Balanced, Fast and Sharp. Auto responds to interaction and measured frame cost; Fast simplifies supported effects. This browser-local preference never enters saved parameters or export settings. Preview requests pass the transient `previewQuality` render option to the [runtime](../engine/runtime.js); final rendering uses its own dimensions, frame rate, temporal samples and full effects.

Run `npm run viewer` for the local Studio and its [API](../../scripts/studio-api.mjs). In browsers with canvas recording support, the published Studio can export browser-rendered 720p or 1080p video, PNG frames and JSON recipes, with versions stored in that browser. MP4 is offered when the browser supports its encoder; otherwise it offers WebM. Browser video uses the real-time Three.js/Canvas path. Cycles and prepared Mixed renders require the local app; choosing one in a recipe does not mean the public site ran it. [Renderer selection](../../docs/RENDERER_SELECTION.md) describes the separate strategy/capability contract; selecting an engine does not verify its availability or picture fidelity.

The [reference panel](reference-panel.js) keeps local media and notes. Follow the [scene-control authoring contract](../../docs/ADAPTIVE_CONTROLS.md) and [visual checks](../../docs/QUALITY-GATES.md) when extending the editor or adapting a film. A passing build or deterministic preview remains technical evidence, not creative approval.

[Usage](../../docs/USAGE.md) · [Control schema](../../project/studio.json) · [Animation groups](../engine/animation-groups.js)
