# Motore

Il punto di ingresso è [runtime.js](runtime.js): valuta la scena al tempo richiesto e produce un fotogramma.

| File | Cosa fa |
| --- | --- |
| [runtime.js](runtime.js) | Seleziona 3D/2D, applica il look e compone il frame |
| [animation.js](animation.js) e [timeline.js](timeline.js) | Valutano tracce e interpolazioni al tempo assoluto |
| [camera-path.js](camera-path.js) | Percorso camera campionato per lunghezza d’arco |
| [studio.js](studio.js) | Luci e ambiente della scena |
| [composite.js](composite.js) | Bloom, occlusione, distorsione e finitura |
| [temporal.js](temporal.js) | Tempi e pesi dei campioni di motion blur |
| [film-grain.js](film-grain.js) | Grana applicata dopo l’integrazione temporale |
| [procedural.js](procedural.js) | Primitive e funzioni per motion graphics 2D |
| [project-controls.js](project-controls.js) | Risolve preset e controlli nei parametri di rendering |

[Architettura completa](../../docs/ARCHITECTURE.md) · [Compositing](../../docs/COMPOSITING.md)
