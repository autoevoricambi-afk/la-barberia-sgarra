# Flusso operativo a due barbieri

- Slot base: 30 minuti.
- Paolo Sgarra e Giuseppe hanno agende indipendenti.
- Lo stesso orario può contenere due prenotazioni contemporanee, una per Paolo e una per Giuseppe.
- Una prenotazione occupa esclusivamente la postazione dell'operatore assegnato.
- Il comando rapido `Passa a Giuseppe` / `Passa a Paolo` mantiene giorno e orario e viene accettato solo se il secondo operatore è realmente libero e abilitato ai servizi selezionati.
- `Cliente annulla` libera lo slot; se la cancellazione è tardiva può incrementare le segnalazioni del cliente.
- `Barberia annulla` libera lo slot senza penalizzare il cliente.
- I blocchi agenda devono essere associati a un singolo operatore o, per una chiusura totale, a entrambi.
- Gli orari di Paolo e Giuseppe sono modificabili separatamente nel gestionale.
