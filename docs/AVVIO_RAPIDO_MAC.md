# Avvio rapido sul Mac

**Motion Lab.app è un launcher locale**, non un'app standalone: apre lo Studio nel browser predefinito usando la copia del progetto e Node già installati sul Mac. Non incorpora un browser, non cambia il motore e non rende più veloce il rendering. Il vantaggio concreto è un'icona da trascinare nel Dock, avvio senza Terminale e riuso della stessa istanza senza moltiplicare i server.

## Installazione

Con Node.js **22.12 o successivo** e dipendenze già installate (`npm ci`), dalla repo:

```sh
npm run install:mac
```

L'installer crea `~/Applications/Motion Lab.app`, con eseguibile shell, una copia dell'helper revisionato e i percorsi assoluti di Node e della repo. Non sovrascrive un'app esistente. Aprila dal Finder e, se vuoi, trascinala nel Dock. Nessun Terminale si apre al doppio clic; gli errori di avvio vengono mostrati in una finestra e registrati nei log.

Per installare prima del merge, conserva **insieme** i due file revisionati `launch-studio.mjs` e `install-mac-launcher.mjs` in una cartella strumenti esterna alla repo, poi:

```sh
node "/percorso/strumenti/install-mac-launcher.mjs" --repo "/percorso/assoluto/motion-lab"
```

Destinazione alternativa: aggiungi `--destination "/percorso/assoluto/Motion Lab.app"`. Nei test Linux è obbligatoria: non si scrive la cartella Applications del sistema. L'installer copia l'helper dalla propria cartella, quindi non occorre scaricare né eseguire codice remoto non revisionato. Se cambi percorso di Node, repo o bundle, reinstalla il launcher scegliendo una nuova destinazione o rimuovendo manualmente solo il vecchio bundle.

## Uso e aggiornamenti

L'avvio usa Vite locale su `127.0.0.1:4173`, apre il browser predefinito e riusa l'istanza solo se il controllo di salute conferma repository, processo e identificativo del launcher. Se la porta appartiene a un altro servizio (anche uno Studio avviato con il vecchio comando), si ferma con un messaggio: chiudi quel servizio o usa una porta diversa dalla CLI. Non termina processi estranei.

**Non esegue `git fetch`, aggiornamenti né `npm ci`.** L'aggiornamento resta separato: usa l'aggiornatore già predisposto (o `npm run aggiorna` quando disponibile nella tua main), poi riapri Studio. Dopo modifiche alle dipendenze installale esplicitamente. Per sostituire dipendenze, spostare la repo o aggiornare Node, ferma prima il servizio.

Il server è detached: chiudere una scheda o il launcher non lo ferma. Non si installano servizi di sistema, login item o avvii pianificati. Per controllarlo o fermarlo:

```sh
npm run studio:status
npm run studio:stop
# Prova senza browser, anche in test:
npm run studio:launch -- --no-open
```

Gli helper esterni supportano gli stessi comandi: `node /strumenti/launch-studio.mjs status --repo /repo/assoluta` oppure `stop`. Per una porta diversa, usa `--port 4194` coerentemente su start/status/stop. Lo stato, il lock e i log stanno in `.motion-cache/launcher-PORT.*`; il log dell'icona è `.motion-cache/launcher-app.log`. Se una chiusura forzata lascia un lock, verifica che non sia ancora in corso un avvio prima di rimuovere manualmente quel solo lock. Non pulire la cache mentre il servizio è attivo.

Questo launcher non cambia i limiti dei renderer: Cycles continua a richiedere Blender locale e una scena supportata. Un'eventuale app desktop completa potrebbe offrire gestione nativa di finestre, file e distribuzione del runtime, ma richiederebbe lavoro separato: qui non si implementano Electron, Tauri o una riscrittura del motore.

## Verifiche

`npm run test:launcher` verifica lifecycle e installer con server finti su localhost, doppio avvio concorrente e percorsi con spazi/apostrofi. Non apre il browser, non interroga GitHub e non esegue render 3D. La validazione del doppio clic Finder, del dialogo macOS e del browser predefinito va completata sul Mac. Prima di un merge, questi comandi npm potrebbero non essere ancora presenti nella copia locale: usa i due helper esterni revisionati.
