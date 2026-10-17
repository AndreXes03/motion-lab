# Plugin locale Motion Lab MCP · beta v1

Il plugin collega un agente locale Codex o Claude allo Studio e ai renderer **del tuo computer**. È tool-only MCP su stdio: nessun widget, endpoint `/mcp` HTTP, tunnel, API key o render del Mac dal sito pubblico. Node.js 22.12+, dipendenze del plugin e della repo, e Chrome per il renderer locale sono prerequisiti. Cycles richiede anche Blender e una scena supportata (oggi PULSE).

## Installazione revisionata, anche prima del merge

La repo di lavoro può avere modifiche locali: il plugin le segnala e non le pulisce, aggiorna o trasferisce. Conserva una copia revisionata dell'intera cartella `plugins/motion-lab` in una cartella strumenti esterna alla repo sporca, installa soltanto le sue dipendenze e genera snippet in una **nuova** cartella:

```sh
npm ci --prefix "/strumenti/motion-lab"
node "/strumenti/motion-lab/scripts/configure.mjs" \
  --repo "/percorso/assoluto/motion-lab" --port 4198 \
  --destination "/strumenti/config-motion-lab-nuova"
```

Il configuratore usa il Node assoluto corrente e percorsi assoluti. Genera `mcp.json`, uno snippet `claude-desktop.json` e comandi per Codex/Claude Code, senza modificare configurazioni dei client o marketplace. Non installa il plugin nel sistema e non sovrascrive una destinazione esistente. Per usare un runtime di prova separato, scegli per esempio 4199 e una copia pulita della repo.

Codex CLI, sostituendo i percorsi con quelli verificati (il file `codex-command.txt` contiene il comando esatto):

```sh
codex mcp add motion-lab -- /percorso/assoluto/node \
  /strumenti/motion-lab/server.mjs --repo /repo/assoluta --port 4198
```

Claude Desktop: unisci manualmente la sola voce `mcpServers.motion-lab` dello snippet alla configurazione esistente, preservando gli altri server, poi riavvia il client. Claude Code, se installato, può usare il comando generato `claude mcp add --transport stdio motion-lab -- ...`. Non viene installata alcuna CLI. Non registrare contemporaneamente lo stesso server via plugin e via configurazione MCP nello stesso client.

Per un host con supporto plugin, la cartella include `plugin.json`/`mcp.json` e metadata `.codex-plugin`/`.claude-plugin`. Sono **template**: il percorso `/ABSOLUTE/PATH/TO/motion-lab` va configurato nella copia locale. La variabile portable è `${PLUGIN_ROOT}`, quella di Claude è `${CLAUDE_PLUGIN_ROOT}`. Il configuratore genera un `mcp.json` assoluto utilizzabile quando la sintassi del marketplace richiede localizzazione. ID e credenziali del marketplace non entrano nella repo.

## Sei tool, versioni sempre esplicite

| Tool | Uso e risultato |
| --- | --- |
| `get_project` | Senza scena elenca scene, versioni native e job. Con `scene` e senza `versionId`, crea una nuova versione **Original** usando i resolver reali e restituisce parametri, catalogo, valori, `versionId` e `revision`. Con entrambi legge esattamente quella versione. |
| `set_parameters` | Richiede `scene`, `baseVersionId`, `revision`, `patches:[{id,value}]`. Usa soltanto ID reali del catalogo e validatori della repo. Salva una nuova versione nativa con nome opzionale; la base resta immutata. Contrasto composito usa il resolver del progetto. |
| `preview_frame` | Richiede scena/versione/revisione, `requestId` e tempo. Render nativo PNG Three.js 384×216, un campione. Attende circa 6,5 secondi dopo l'invio, poi restituisce il job asincrono se non pronto. Nessun browser si apre. |
| `render_local` | Richiede gli stessi identificativi e `kind: frame|preview|export`. Il renderer opzionale passa dalla policy nativa; altrimenti resta quello salvato. Usa API/lock/queue di Studio, senza lanciare un secondo renderer indipendente. |
| `get_job` | Richiede `requestId`. Restituisce stato, errori, file originale e, per un PNG piccolo pronto, un blocco immagine MCP reale. Non rilancia render. |
| `open_studio` | Apertura browser esplicita su macOS; `open:false` restituisce l'indirizzo senza aprirlo. La versione va selezionata manualmente in Versions. |

Esempio: chiedi Original della scena `procedural`, conserva il `versionId` e la `revision` restituiti, poi modifica `speed` con `set_parameters`. Usa **il nuovo ID e la nuova revisione** per l'anteprima. Due agenti possono partire dalla stessa base e creare versioni distinte senza sovrascriversi. Revisioni non corrispondenti, ID sconosciuti e valori fuori dai limiti vengono rifiutati.

Il ponte con la UI è manuale: salva una versione nel Viewer, richiedila con `get_project`, modifica una sua copia e seleziona la nuova versione in **Versions**. Lo stato non salvato del browser non è leggibile né modificato automaticamente. Il link `panel=versions` non carica un ID e non sincronizza una sessione già aperta. Per il contrasto composito il plugin applica le differenze del resolver nativo su un riferimento authored stabile, mantenendo gli offset manuali: stesso valore idempotente e A→B→A sono testati su versioni. Eventuali limiti delle luci restano verificati dal validatore nativo; una combinazione fuori limite viene rifiutata, senza clamp nascosti o versione parzialmente salvata.

