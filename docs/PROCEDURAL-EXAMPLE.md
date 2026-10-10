# Esempio procedurale

[Animazione live](https://andrexes03.github.io/motion-lab/examples/procedural-field.html) · [Scena e formule](../src/scenes/procedural-demo.js) · [Video con audio](https://andrexes03.github.io/motion-lab/)

Flussi, toro parametrico, griglia/spirale, onde e tunnel sono costruiti in codice. Tempo, seed e parametri determinano ogni frame; non servono keyframe per ogni elemento.

La preview live e la [GIF](../demo/procedural-showcase.gif) mostrano solo animazione e logo personale. Il [film 1080p](../demo/procedural-techno.mp4) include il montaggio, techno originale a 132 BPM e SFX modulari.

Per modificare la scena: [sorgente](../src/scenes/procedural-demo.js) e [parametri](../project/graphics.json). Per rigenerare la GIF:

```sh
node examples/render-procedural.mjs
```

La GIF è muta. I BPM manuali cambiano pulsazioni e musica del film; i tagli restano ai tempi editoriali della demo. [Motore Canvas2D](PROCEDURAL.md)
