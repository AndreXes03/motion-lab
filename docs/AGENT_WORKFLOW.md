# Workflow con agenti

L’agente modifica codice e JSON. Le reference guidano le scelte visive; non vengono convertite automaticamente in scene.

1. **Leggi il brief e le reference.** Apri immagini e video; annota camera, luci, palette e movimento da mantenere.
2. **Modifica la scena.** Look in `project/look.json`, tracce in `project/motion.json`, geometrie in `src/components/` e composizioni in `src/scenes/`. Usa tempo assoluto e random con seed.
3. **Confronta i frame.** Stesso istante per ogni variante, poi un contact sheet per controllare clipping, riflessi, testo e passaggi camera.
4. **Guarda una preview intera.** Correggi movimento e transizioni. Se attivi l’audio, ascolta il mix senza coprire il movimento con troppi accenti.
5. **Esporta e verifica.** Controlla dimensioni, durata, fps e seek; apri il video finale. Distingui validazione tecnica e approvazione creativa.

```sh
npm run contact -- --samples 6 --out renders/contact.png
npm run preview -- --sound on --out renders/preview.mp4
npm run export -- --sound on --out renders/film.mp4
npm run verify -- --out renders/film.mp4 --time 2.8
```

## Audio

`parameters.sound` salva on/off, volumi, densità, timbri, seed e BPM. `--sound off` esclude l’audio.

Per nuovi meccanismi 3D assegna profili in `userData.sound`. Per nuove scene 2D esporta `nodesAt` e `render` dalla stessa costruzione del grafo: il sound design segue le forme realmente animate. `sound:false` esclude un nodo. [Controlli e limiti](SOUND_DESIGN.md).

Conserva sorgenti, ricette e tracce. Reference personali, versioni locali, render intermedi e `node_modules` restano fuori dal repository pubblico.
