# Verifiche della pubblicazione

Verificato il 10 ottobre 2026 su macOS con Chrome e Node.js 25.8.1.

- Build Vite: passato; avviso sulla dimensione del bundle.
- Camera, grana e campionamento temporale: passati.
- Export brevi MP4 a 24/25/30/50/60 fps, WebM e ProRes: passati.
- API studio, salvataggio versioni, rendering e persistenza: passati.
- Runtime: 6 controlli passati su 7. Il passaggio 2D → 3D → 2D non conserva gli stessi pixel 2D; il ritorno alla scena 3D supera il controllo.
- Demo web: 1920 × 1080, 25 fps, 250 frame, 10 secondi, H.264 yuv420p, 24 campioni, bitrate obiettivo 6 Mb/s, 7.108.816 byte. Decodifica completa e seek con hash identico: passati.
- Copertina del giroscopio: frame a 2,4 s con 24 campioni, senza logo nell’angolo. Fotogrammi dal nuovo video e screenshot reali della UI: controllati visivamente.

La verifica tecnica non costituisce approvazione creativa. Windows e Linux non sono stati verificati.

La copia pubblicabile esclude cronologia Git precedente, reference personali, screenshot, versioni locali, log, output intermedi, cache e dipendenze installate. I testi selezionati sono stati controllati per percorsi personali, email e pattern comuni di credenziali; gli avvisi dei fornitori conservano le attribuzioni originali.
