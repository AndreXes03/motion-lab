# Verifica visiva prima del rendering finale

Generare il confronto dei tre oggetti con materiali e in clay:

```sh
node scripts/quality.mjs --out renders/quality-board.png
```

Il risultato è una tavola di sei fotogrammi, i singoli PNG e un manifesto JSON. Il comando usa le viste isolate dell'applicativo. Una riuscita tecnica significa solo che le immagini sono state prodotte: l'approvazione visiva richiede di guardarle.

1. **Forma e dettagli:** controllare silhouette, spessore, raccordi, saldature, anelli e punti di attacco. Il palloncino deve mostrare volume gonfiato e cuciture credibili; il portachiavi deve avere collegamenti reali; la manopola deve avanzare verso la camera e stare dentro il proprio collare.
2. **Normali e intersezioni:** guardare la clay e, per i difetti dubbi, la vista `review: 'normals'`. Cercare facce capovolte, superfici mancanti, compenetrazioni, spigoli casuali e ombre spezzate. Ripetere con un altro angolo di rotazione.
3. **Materiali:** verificare la scala della texture in primo piano, le differenze fra plastica, metallo e film del palloncino, la continuità UV e il comportamento delle riflessioni. Controllare che la grana non diventi puntinatura visibile e che le luci non cancellino i dettagli.
4. **Movimento:** guardare una preview continua. Verificare pivot, inerzia, vincoli, contatti, oscillazioni, arresti e rotazione della manopola. I fotogrammi isolati non verificano la fisica o la fluidità.
5. **Compositing:** controllare l'inquadratura completa in movimento e alla risoluzione finale: gerarchia, sovrapposizioni, ombre, contrasto, leggibilità e tagli ai margini. Verificare bloom e motion blur sia attivi sia disattivi.
6. **Consegna:** eseguire la verifica tecnica di seek deterministico e metadati del video; poi guardare il file esportato. Registrare separatamente rendering riuscito, controllo visivo eseguito e approvazione dell'utente.

Se uno dei primi tre controlli fallisce, correggere il modello prima di generare l'intero filmato. Se fallisce il movimento, produrre prima una preview breve della parte interessata.
