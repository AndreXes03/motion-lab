# Framevolve · Download macOS beta

La landing offre **Download** con tre ZIP piccoli: Studio locale, Studio + Codex, Studio + Claude Desktop. La demo online nel browser rimane separata e non richiede installer. La .app è un launcher del servizio Vite locale e apre Studio nel browser; non è un'app standalone. Nessun pacchetto Windows/Linux.

## Uso sul Mac

Servono macOS, Git/Command Line Tools, **Node.js ≥22.12**, npm e Google Chrome in /Applications. Installa questi prerequisiti separatamente; non vengono scaricati dal bootstrap. Serve Internet per GitHub/npm e per gli script di installazione delle dipendenze native. Codex richiede una CLI con plugin marketplace add e plugin add (supportata anche la CLI inclusa in ChatGPT); Claude richiede Claude Desktop già installato. Cycles richiede Blender locale e una scena supportata, attualmente PULSE.

Estrai l'intero ZIP, leggi LEGGIMI.txt, SOURCE.json e lo script, poi apri **Installa Motion Lab.command**. È una beta non firmata/notarizzata: può richiedere una conferma macOS; non disabilita Gatekeeper. Il Terminale mostra l'esito e resta aperto per leggere gli errori. Dopo il successo apri ~/Applications/Motion Lab studio.app, Motion Lab codex.app o Motion Lab claude.app.

Ogni variante riserva una cartella **nuova** ~/Applications/Motion Lab/VARIANTE e crea repository/, eventuale plugin/, snippet e installation.json. Se trova una cartella, app o registrazione Motion Lab esistente, si ferma senza sostituirla. Non usa checkout dell'utente, reset/stash/pull/clean, aggiornamenti automatici né adattatori Linux. La sorgente è fissata a **f39f2eaa725e3ea5ee83b8b78862274c21a0b84a**, commit che integra main **68ecfcc77dbf322fe46d3391270f04d08e4473d0**, inclusi UI Framevolve, logo e gallery Easy/Pro/Export di main20 e fixture grafica portabile, con plugin 6f477f4 e launcher 72ed7c8. I nomi repo/MCP, launcher e file ZIP Motion Lab restano per compatibilità. Il genitore main68 è incluso nel fetch a profondità 2.

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

I sei gruppi di test usano Git **locale reale**, npm/client simulati e destinazioni temporanee; non interrogano GitHub o configurazioni client reali. Verificano SHA, destinazione esclusiva, .app eseguibile, conservazione/backup, fallimenti, verifica strutturata Codex e ZIP tramite un lettore indipendente Python stdlib. Il fetch usa profondità 2: conserva i genitori del pin merge, incluso main, così il check aggiornamenti riconosce main già incluso; questo percorso è testato col vero checkUpdates e ls-remote simulato. Lo smoke browser controlla focus, Escape, ritorno al pulsante, mobile e tre download reali. La chat Mac ha verificato installazione e avvio Studio sulla porta separata 4202 con il precedente pin 8e8c568; l'installazione completa dei nuovi ZIP resta da ricontrollare sul Mac.

Il build pubblico completo dell'integrazione passa con Node **22.23.3** su Linux x64, inclusi i nuovi test di main68. Viene adottata senza modifiche la sua fixture authored portabile: struttura/testi esatti, geometria con tolleranza 1e-6, controlli di sensibilità del comparatore e seek esatto nello stesso runtime. Il confronto aggiuntivo con la sorgente authored pre-controlli 502de6c ha prodotto nodi esattamente identici nei sei capitoli su Linux; testo e geometria del film non sono stati modificati. Restano attivi i test dei 25 controlli grafici, ricette/keyframe e i quattro gruppi MCP contro il runtime integrato con Node 22.

Il workflow .github/workflows/demo-pages.yml costruisce Studio pubblico e download, copia i ZIP in _site/downloads/ e aggiunge build-info.json. Esiste già su main con workflow_dispatch: può essere avviato sul ref codex/mac-downloads **senza merge**, rispettando le regole dell'ambiente github-pages. La chat Mac autorizzata gestisce dispatch/controlli Pages e pubblicazione ChatGPT Site; questa implementazione non cambia policy/protezioni. Per Sites copia anche outputs/downloads/ in downloads/ dell'artefatto e conserva la UI main integrata. Nessun ID del provider o credenziale entra nei sorgenti.
