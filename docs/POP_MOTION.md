# PLAY.EXE / Pop Motion

Demo originale di 10 secondi, 1920 × 1080, 30 fps, con musica procedurale a 120 BPM.
Riferimento di linguaggio visivo: https://x.com/higgsfield_ai/status/2108397633584947553
Non è una replica del filmato: usa una composizione, titoli e oggetti originali.

Apri il viewer e scegli **PLAY.EXE / Pop Motion**, oppure `http://127.0.0.1:4173/?scene=pop`.
I controlli regolano movimento camera (0 = inquadratura fissa, 1 = regia completa), accento degli sticker ed energia delle lettere. Salvataggio versioni, ricette ed export usano il normale flusso del viewer.

La sequenza ha quattro capitoli: player (0–2,5 s), città e BASS (2,5–5 s), MOVE (5–7,5 s), player finale (7,5–10 s). Le transizioni a iride coprono i cambi di scena. Il tempo automatico dell'audio usa il clock della scena a 120 BPM; cambiando manualmente il BPM si cambia solo l'audio.

## Strumenti riutilizzabili

- `src/engine/graphic-camera.js`: camera 2D con punto di interesse, zoom e roll interpolati nel tempo.
- `src/engine/beat-clock.js`: clock assoluto in battute, impulso e ingresso elastico, senza stato accumulato.
- `src/components/kinetic-type.js`: glifi estrusi con bevel, materiali fronte/lato separati, pivot individuali centrati e animazione sfalsata.
- `src/components/comic.js`: retino, sticker a stella, titoli con contorno, pannelli arrotondati e ticker.
- `src/scenes/pop-demo.js`: composizione ibrida Canvas2D + Three.js con renderer trasparente dedicato.

Il rendering è deterministico. Le dimensioni delle lettere sono reali geometrie 3D; le finestre laterali e la città sono grafiche 2D. Gli SFX seguono proxy dei gesti principali, non una simulazione fisica. La scena usa luci e materiali propri; i post-effetti 3D della scena BAX non vengono applicati, mentre grana e motion blur temporale restano disponibili. Non sono implementati import di font nel viewer, editor di parole o editor delle singole inquadrature nel viewer; le inquadrature sono editabili nella sequenza `SHOTS`.

```sh
node scripts/cli.mjs export --snapshot demo/pop-motion.project.json --out renders/pop-motion.mp4
node scripts/quality.mjs --scene pop --out renders/pop-quality.png --time 3.5
node scripts/test-pop.mjs
```

La ricetta riproduce il mix e il render consegnati. Il font Helvetiker Bold è distribuito con la propria licenza in `src/assets/fonts/LICENSE.txt`.

Fish-eye: lo shader `src/engine/graphic-lens.js` curva l’intera composizione dopo il disegno 2D/3D e prima della grana. Intensità 0–0,6, default 0,3. Zero bypassa il passaggio. Le viste diagnostiche isolate non vengono deformate.
