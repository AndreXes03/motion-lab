# Viewer locale

[main.js](main.js) costruisce lo studio: selezione della composizione, timeline, preset, controlli, versioni ed export. [style.css](style.css) gestisce layout e pannelli. Il [pannello reference](reference-panel.js) raccoglie media e note di lavoro locali.

Il viewer chiama il [runtime](../engine/runtime.js) per la preview e le [API locali](../../scripts/studio-api.mjs) per salvataggi ed export. Le API richiedono il server locale: la demo web pubblicata mostra il film, mentre lo studio completo si avvia con `npm run viewer`.

[Guida d’uso](../../docs/USAGE.md) · [Schema dei controlli](../../project/studio.json)
