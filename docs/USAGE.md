# Motion Lab

Studio locale in codice per scene 3D e motion graphics. La scena attiva è un film di **10 secondi, 1920 × 1080, 30 fps**, con radio, una B bold in alluminio e smalto blu con cover meccanica, e un giroscopio meccanico attivo. Il gyro usa cinematica deterministica, senza simulazione fisica. Camera grandangolare, passaggi rapidi con easing quintico, materiali procedurali e compositing condiviso tra viewer ed export. Nessun account cloud o chatbot. Le scene SIGNAL precedenti sono in `archive/`.

## Avvio e rendering

Servono Node.js, npm e Google Chrome su macOS. Da questa cartella:

```sh
npm ci
node scripts/cli.mjs viewer
```

Il viewer si apre su `http://127.0.0.1:4173/`. Le tre icone **Layout** offrono
**Bilanciato** (proprietà a destra), **Controlli estesi** (video piccolo sopra,
proprietà sotto) e **Video grande**. Trascina il separatore per ridimensionare
il pannello; funziona anche con le frecce da tastiera. Layout e larghezza del
pannello vengono conservati nel browser. Lo sfondo sfocato segue il frame corrente.

L’ingranaggio accanto a **Esporta** permette di scegliere risoluzione fino a 4K,
fps, MP4 / WebM / ProRes, bitrate e qualità del motion blur.
In **Finitura** si regolano grana e otturatore. Dettagli e limiti in [COMPOSITING.md](COMPOSITING.md).

Il pannello **Export** in basso mostra storico, errori, percorso del file e
azioni **Apri**, **Scarica**, **Finder**. I file sono salvati automaticamente
nella cartella **Download** dell’utente; lo storico rimane dopo il riavvio. Il pannello si può
chiudere per dare più spazio al lavoro. La CLI usa Google Chrome su macOS;
il percorso è impostato in `scripts/cli.mjs`.

```sh
node scripts/cli.mjs frame --time 2.8 --out renders/frame.png
node scripts/cli.mjs contact --samples 6 --out renders/bax-hard-contact.png
node scripts/cli.mjs preview --out renders/bax-hard-preview.mp4 --temporal-samples 8
node scripts/cli.mjs export --out renders/bax-hard-surface.mp4 --temporal-samples 16
node scripts/cli.mjs verify --time 2.8 --out renders/bax-hard-surface.mp4
```

`frame` valuta un istante preciso; `contact` compone sei frame di controllo;
`preview` renderizza a 960 × 540; `export` renderizza a 1920 × 1080 e codifica
un MP4 con FFmpeg. La CLI produce righe JSON con stato, percorso ed eventuali
errori. Per esportare solo una porzione, usa `--start` e `--end` su confini di
frame. `--width`, `--height` e `--parameters '{"display":"TEST"}'` consentono
varianti senza cambiare la scena salvata. `verify` controlla la stabilità dello
stesso frame dopo seek diversi e, con `--out`, i metadati del video.

## Lavorare nello studio

Scegli il progetto 3D o procedurale, un preset e i pochi controlli dedicati.
I pulsanti dei momenti portano direttamente alle inquadrature utili. Le opzioni
avanzate e le reference restano disponibili in un pannello separato.

**Salva versione** conserva le impostazioni complete in `project/versions/`;
puoi ripristinarle dal menu o trasferirle come ricetta JSON. **Crea preview** e
**Esporta MP4** avviano un render locale delle impostazioni correnti, con
avanzamento e collegamento al nuovo risultato. I link marcati “demo” indicano
invece i film già prodotti. È consentito un solo render alla volta.

Il render conserva parametri e impronta dei sorgenti: se i file di codice
cambiano durante il lavoro, segnala il risultato come non valido. Non crea
una copia isolata dei sorgenti; termina il render prima di modificarli.
La preview live è 960 × 540, l’export finale 1920 × 1080. Il compositing è
condiviso; il motion blur temporale viene calcolato durante l’export.

Per aggiungere controlli e momenti a una scena, consulta [STUDIO.md](STUDIO.md).

## Reference → ricetta → scena

