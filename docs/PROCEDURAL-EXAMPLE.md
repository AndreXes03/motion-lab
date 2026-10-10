# Motion procedurale

[Apri l’animazione](https://andrexes03.github.io/motion-lab/examples/procedural-field.html) · [Sorgente e formule](https://github.com/AndreXes03/motion-lab/blob/main/examples/procedural-field.html#L22)

792 elementi passano dalla griglia alle orbite. Ogni elemento usa lo stesso tempo, con posizione, rotazione e scala calcolate in codice.

```js
phase = 2 * Math.PI * time / duration;
morph = smooth((1 - Math.cos(phase)) / 2);
position = mix(grid, orbit(time), morph);
```

Nel sorgente, `position()` calcola il movimento e `renderAt()` disegna il frame. `SETTINGS` regola righe, colonne, durata e deformazione. Cambi una regola e aggiorni tutti gli elementi.

L’HTML su GitHub mostra il codice. Per vedere l’animazione usa il link sopra.

Per rigenerare la GIF dal repository installato:

```sh
node examples/render-procedural.mjs
```

Il renderer verifica il loop e produce 108 frame: GIF 800 × 500, 18 fps, 6 secondi.
