# Framevolve · Download macOS beta

La landing offre **Download** con tre ZIP piccoli: Studio locale, Studio + Codex, Studio + Claude Desktop. La demo online nel browser rimane separata e non richiede installer. La .app è un launcher del servizio Vite locale e apre Studio nel browser; non è un'app standalone. Nessun pacchetto Windows/Linux.

## Uso sul Mac

Servono macOS, Git/Command Line Tools, **Node.js ≥22.12**, npm e Google Chrome in /Applications. Installa questi prerequisiti separatamente; non vengono scaricati dal bootstrap. Serve Internet per GitHub/npm e per gli script di installazione delle dipendenze native. Codex richiede una CLI con plugin marketplace add e plugin add (supportata anche la CLI inclusa in ChatGPT); Claude richiede Claude Desktop già installato. Cycles richiede Blender locale e una scena supportata, attualmente PULSE.

Estrai l'intero ZIP, leggi LEGGIMI.txt, SOURCE.json e lo script, poi apri **Installa Motion Lab.command**. È una beta non firmata/notarizzata: può richiedere una conferma macOS; non disabilita Gatekeeper. Il Terminale mostra l'esito e resta aperto per leggere gli errori. Dopo il successo apri ~/Applications/Motion Lab studio.app, Motion Lab codex.app o Motion Lab claude.app.

Ogni variante riserva una cartella **nuova** ~/Applications/Motion Lab/VARIANTE e crea repository/, eventuale plugin/, snippet e installation.json. Se trova una cartella, app o registrazione Motion Lab esistente, si ferma senza sostituirla. Non usa checkout dell'utente, reset/stash/pull/clean, aggiornamenti automatici né adattatori Linux. La sorgente è fissata a **eebc318c524a89cd0fa0f7ce448d7296f21a7a76**, che include main **3ad9d58031a2f83a55ebd3904682eb8cf7899dc5** (debrand, scena nativa objects, controlli e screenshot aggiornati), launcher e branding plugin **0.1.1** dal commit autorizzato **4252b59ad6a89a76e332fc7c491027dc38844f12**. Nome visibile Framevolve, logo e composer icon restano quelli dell'autore. Repo, identità MCP motion-lab, launcher e nomi ZIP legacy sono preservati. Main si trova a due archi dal payload dopo il cherry-pick branding: il fetch usa profondità **3**, registrata anche nei manifest.

Per scegliere destinazione e porta, dopo aver estratto il pacchetto:

    node install.mjs --variant studio \
      --destination "/percorso/nuova-installazione" \
      --applications-dir "/percorso/nuovi-launcher" --port 4199

La porta predefinita è **4198**. Le varianti sono alternative: non avviarne due insieme sulla stessa porta. Il launcher riusa soltanto un'istanza sana della stessa repo e non si appropria di servizi estranei. Non esegue fetch o npm a ogni avvio.

## Client e conservazione delle impostazioni

Studio viene preparato prima di configurare un client: verifica del pin, npm ci, dipendenze MCP quando necessarie e creazione della .app. Un prerequisito client mancante interrompe prima del download. Un errore npm/launcher non registra un plugin.

**Claude Desktop:** chiudi il client prima dell'installazione. Il JSON esistente viene letto senza cancellare altre preferenze/server; viene creato un backup con suffisso .motion-lab-backup-*, poi aggiunta soltanto mcpServers.motion-lab. JSON invalido, voce già presente, symlink o modifica concorrente vengono rifiutati. Il percorso può essere specificato con --claude-config /percorso/config.json.

**Codex:** marketplace locale motion-lab-beta con schema .agents/plugins/marketplace.json; mcp.json localizzato con Node e percorsi assoluti. L'installer salva un backup di config.toml quando esiste e usa esclusivamente codex plugin marketplace add … --json e codex plugin add motion-lab@motion-lab-beta --json, poi richiede nel JSON installed una voce motion-lab del marketplace motion-lab-beta con installed ed enabled entrambi true. Una voce solo disponibile, disabilitata o JSON malformato non costituiscono successo. Preserva la gestione delle altre impostazioni alla CLI ufficiale. Non estrae credenziali e non installa Codex. Una registrazione Motion Lab già visibile causa un arresto esplicito.