Il pannello del viewer e la CLI raccolgono reference con ruolo **look**,
**camera** o **elements**. Accettano PNG, JPG, WebP, MP4 e MOV locali, oppure
link HTTP(S). I media locali sono copiati in `project/references/`; i link
restano link, senza download automatico. Le note spiegano all’agente cosa
osservare. Per un video, `sheet` estrae sei istanti utili alla revisione.

```sh
node scripts/reference.mjs add --file /percorso/reference.jpg --role look --note "ombre profonde e riflessi stretti"
node scripts/reference.mjs link --url https://example.com/reference --role camera --note "grandangolo ravvicinato"
node scripts/reference.mjs list
node scripts/reference.mjs sheet --id ref_XXXXXXXXXXXXXXX --out renders/reference-sheet.png
node scripts/look.mjs show
node scripts/look.mjs set --file /percorso/look-variant.json
```

L’agente deve **guardare** immagini e contact sheet, descrivere le decisioni
utili e tradurle in parametri e geometrie. L’app non deduce automaticamente un
look né crea un modello 3D da un’immagine. Per confrontare più look senza modificare la scena:

```sh
node scripts/brief.mjs
node scripts/review.mjs --looks project/looks/soft-lighting.json,project/looks/contrast-lighting.json --time 2.8 --out renders/looks.png
```

Il confronto conserva i frame singoli e produce un foglio affiancato.

`project/look.json` contiene la ricetta per camera, illuminazione, superficie,
post-produzione e intensità del movimento. I controlli del viewer applicano
una modifica in anteprima; **Salva aspetto** scrive il file e conserva la versione
precedente in `project/history/`. `project/motion.json` contiene tracce con
nomi stabili, come `camera.position`, `camera.target`,
`device.root.rotation` e `dial.rotor.rotation.z`: ogni valore dipende solo dal
tempo richiesto. Questi file sono leggibili e modificabili anche da Codex e
altri agenti tramite comandi locali. Vedi [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md)
per il ciclo di lavoro.

## Sorgenti e seconda scena

`src/config.js` centralizza durata, fps, dimensioni, palette e testi.
`src/components/` costruisce il dispositivo con geometrie e texture
procedurali; `src/scenes/bax.js` imposta il layout e `src/engine/studio.js` le luci; `src/engine/`
applica le tracce, renderizza Three.js e compone gli overlay 2D. `src/viewer/`
gestisce l’interfaccia; `scripts/` contiene CLI ed export.

Per una seconda scena crea un modulo in `src/scenes/` che esporti
`createScene(renderer, config)`, poi registra il modulo nella selezione di scena in
`src/engine/runtime.js` e scegli il suo identificatore in `src/config.js`. Crea nuovi `project/look.json` e
`project/motion.json` coerenti con gli oggetti della scena, aggiorna
`src/config.js` e controlla l'anteprima. Mantieni il calcolo del frame come
funzione assoluta del tempo, anche andando all'indietro nella timeline.

## Limiti

Il film usa vere geometrie 3D, prospettiva, materiali PBR, riflessi da luci
procedurali, texture procedurali e overlay 2D. Sono presenti antialiasing WebGL,
un pass per bloom regolabile e lieve aberrazione cromatica. Le alte luci vengono limitate prima del bloom, così il bagliore non cancella i materiali.
La ricetta salvata imposta `shutterAngle` a 270°. `--temporal-samples` accetta
da 1 a 16 campioni, mediati in luce lineare nell'intervallo dell'otturatore;
gli esempi usano 8 campioni per la preview e 16 per l'export finale. È
appropriato qui perché la ripresa è continua. Non usarlo attraverso tagli
netti. La profondità di campo non è implementata. Il video è muto: `audio` è
predisposto nella configurazione, ma mux e sincronizzazione audio non sono
ancora implementati.

Il rendering deterministico è verificabile nella stessa macchina e versione
del browser; GPU e driver diversi possono cambiare alcuni pixel. La scena BAX contiene tre oggetti costruiti proceduralmente e un display LED. Import glTF, inserimento
di prodotti arbitrari, ricostruzione da immagini e profondità di campo sono
sviluppi successivi.

