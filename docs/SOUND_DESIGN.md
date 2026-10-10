# Sound design

Attiva **Sound design** e premi Play. Volumi separati per camera, oggetti, accenti e musica; 0 spegne il modulo. Le modifiche si ascoltano al Play successivo.

- **Movimento:** whoosh di camera, rotazioni, cerniere e scatti dei meccanismi. In 2D, forme, testi, entrate e transizioni guidano gli SFX.
- **Musica:** basso, percussioni e note sintetiche, con BPM automatico o manuale. Gli SFX seguono il movimento, senza quantizzazione musicale.
- **Controlli:** mix discreto, densità, timbri e nuova variante. Ricette e versioni salvano `parameters.sound`.
- **Output:** ascolto nel viewer, WAV stereo e audio negli export video. Sintesi locale più una texture di vento Magnific/ElevenLabs inclusa; nessuna nuova generazione necessaria.

## Comandi

```sh
npm run export -- --sound on --out renders/film.mp4
npm run preview -- --scene procedural --sound on --out renders/procedural.mp4
```

`--sound off` esporta senza audio. Per sonorizzare un video esistente:

```sh
npm run soundtrack -- --video renders/film.mp4 --recipe renders/film.mp4.project.json --out renders/film-audio.mp4
```

Video, ricetta e sorgenti devono corrispondere. Il comando conserva il flusso video e salva mix WAV, tracce separate e telemetria. Usa un nuovo nome di output. `npm run sound:bank` genera esempi WAV dei timbri.

## Estensione e limiti

Audio stereo 48 kHz, analisi del movimento a 60 Hz. In 3D i profili dei meccanismi risiedono in `userData.sound`; in 2D il runtime campiona `nodesAt(time, parameters)`, condiviso con il disegno. Un nodo con `sound:false` viene escluso.

La visibilità audio è approssimata: non legge i pixel né simula collisioni. La musica è procedurale; analisi BPM e time-stretch di brani importati non sono implementati. [Workflow](AGENT_WORKFLOW.md) · [Verifiche](VALIDATION.md) · [Attribuzione della texture](../src/assets/audio/provenance.json).