Se la configurazione client fallisce dopo una registrazione parziale, l'installer termina con errore e registra lo stadio: non dichiara successo, non cancella configurazioni e non effettua rollback ciechi. Consulta backup e installation.json; la copia Studio già preparata resta disponibile. Riavvia il client dopo un successo e verifica i sei tool: installazione e lista CLI non dimostrano una conversazione nativa riuscita.

Le versioni MCP sono immutabili; il ponte con il browser resta manuale tramite Versions. Render/output/asset locali non vengono sincronizzati o pubblicati. Il sito non può controllare il Mac. Limiti e tool: [MCP_PLUGIN.md](MCP_PLUGIN.md).

## Build, test e pubblicazione

    npm run test:downloads
    npm run build:downloads
    CHROME_PATH=/percorso/chrome node scripts/test-download-chooser.mjs

Il builder Node built-in genera ZIP deterministici in outputs/downloads/ (ignorata), manifest.json e SHA256SUMS; --out /cartella/assoluta permette di costruire direttamente l'artefatto da pubblicare. Ogni ZIP contiene soltanto bootstrap, launcher .command, istruzioni e provenienza, senza dipendenze, media, credenziali o percorsi personali. Il pin è esplicito nello script: cambiarlo richiede una revisione e una nuova build.

I sei gruppi di test usano Git **locale reale**, npm/client simulati e destinazioni temporanee; non interrogano GitHub o configurazioni client reali. Verificano SHA, destinazione esclusiva, .app eseguibile, conservazione/backup, fallimenti, verifica strutturata Codex e ZIP tramite un lettore indipendente Python stdlib. La fixture riproduce un commit branding dopo l'integrazione main: profondità 2 non include main, profondità 3 sì, e il vero checkUpdates restituisce current con ls-remote simulato. Una verifica cloud separata su clone shallow reale scaricato da GitHub conferma la stessa ancestry sul payload fissato e il check aggiornamenti fresh. Se cambia il pin, ricontrolla la profondità. Lo smoke browser controlla focus, Escape, ritorno al pulsante, mobile e tre download reali. La chat Mac ha verificato installazione e avvio Studio sulla porta separata 4202 con il precedente pin 8e8c568; l'installazione completa dei nuovi ZIP resta da ricontrollare sul Mac.

Il build pubblico completo dell'integrazione passa con Node **22.23.3** su Linux x64, inclusi i test di main3ad9. Viene adottata senza modifiche la fixture authored portabile introdotta da main68: struttura/testi esatti, geometria con tolleranza 1e-6, controlli di sensibilità del comparatore e seek esatto nello stesso runtime. Restano attivi i test dei 25 controlli grafici e ricette/keyframe. I quattro gruppi MCP passano contro il runtime integrato con Node 22; la baseline Original/review e le prove di contrasto usano il nuovo ID nativo objects, mantenendo il fallback review per runtime precedenti. Engine, geometrie e logo coincidono con la main integrata.

Il workflow .github/workflows/demo-pages.yml costruisce Studio pubblico e download, copia i ZIP in _site/downloads/ e aggiunge build-info.json. Esiste già su main con workflow_dispatch: può essere avviato sul ref codex/mac-downloads **senza merge**, rispettando le regole dell'ambiente github-pages. La chat Mac autorizzata gestisce dispatch/controlli Pages e pubblicazione ChatGPT Site; questa implementazione non cambia policy/protezioni. Per Sites copia anche outputs/downloads/ in downloads/ dell'artefatto e conserva la UI main integrata. Nessun ID del provider o credenziale entra nei sorgenti.
