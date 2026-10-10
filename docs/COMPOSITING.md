# Finitura ed export

In **Finitura** regola intensità della grana, dimensione e angolo otturatore.
Il nuovo look usa grana 0.018, dimensione 1.1 e otturatore 210°. Aberrazione
cromatica e bloom sono più contenuti per conservare i dettagli metallici.
Usa Ispezione 3D → Senza effetti per confrontare l’immagine senza finitura.

La grana è monocromatica, modulata per luminosità, riproducibile per frame e
applicata dopo l’integrazione temporale. Mantiene il dettaglio anche aumentando
i campioni. È visibile nel viewer e negli export, incluse le scene procedurali.

Il motion blur campiona posizioni reali di camera e oggetti, con esposizione
centrata e pesi morbidi agli estremi dell’otturatore. Non attraversa i tagli
registrati in motion.cuts (secondi, oppure oggetti con t/time). Il live viewer
mostra il singolo istante: per valutare il blur usa Crea preview o l’export.
24 campioni sono il compromesso normale; 48 riducono gli artefatti nei passaggi
più rapidi, ma raddoppiano circa il costo. Il grano non è un effetto di denoise.

## Impostazioni export

L’ingranaggio accanto a Esporta apre risoluzione, fps, formato, bitrate e
campionamento. La preview usa il profilo leggero indipendentemente dal finale.
MP4 usa H.264, WebM usa VP9, ProRes usa MOV / profilo 422 HQ a qualità fissa.
Il bitrate selezionato per MP4/WebM è un obiettivo VBR: la media effettiva varia
con il contenuto. I video completati vengono copiati nei Download; snapshot e
manifest tecnici rimangono nel progetto. Il percorso è visibile nello storico.

Esempio CLI:

```sh
node scripts/cli.mjs export --out renders/film.mp4 --width 3840 --height 2160 --fps 30 --format mp4 --bitrate-mbps 80 --temporal-samples 48
node scripts/cli.mjs export --out renders/master.mov --format prores --fps 30 --temporal-samples 24
```

La CLI rispetta il percorso --out; il pulsante del viewer pubblica nei Download.

## Limiti reali

L’integrazione recupera luce lineare dai frame già tone-mapped a 8 bit: non è
un accumulatore HDR del renderer. ProRes codifica a 10 bit/4:2:2 ma non recupera
la precisione persa nella sorgente, non è HDR né include alpha. Profondità di campo 3D disponibile, disattivata di default.
Il blur è temporale per campioni: movimenti estremi possono richiedere 48–64
campioni. La grana può essere attenuata dai codec a basso bitrate. Le opzioni
4K sono disponibili; per una prova rapida conviene iniziare da 1080p.

## Superfici 3D

`src/components/materials.js` crea mappe procedurali seamless e seeded a quattro
scale: altezza per il bump e rugosità indipendente. La demo le usa su ABS della
radio, manopola, smalto della B e giroscopio. Il bump modifica le normali illuminate,
non la silhouette: non è vero displacement geometrico. Intensità, scala e seed
si impostano nel componente, senza cambiare motore o pipeline.

La cover blu ha ora un bevel geometrico piccolo; mozzo e nucleo del giroscopio
usano profili torniti smussati. Le smussature restano geometria reale, visibile
anche senza compositing. Non è un renderer Redshift né un bevel automatico
universale per qualunque mesh importata.

## Bordi e avanzamento

FXAA (shader Three.js, MIT) è attivo di default dopo la distorsione lente e prima
di overlay e grana. In Finitura → Bordi più morbidi si può disattivare per confronto.
È un passaggio spaziale, non aggiunge render della scena e non sostituisce il blur.

Durante l'export lo studio mostra frame completati / totali e una miniatura
periodica dell'ultimo frame completato. La miniatura non segue lo scrubbing del
viewer e non rappresenta il campione temporale attualmente in lavorazione.
La fase di codifica è separata; 100% significa file completato e pubblicato.

## Frame completo e anteprima grande

L’icona **Render frame completo** calcola l’istante selezionato usando risoluzione,
fps e campioni di blur delle impostazioni export. Il PNG finale include finitura,
FXAA quando abilitato e integrazione temporale; non è la cattura veloce del viewer.
Il comando resta disabilitato quando un altro rendering occupa il motore.

Cliccando la miniatura si apre l’anteprima grande, con percentuale e frame
completati. Escape o la X chiudono l’overlay senza fermare il rendering.
Il frame singolo completato appare alla risoluzione originale ed è scaricabile.

Il browser del viewer (anche Safari) e il motore di export sono separati:
Chrome viene avviato in background per il rendering deterministico. Il processo
locale del viewer deve rimanere attivo fino alla fine dell’export.

## Profondità di campo

Pass bokeh 3D prima del bloom, con fuoco automatico al centro o distanza manuale. Overlay 2D nitidi; disattivato di default e nelle viste di ispezione. Il pannello non compare nella grafica 2D.

Le ricette salvano `look.post.dofEnabled`, `dofAuto`, `dofFocus` (.1–1000), `dofStrength` (0–1) e `dofMaxBlur` (0–30 pixel a 1080p).

Effetto screen-space: trasparenze e bordi sfocati sono approssimati. L’autofocus può saltare attraversando sagome; usa il fuoco manuale in quelle riprese.
