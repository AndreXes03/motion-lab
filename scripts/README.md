# Rendering e strumenti locali

Il punto di ingresso è [cli.mjs](cli.mjs). I comandi principali sono esposti anche attraverso `npm run`.

| Comando | Risultato |
| --- | --- |
| `npm run viewer` | Studio locale su `127.0.0.1:4173` |
| `npm run frame -- --time 2.4 --out renders/frame.png` | Fotogramma a un tempo preciso |
| `npm run contact -- --out renders/contact.png` | Sequenza di frame per revisione |
| `npm run export -- --out renders/film.mp4 --temporal-samples 24 --bitrate-mbps 6` | Film 1080p con motion blur |
| `npm run verify -- --out renders/film.mp4 --time 2.4` | Metadata e stabilità del seek |

[studio-api.mjs](studio-api.mjs) gestisce versioni e lavori di rendering. [project-store.mjs](project-store.mjs) legge e salva ricette. [reference.mjs](reference.mjs) raccoglie reference; [quality.mjs](quality.mjs) e [review.mjs](review.mjs) generano tavole di revisione.

I file `test-*.mjs` contengono verifiche mirate di camera, tempo, grana, export e API. Alcuni richiedono Chrome e producono report in `renders/`, esclusa da Git.

[Guida d’uso](../docs/USAGE.md) · [Verifiche e limiti](../docs/VALIDATION.md)
