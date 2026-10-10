# Verifiche della pubblicazione

Verificato il 10 ottobre 2026 su macOS con Chrome e Node.js 25.8.1.

- Build Vite: passato; avviso sulla dimensione del bundle.
- Camera, grana e campionamento temporale: passati.
- Export brevi MP4 a 24/25/30/50/60 fps, WebM e ProRes: passati.
- API studio, salvataggio versioni, rendering e persistenza: passati.
- Runtime: 6 controlli passati su 7. Il passaggio 2D → 3D → 2D non conserva gli stessi pixel 2D; il ritorno alla scena 3D supera il controllo.
- Demo web: 1920 × 1080, 25 fps, 250 frame, 10 secondi, H.264 yuv420p, 24 campioni, bitrate obiettivo 6 Mb/s, 7.451.311 byte, AAC stereo 48 kHz. Decodifica completa e seek con hash identico: passati.
- Copertina del giroscopio: frame a 2,4 s con 24 campioni, senza logo nell’angolo. Fotogrammi dal nuovo video e screenshot reali della UI: controllati visivamente.

- Profondità di campo 3D: effetto on/off, ripristino, seek deterministico, bypass ispezione, UI e salvataggio versione passati (`node scripts/test-dof.mjs`). Disattivata di default.

## Audio

Verifiche dedicate: `npm run test:sound`, `node scripts/test-sound-browser.mjs`, `node scripts/test-sound-2d.mjs` e `node scripts/test-sound-2d-browser.mjs`. Coprono sintesi, movimento 2D/3D, trasporto, WAV e persistenza; passati sulla copia pubblica. Browser: 202 eventi 3D e 35 eventi 2D, fotogrammi invariati, Play/Pausa/seek, WAV, BPM e ricette verificati senza errori. Export 2D on/off verificati. Il mux della demo conserva tutti i 250 pacchetti video identici.

La verifica tecnica non costituisce approvazione all’ascolto o creativa. Windows e Linux non sono stati verificati.

La copia pubblicabile esclude cronologia Git precedente, reference e screenshot personali, versioni locali, log, output intermedi, cache e dipendenze installate. I testi selezionati sono stati controllati per percorsi personali, email e pattern comuni di credenziali; gli avvisi dei fornitori conservano le attribuzioni originali.
