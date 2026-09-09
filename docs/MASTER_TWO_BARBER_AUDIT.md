# La Barberia Sgarra — regole operative due barbieri

- Ogni slot parte ogni 30 minuti.
- Paolo e Giuseppe hanno due agende indipendenti.
- Lo stesso orario può contenere al massimo 2 clienti: uno con Paolo e uno con Giuseppe.
- Se entrambi sono liberi il sito mostra 2 posti.
- Se uno solo è libero lo stesso orario resta prenotabile e mostra 1 posto.
- Se entrambi sono occupati l'orario non viene proposto.
- Primo disponibile assegna uno dei barbieri realmente liberi; in caso di conflitto concorrente prova l'altro senza cambiare orario.
- Passa a Paolo/Giuseppe mantiene giorno e ora e riesce solo se il barbiere di destinazione è disponibile e abilitato ai servizi.
- Conferma mantiene lo slot occupato e porta pending -> confirmed.
- Cliente annulla libera lo slot e può registrare cancellazione tardiva.
- Barberia annulla libera lo slot senza penalizzare il cliente.
- Completa chiude il lavoro e alimenta storico/metriche.
- No-show registra la mancata presentazione.
- Sposta mantiene il barbiere e verifica il nuovo slot prima di confermare.
