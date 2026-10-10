# Sound design

Attiva **Sound design** e premi Play. Camera, oggetti, accenti e musica hanno volumi separati; 0 spegne il modulo. Le modifiche si ascoltano al Play successivo.

- **3D:** whoosh di camera, rotazioni, cerniere e scatti dei meccanismi.
- **2D:** forme, testi, entrate e transizioni guidano gli SFX. La densità seleziona i gesti principali delle griglie.
- **Musica:** stili scena, techno e ambient; BPM automatici o manuali. La demo 2D usa techno originale a 132 BPM. In manuale cambiano musica e pulsazioni, ma i tagli mantengono i tempi editoriali.
- **Output:** ascolto, WAV stereo e audio negli export. Ricette e versioni salvano volumi, timbri e variante in `parameters.sound`.

## Comandi

```sh
npm run export -- --sound on --out renders/film.mp4
npm run preview -- --scene procedural --sound on --out renders/procedural.mp4
```

`--sound off` esporta senza audio. Per un video già renderizzato:

```sh
npm run soundtrack -- --video renders/film.mp4 --recipe renders/film.mp4.project.json --out renders/film-audio.mp4
```

Video, ricetta e sorgenti devono corrispondere. Il comando conserva il flusso video e salva mix WAV e tracce separate; usa un nuovo nome di output. `npm run sound:bank` genera esempi WAV dei timbri.

## Estensione

Audio stereo a 48 kHz, movimento campionato a 60 Hz. In 3D i profili sono in `userData.sound`; in 2D `nodesAt(time, parameters)` condivide il grafo del disegno. `sound:false` esclude un nodo e i suoi figli.

Sintesi locale, più una [texture di vento inclusa](../src/assets/audio/provenance.json). La visibilità audio è geometrica: non legge i pixel né simula collisioni. Analisi BPM e time-stretch di brani importati non sono implementati. [Workflow](AGENT_WORKFLOW.md) · [Verifiche](VALIDATION.md)