I render video nativi della API attuale usano **l'intera durata authored**; v1 non inventa `start/end`. Impostazioni predefinite piccole e un campione; limiti del plugin 1920×1080, schema impostazioni esplicito e ulteriore validazione nativa. Preview usa sempre Three.js, anche se la ricetta raccomanda Cycles. Le scelte finali Cycles/Mixed vengono validate dall'API locale: selezionarle non dimostra Blender funzionante né prepara automaticamente i layer Mixed.

## Check aggiornamenti a ogni chiamata

Il dispatcher usa `Server`/`CallToolRequestSchema` dell'SDK ufficiale e applica Zod **dopo** il check, coprendo anche tool sconosciuti e input di tool non validi. Richieste JSON-RPC/MCP strutturalmente malformate sono gestite dal protocollo SDK, non sono chiamate tool valide.

Ogni `tools/call` legge branch, commit e stato dirty (anche untracked/submodule) ed esegue un nuovo `git ls-remote origin refs/heads/main`, con timeout remoto di 3 secondi e controlli locali limitati. Il risultato contiene `updates.checkedAt`, `commit`, `branch`, `dirty`, `remoteCommit`, `available`, `state` (`current|available|offline|unknown`) e verifica di origin. Il check non è in cache. Origin deve identificare `AndreXes03/motion-lab` su GitHub; con origin diverso il check remoto viene omesso e segnalato come `unknown`. Non vengono stampati URL con credenziali.

Solo **main è release**: PR aperte non fanno risultare un aggiornamento. `available` indica main diverso e non noto come già incluso nel checkout. Senza fetch l'oggetto/ancestry remoto può mancare: è un invito alla revisione, non una garanzia di fast-forward. Offline, autenticazione negata o timeout non bloccano i tool locali. Non vengono eseguiti fetch/pull, npm/install, stash/reset o aggiornamenti automatici.

## Persistenza, retry e limiti

Versioni native: `project/versions/` e UI Versions; nessuna scrittura di parametri tracked. Richieste del plugin: `.motion-cache/mcp-plugin/requests/`, con ID file derivati da hash. Non cancellare questi record se vuoi mantenere la deduplicazione. Le versioni sono limitate a 96 KiB, JSON dei tool a 128 KiB e risposte API a 2 MiB; cataloghi e liste sono limitati. Le immagini inline sono PNG fino a 2 MiB e 1024×1024; altrimenti resta il link/path al file originale. Non vengono accettati percorsi di output arbitrari o file da leggere.

**Ogni nuova intenzione di render richiede un `requestId` nuovo.** Ripetere gli stessi ID/input restituisce lo stesso job, anche dopo riavvio del server MCP. Input diversi con lo stesso ID sono rifiutati. Il record viene creato prima della POST. Se la risposta si perde o il processo termina fra invio e salvataggio del job, lo stato resta `submitting/submission_unknown`: non viene inviata una seconda POST. Controlla i job in Studio prima di scegliere un nuovo ID. Una risposta API 4xx esplicita è `rejected`, con `isError:true`; il retry identico resta rifiutato senza altra POST.

Il servizio Vite è soltanto loopback. Il launcher copiato nel plugin verifica root reale, PID e identificativo dell'istanza prima del riuso; una porta estranea viene rifiutata. Non apre browser a ogni chiamata. Chiudere il client MCP non ferma Studio: usa `node /strumenti/motion-lab/runtime/launch-studio.mjs stop --repo /repo/assoluta --port 4198` quando opportuno. Non fermare una sessione utilizzata da altri agenti. Dopo cambi alle funzioni condivise riavvia MCP e, quando opportuno, Studio: gli import Node del runtime sono legati al processo. Incompatibilità della repo vengono segnalate; il plugin non applica patch a UI o engine.

## Evidenze v1

`npm test --prefix plugins/motion-lab` usa il client MCP ufficiale per initialize/list/call, API localhost simulate e le vere funzioni di normalizzazione/catalogo del checkout. Copre errori/offline/timeout/origin, nessuna scrittura su input invalido, base immutabile, conservazione dei dati estranei alla patch, contrasto idempotente e reversibile, PNG, job async, retry dopo riavvio, risposta persa e rifiuto API esplicito. GitHub non viene interrogato nei test.

Compatibilità verificata anche con `main` a `502de6cee0490b3f7c609d1b4556388f1636ac95`: quattro gruppi di test MCP passati contro le sue funzioni runtime in una copia temporanea, senza modificare main o riscrivere la UI. Il branch del plugin resta basato sul launcher `72ed7c8`, per la PR in stack. La chat di installazione Mac ha inoltre riportato handshake, patch immutabili, PNG inline e MP4 384×240 a 24 fps/240 frame riusciti sulla prima revisione `a997739`.

Prova cloud reale del 17 ottobre 2026: PNG procedural 384×216 restituito come immagine MCP e MP4 nativo 320×240, 24 fps, 240 frame/10 secondi, decodificato integralmente da FFmpeg. File originali conservati nei Downloads della macchina di prova, non nel plugin. Il test Linux ha usato un override browser esterno e non distribuito; sul Mac si usa Chrome locale. Nessuna suite browser completa, render 3D software o prova Blender/Cycles è stata eseguita. Installazione/abilitazione native Codex e Claude sul Mac e uso della UI restano verifiche della macchina locale; i test stdio non le sostituiscono.
