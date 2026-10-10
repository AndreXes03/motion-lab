# Motion graphics procedurale

Il motore Canvas2D calcola ogni frame dal tempo assoluto. Posizioni, rotazioni, scale e maschere possono essere funzioni: una regola muove centinaia di elementi, anche dopo un seek.

La [scena demo](../src/scenes/procedural-demo.js) combina 55 flussi, 60 anelli di un toro parametrico, 720 elementi griglia/spirale, 100 onde d’interferenza e un tunnel di 26 cornici. [Seed, densità, velocità e colore](../project/graphics.json) sono modificabili.

## Scrivere una scena

```js
const nodes = Array.from({length: 100}, (_, i) => ({
  id: `dot.${i}`, type: 'circle', radius: 8,
  x: t => 960 + Math.cos(t + i * .1) * 350,
  y: t => 540 + Math.sin(t + i * .1) * 350,
  fill: '#c2ff38'
}));
renderProcedural(ctx, time, {width: 1920, height: 1080, nodes, seed: 42});
```

Nodi disponibili: gruppi, cerchi, rettangoli, testi e path; supportano trasformazioni, opacità, blend e clip. Per gli SFX, `nodesAt(time, parameters)` restituisce lo stesso grafo usato nel disegno; `sound:false` esclude un nodo. `clear:false` permette overlay su un frame esistente.

La demo usa techno a 132 BPM e tagli ogni quattro beat. I BPM manuali cambiano musica e pulsazioni, mentre i tagli mantengono i tempi editoriali originali. L’export evita il motion blur tra capitoli.

## Verifica

```sh
node scripts/test-procedural.mjs
node scripts/test-procedural-showcase.mjs
```

Il rendering è ripetibile nello stesso ambiente; font e browser diversi possono cambiare i pixel. Il 2D non importa footage e non applica gli effetti ottici del renderer 3D. [Esempio live](PROCEDURAL-EXAMPLE.md) · [Sound design](SOUND_DESIGN.md)
