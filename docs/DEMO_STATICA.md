# Demo statica: landing e Studio

La stessa cartella può essere servita sul Mac o pubblicata su un host statico. Non richiede un provider specifico, credenziali o un identificativo di sito nel repository. La pubblicazione è un'operazione separata dalla build.

## Build e avvio locale

Dal checkout completo, con Node.js 22.12+ e dipendenze installate tramite `npm ci`:

```sh
npm run build:demo
npm run preview:demo
```

Apri `http://127.0.0.1:4196/` sul Mac; lo Studio è in `/studio/`. Usa HTTP, non aprire `index.html` come file. La preview ascolta soltanto su loopback e usa Vite per MIME, richieste HEAD e byte range dei video. Chiudila con Ctrl+C. Lo Studio completo locale resta disponibile con `npm run viewer`.

`build:demo` esegue la build con i controlli prebuild del progetto, `VITE_PUBLIC_DEMO=true` e base `/studio/`. Assembla `dist-demo/`, ignorata da Git, con la landing di `showcase/`, CSS/JavaScript esistenti e Studio. Un errore prima del completamento conserva il pacchetto precedente. Non scarica media, non esegue render e non pubblica nulla.

Per canonical e Open Graph della copia da pubblicare, passa l'origine effettiva senza percorsi o credenziali:

```sh
DEMO_SITE_ORIGIN=https://demo.example npm run build:demo
```

Se omessa, la copia non dichiara canonical né `og:url` e usa un poster relativo. Il file sorgente `showcase/index.html` mantiene i metadati di GitHub Pages. `build-info.json` e i meta tag della copia conservano commit, data build e stato dirty; il manifest aggiunge Node, modalità pubblica e inventario con dimensioni. Per una consegna riproducibile, costruisci dal commit approvato con checkout pulito e conserva l'intera cartella, compreso `build-info.json`.

## Film e asset

La galleria usa i cinque film già pubblici nella directory `https://andrexes03.github.io/motion-lab/demo/`: `pulse-1080.mp4`, `camera-1080.mp4`, `dot-1080.mp4`, `pop-motion.mp4`, `replay-1080.mp4`. La riproduzione richiede Internet e l'accesso a quell'host. Non sono film elaborati da un server della demo.

Puoi configurare una diversa directory HTTPS tramite `DEMO_GALLERY_MEDIA_BASE`; deve offrire gli stessi cinque nomi. Il valore viene inserito soltanto nella copia build, in un meta tag letto da `site.js`. Senza quel meta tag, lo showcase originale e GitHub Pages continuano a usare i propri media locali.

Nel pacchetto si copiano solo i video locali richiesti dai link dello Studio (`procedural.mp4`, `objects-in-play.mp4`, `pop-motion.mp4`), i tre contact sheet, i cinque poster e le immagini landing `ui-tools.jpg`, `ui-motion-groups.jpg`, `photorealism.jpg`. Non si copiano indiscriminatamente gli altri file di `demo/`. Ogni file deve essere **strettamente sotto 25 MiB**, altrimenti la build fallisce; un host può applicare ulteriori limiti complessivi. Il link alla still fotorealistica a piena risoluzione resta sul sito pubblico originale.

## Renderer e funzioni locali

Il sito esegue preview Three.js/Canvas. Nei browser compatibili lo Studio conserva l'export video implementato a 720p/1080p (MP4 quando l'encoder è disponibile, altrimenti WebM), PNG e ricette JSON. La registrazione avviene nel browser e richiede la scheda visibile; disponibilità e prestazioni dipendono dal dispositivo.

**Blender Cycles richiede Motion Lab eseguito sul computer locale con Blender installato.** L'adattatore attuale supporta PULSE; selezionare Cycles nella demo conserva la scelta nella ricetta ma non avvia Blender né un render server. Anche Mixed richiede input già renderizzati e un piano di compositing locale. Il sito statico non offre API progetto, FFmpeg, accesso ai file del computer o un backend di rendering cloud. Le versioni della demo restano nel browser.

## Verifiche e consegna

```sh
npm run build:demo
npm run test:demo
npm run preview:demo
# In un secondo terminale, con Chrome/Chromium disponibile:
npm run test:demo:browser
```

Per un browser diverso da Chrome standard macOS, usa `CHROME_PATH=/percorso/del/browser`; nel cloud segui l'adattatore esterno indicato dalle istruzioni dell'ambiente, senza copiarlo nella repo. Lo smoke controlla landing, cinque URL dei film, Studio procedural, seek deterministico, desktop/mobile, MIME/range video e assenza di chiamate API locali. Blocca i download dei film remoti: non certifica la loro riproduzione sull'host finale né la qualità di scene 3D. Gli screenshot sono in `outputs/sites-demo-review/`, ignorata da Git.

Per pubblicare, consegna **tutti i file di `dist-demo/` mantenendo i percorsi**, incluso `studio/`. Non pubblicare sorgenti, dipendenze o file dell'ambiente cloud. Dopo il caricamento verifica separatamente URL finale, asset, riproduzione remota e Studio. La build locale e la pubblicazione non equivalgono alla verifica del sito distribuito.
