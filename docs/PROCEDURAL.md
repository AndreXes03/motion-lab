# Motion graphics procedurale

`src/engine/procedural.js` disegna un frame Canvas2D a un tempo assoluto. Non contiene timeline editor, timer, playback state o casualità non inizializzata. La scena specifica resta in `src/scenes/procedural-demo.js`; il viewer e la CLI possono chiederle qualunque frame, anche dopo un seek all’indietro.

```js
import {renderProcedural, progress, stagger, oscillate, seededNoise, repeat} from './src/engine/procedural.js';

const nodes = [
  {id: 'bg', type: 'rect', width: 1920, height: 1080, fill: '#1646f5'},
  {id: 'title', type: 'text', x: 960, y: 540, text: 'MOTION',
   font: '900 240px Arial, sans-serif', align: 'center', baseline: 'middle',
   fill: '#fff8ec', opacity: t => progress(t, .2, 1, 'quint')},
  ...repeat(12, i => ({id: `dot.${i}`, type: 'circle', x: 160 + i * 140, y: 820,
    radius: 12, fill: '#ff5a24', opacity: t => stagger(t, i, {start: .6, step: .08, duration: .4})}))
];
renderProcedural(ctx, 1.25, {width: 1920, height: 1080, nodes, seed: 42});
```

Ogni nodo richiede un `id` unico e stabile e un `type`: `group`, `circle`, `rect`, `text` o `path`. Le coordinate sono pixel logici con origine in alto a sinistra. `x` e `y` traslano il nodo: il cerchio è centrato su `(0,0)` locale, il rettangolo parte da `(0,0)`, il testo usa la baseline scelta. I nodi possono avere `children`; le trasformazioni del genitore si applicano ai figli. Campi comuni: `x`, `y`, `rotation` (radianti), `scaleX`, `scaleY`, `opacity` (0–1), `blend` (modalità Canvas2D supportata), `fill`, `stroke`, `lineWidth`, `dash`, `dashOffset`, `clip`. Con `stroke` e senza `fill` il nodo è solo contorno; `fill:null` lo rende esplicito. Il motore usa `save`/`restore`, rispettando la trasformazione già impostata dal chiamante per preview a risoluzione ridotta.

Geometrie: `circle` usa `radius`; `rect` usa `width`, `height`, `cornerRadius` opzionale; `text` usa `text`, `font`, `align`, `baseline`, `maxWidth`; `path` usa `commands` con `['M',x,y]`, `['L',x,y]`, `['Q',cx,cy,x,y]`, `['C',c1x,c1y,c2x,c2y,x,y]`, `['A',cx,cy,r,start,end]` e `['Z']`. `clip` accetta `{type:'rect',width,height}`, `{type:'circle',radius}` o `{type:'path',commands}` nelle coordinate locali e maschera il nodo e i suoi figli. `fill:null` lascia solo lo stroke. `fillRule` può essere `nonzero` o `evenodd`.

Le proprietà possono essere funzioni `(timeSeconds, context) => valore`; `context` contiene `{width,height,seed,noise}`. `noise(x,y,z)` è deterministico per `seed` e coordinate. `progress(t,start,end,easing)` produce 0–1 con easing; i nomi includono `linear`, `cubic`, `quint`, `inCubic`, `outCubic`, `inOutCubic`, `inOutSine`, `outExpo`, `outBack`. `stagger(t,index,{start,step,duration,easing})` sfasa le entrate. `oscillate(t,{frequency,amplitude,phase,offset,wave})` usa secondi e Hz, con `sine`, `triangle`, `saw`, `square`; `phase` è in cicli. `repeat(count,factory)` crea nodi con indici stabili. Per usare una texture animata, legare il rumore a coordinate e tempo assoluto, ad esempio `noise(i*.2, 0, t*.5)`.

`renderProcedural` cancella il frame logico per default e restituisce `{time,width,height,nodeCount,seed,clear}`. Con `clear:false` disegna i nodi sopra un frame già presente, utile per overlay su una scena 3D. `dash:[6,4]` e `dashOffset` controllano tratti e animazione delle linee. Segnala errori chiari per ID duplicati/mancanti, tipi o clip/blend non supportati, path malformati, dimensioni e numeri non finiti. L’output resta deterministico a parità di codice, parametri, font e ambiente grafico; pixel identici tra browser o GPU differenti non sono garantiti.

## Una seconda composizione

Duplica `src/scenes/procedural-demo.js`, cambia gli ID e la funzione che costruisce i nodi, quindi importa la nuova factory in `src/engine/runtime.js` al posto di `createProceduralDemo` per usare gli stessi controlli e comandi `--scene procedural`. I parametri della demo sono in `project/graphics.json`; l'agente può modificare palette, seed, densità e tempi dei capitoli senza introdurre tracce. Per gli overlay richiama `renderProcedural(ctx,t,{width:1920,height:1080,nodes,clear:false})` dal `drawOverlay` di una scena 3D.

## Verifica della versione consegnata

`node scripts/test-procedural.mjs`: 12 controlli superati su Canvas reale, inclusi seek, seed, maschere, ridimensionamento, overlay e input invalidi. Build riuscita. Ispezionati contact sheet a 9 tempi e 30 frame della preview. Viewer controllato per cambio scena 2D/3D, testo, scrubbing e reset. Finale verificato: 1920×1080, 30 fps, 10 s, 300 frame. Il frame a 6,4 s con 8 campioni temporali ha hash identico dopo seek differenti. Evidenze in `renders/procedural-tests.json` e `renders/procedural-verification.jsonl`.

Questa prima modalità non importa footage e non include un editor di maschere manuale o un collegamento Magnific. Non applica gli effetti ottici del renderer 3D alle forme 2D; il motion blur temporale è disponibile nell'export. I font sono quelli installati nel sistema, quindi la resa tipografica può cambiare su altre macchine.
