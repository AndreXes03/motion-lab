# Cloud e aggiornamento Mac

GitHub collega il lavoro cloud e la copia sul Mac. Il percorso è:
**cloud → commit e push su branch dedicato → pull request → merge autorizzato su main → aggiornamento Mac**.
Una PR aperta non aggiorna main. Il cloud non sincronizza automaticamente le cartelle del Mac.

## Aggiornare il Mac

Servono Git, Node.js **22.12 o successivo**, accesso al repository GitHub e rete per le dipendenze npm quando necessarie. Chiudi Studio e i render locali prima dell'aggiornamento.

Dopo il primo aggiornamento che include questi file, fai doppio clic su **Avvia Motion Lab.command** nella radice della copia locale: esegue l'aggiornamento sicuro e poi `npm run viewer`, solo se aggiornamento e installazione riescono. Non installa pianificazioni né processi persistenti. Se vuoi soltanto aggiornare, usa **Aggiorna Motion Lab.command**. In alternativa, dal Terminale nella repo:

```sh
npm run aggiorna
```

I launcher cercano Node anche nei percorsi Homebrew, mise e asdf; se manca provano il default di nvm. Se Finder non trova la versione Node corretta, attivala nel Terminale ed esegui `npm run aggiorna`. Se i launcher hanno perso il permesso di esecuzione, usa `chmod +x "Aggiorna Motion Lab.command" "Avvia Motion Lab.command"`.

L'aggiornatore verifica la radice Git, il remote `origin` di `AndreXes03/motion-lab`, il branch **main**, l'assenza di modifiche e file non tracciati (anche nei submodule). Blocca operazioni Git in corso e due aggiornamenti contemporanei. Scarica solo main, senza altri branch o tag, e applica soltanto un fast-forward. Non esegue push, merge remoto, stash, reset o pulizie.

**Se ci sono modifiche locali si ferma.** Leggi `git status` e chiedi al tuo agente di conservarle e riconciliarle prima di riprovare. Un backup non rende pulita la copia: le modifiche rimaste sul Mac continuano a bloccare l'aggiornamento. Non pubblicare automaticamente modifiche private, comprese quelle alle licenze.

`npm ci` parte al primo utilizzo (manca una conferma dell'installazione), quando manca `node_modules`, cambiano `package.json`, `package-lock.json`, `.npmrc` o l'ABI di Node, oppure se l'installazione precedente è fallita. Altrimenti viene saltato. Lo stato è nella directory Git, non tra i file del progetto. Se npm fallisce, il codice può essere già aggiornato: risolvi il problema indicato e rilancia lo stesso comando, anche senza nuovi commit remoti. Un lock rimasto dopo una chiusura forzata richiede una verifica manuale che il vecchio processo sia terminato.

Il riepilogo mostra versione del progetto, commit e stato delle dipendenze. Poi puoi avviare `npm run viewer`. **`renders/`, `outputs/` e gli asset ignorati da Git richiedono un download separato.**

## Usare una copia revisionata prima del merge

L'agente può fornirti lo script Node revisionato da conservare in una cartella strumenti **esterna** alla repo. Non occorrono librerie npm per eseguirlo:

```sh
node "/percorso/strumenti/aggiorna-motion-lab.mjs" --repo "/percorso/assoluto/motion-lab"
```

Un wrapper `.command` locale può eseguire questa riga, usando percorsi assoluti e lo script già revisionato sul Mac. Non scaricare ed eseguire automaticamente codice remoto. Lo script aggiorna sempre dal main GitHub: non installa il contenuto della PR mentre è aperta e si ferma se la copia Mac ha modifiche locali. Il launcher incluso nella repo usa invece la radice relativa alla propria posizione.

## Istruzioni per gli agenti

- Leggi `AGENTS.md`, controlla branch, stato Git completo e main remoto prima di lavorare. Preserva file e modifiche dell'utente. Ogni task cloud è già isolato: usa il checkout esistente, senza worktree salvo richiesta esplicita.
- Lavora su un branch dedicato. Testa le modifiche pertinenti, crea commit, push e PR quando autorizzati. Il merge richiede una richiesta esplicita. Non importare nella repo l'adattatore Linux esterno e non cambiare licenze nell'ambito di questa sincronizzazione.
- L'aggiornatore è per **main sul Mac**. I branch `work` o di sviluppo nel cloud sono normali: non cambiarli per far passare il controllo dell'aggiornatore.
- Nel cloud segui lo `start_skill` dell'ambiente. Per questa configurazione: checkout `/workspace/motion-lab`, Chromium tramite `/workspace/.motion-lab-cloud/chromium.mjs` e Studio Vite su loopback 4194. Il processo va riavviato dopo un ripristino; un PID non dimostra che lo Studio funzioni. Verifica API progetto e smoke browser 2D senza render 3D pesanti quando bastano.
- Distingui configurazione in bozza, pubblicazione e runtime. Non dichiarare pubblicato un ambiente solo perché gli script sono salvati. Consegna URL PR, SHA, verifiche e istruzioni per il Mac; indica separatamente gli output da scaricare.
- Esegui `npm run test:aggiornamento` per i test isolati dell'updater. Usano remote Git locali e un sostituto di npm per simulare installazioni e fallimenti; non contattano GitHub e non reinstallano le dipendenze reali. La build rimane `npm run build`.

## Demo e Studio su GPT Sites

La demo e lo Studio statico possono essere valutati per un hosting web come GPT Sites, se gli strumenti disponibili supportano caricamento degli asset e build Vite. Servono verifiche di percorsi, limiti dei media e funzioni del browser. Le API locali, FFmpeg, Blender e i render nativi richiedono un backend separato: non diventano disponibili pubblicando la sola parte statica. Questa configurazione non pubblica la demo né lo Studio su Sites.