Per condividere il progetto, includi sorgenti, `project/`, lockfile e
documentazione, escludendo `node_modules` e cartelle temporanee. Il binario
FFmpeg locale installato da `ffmpeg-static` usa `--enable-nonfree` e non va
ridistribuito. Fonti e avvisi in [THIRD_PARTY.md](../THIRD_PARTY.md) e `licenses/`.

## Schemi luci e controlli

Il menu **Schema luci** offre Studio morbido, Contrasto deciso, Taglio laterale e Bordo freddo. Ogni scelta modifica posizione, direzione, colore e intensità delle luci, mantenendo camera e compositing. I testi sotto i controlli ne spiegano l’effetto. Una modifica manuale delle luci passa a Personalizzato; **Salva aspetto** conserva il risultato. I preset editabili sono in `project/lighting-presets.json`.

Ogni render scrive un file `.project.json` accanto all’output con la copia delle impostazioni utilizzate. Il rendering non riceve aggiornamenti live dal viewer. Per replicare lo stesso look in un frame, aggiungi `--snapshot renders/bax-hard-surface.mp4.project.json`. La verifica usa automaticamente la copia associata al video.

## Revisione modelli e lente

Il menu **Controllo** confronta immagine finale, immagine senza effetti, soli volumi e normali. La CLI accetta `--parameters '{"inspect":{"object":"bax.emblem","yaw":20},"review":"clean"}'` per isolare un modello. `node scripts/quality.mjs --out renders/quality-board.png` genera la tavola materiali/volumi dei tre oggetti, senza dichiarare automaticamente un'approvazione visiva.

La ricetta include **Curvatura della lente** (distorsione a barilotto con overscan), **Frange di colore**, **Vignettatura** e **Ombre nelle giunzioni** (GTAO). Le frange sono espresse in pixel Full HD, quindi la preview mantiene la stessa intensità visiva dell'export. Il compositing usa HDR lineare, bloom, un solo OutputPass per tone mapping/sRGB e poi trattamento ottico. La media temporale decodifica i campioni sRGB prima di mediarli. GTAO usa rumore fisso riproducibile. Riferimenti tecnici: [OutputPass](https://threejs.org/docs/pages/OutputPass.html), [gestione colore](https://threejs.org/manual/pages/color-management.html), [materiali fisici](https://threejs.org/docs/pages/MeshPhysicalMaterial.html).

La direzione gonfiabile/portachiavi è conservata nei componenti precedenti e nei render BAX v1. La B attiva combina alluminio spazzolato, smalto blu e cover meccanica; il giroscopio usa cinematica deterministica, senza simulazione fisica. Il wordmark viene isolato a caricamento dallo screenshot fornito dall’utente; `brandReady` è atteso prima di creare le scene.


## Motion graphics procedurale

Nel viewer scegli **Motion · Grafica procedurale**: titolo, colore accento e densità si modificano senza montare clip. Play/pausa e cursore servono solo per ispezionare il tempo. La scena 3D BAX resta selezionabile.

```sh
node scripts/cli.mjs viewer --scene procedural
node scripts/cli.mjs frame --scene procedural --time 4 --out renders/procedural-frame.png
node scripts/cli.mjs contact --scene procedural --samples 9 --out renders/procedural-contact.png
node scripts/cli.mjs preview --scene procedural --temporal-samples 8 --out renders/procedural-preview.mp4
node scripts/cli.mjs export --scene procedural --temporal-samples 8 --out renders/procedural-final.mp4
node scripts/cli.mjs verify --scene procedural --time 4.2 --out renders/procedural-final.mp4
```

Per una variazione dell'agente: `--parameters '{"graphics":{"title":"PLAY","accent":"#ef5533","density":12,"speed":1.2}}'`. I parametri sono conservati nel file `.project.json` del render; le modifiche nei controlli del viewer sono temporanee. **↓ Ricetta** scarica una configurazione riutilizzabile con `--snapshot /percorso/procedural.project.json`; in alternativa passa gli stessi parametri alla CLI.

API e creazione di una seconda composizione: [PROCEDURAL.md](PROCEDURAL.md). Il motore Canvas2D è locale e non richiede nuove dipendenze. Questa modalità gestisce grafica vettoriale e tipografia procedurale; import video, scontorno e collegamento di generazioni Magnific restano fuori da questa implementazione.
