# Workflow per un agente

Questo progetto si pilota modificando codice e JSON ed eseguendo comandi
locali. Le reference orientano il giudizio visivo dell'agente: non esiste un
motore che le traduca automaticamente in scene.

1. **Leggi brief e reference.** Esamina `project/references.json`, apri le
   immagini locali e crea un contact sheet per ciascun video con
   `node scripts/reference.mjs sheet --id ID --out renders/ref-ID.png`. Apri
   anche i link accessibili. Distingui ciò che è effettivamente visibile da
   ciò che il brief chiede di aggiungere.
2. **Annota decisioni specifiche.** Per ogni reference registra ruolo,
   inquadratura/lunghezza focale apparente, direzione e rapporto delle luci,
   caratteristiche delle superfici, palette, movimento ed elementi da
   preservare. Riconcilia reference in conflitto prima di cambiare la scena.
3. **Scrivi ricetta e tracce.** Modifica `project/look.json` per camera,
   lighting, surface, post e `motion.amount`. Modifica `project/motion.json`
   per le proprietà con ID stabili. Se servono forme o dettagli nuovi, cambia
   `src/components/` o `src/scenes/`. Ogni traccia deve dipendere dal tempo
   assoluto; non usare timer, integrazione dipendente dal playback o random
   non inizializzato. Usa `node scripts/look.mjs set --file ...` per salvare
   ricette complete con una copia precedente in `project/history/`.
4. **Confronta look in fermo.** Renderizza lo stesso istante per le varianti
   e guardalo alla dimensione utile. Valuta composizione, silhouette,
   riflessi, contrasto, testo e dettagli contro le reference. Usa
   `node scripts/review.mjs --looks a.json,b.json --time 2.8 --out renders/looks.png`. Scegli la ricetta più fedele al brief,
   poi salva.
5. **Controlla almeno sei frame.** Crea
   `node scripts/cli.mjs contact --samples 6 --out renders/contact.png`.
   Apri il file e correggi clipping, geometrie, testo, continuità dei
   riflessi e passaggi della camera. Ripeti il foglio dopo modifiche
   sostanziali.
6. **Controlla il movimento.** Esporta
   `node scripts/cli.mjs preview --out renders/preview.mp4`, guardalo per
   intero e correggi scatti o transizioni deboli. Usa campioni temporali
   solo su riprese continue e quando il blur migliora davvero il movimento.
7. **Esporta e verifica.** Esegui
   `node scripts/cli.mjs export --out renders/bax-film.mp4` e
   `node scripts/cli.mjs verify --out renders/bax-film.mp4 --time 2.8`.
   Controlla anche un seek all'indietro nel viewer e apri il video finale.
   Riporta durata, dimensioni, fps, numero di frame e limiti effettivamente
   verificati.

Mantieni il film editabile: salva ricette, tracce, sorgenti e reference nel
progetto. Non includere `node_modules` nel pacchetto condiviso.
