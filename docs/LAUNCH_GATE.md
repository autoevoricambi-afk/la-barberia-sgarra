# Launch Gate

Il flag `launchReady` può diventare `true` solo quando tutti i blocchi P0 sono chiusi.

## Proprietà e infrastruttura

- [ ] Dominio e account Vercel sotto controllo del progetto.
- [ ] Deploy staging 200 da root repository.
- [ ] HTTPS, redirect e rollback verificati.
- [ ] Backup/export documentati.

## Dati ufficiali

- [ ] Servizi, prezzi, durate e combinazioni approvati.
- [ ] Orari, pause, ferie e capacità approvati.
- [ ] Ragione sociale, P.IVA, contatto privacy approvati.
- [ ] Google Business URL e recensioni verificati.

## Prodotto

- [ ] Nessuna doppia prenotazione nei test di concorrenza.
- [ ] Conferma, spostamento e cancellazione funzionano.
- [ ] Agenda mobile testata da Paolo.
- [ ] WhatsApp/Calendar degradano senza perdere appuntamenti.
- [ ] Stati e KPI registrati correttamente.
- [ ] Lista d'attesa avvisa i clienti compatibili quando si libera uno slot.
- [ ] Carico/scarico giacenza è atomico e l'allerta sotto soglia arriva a Paolo.
- [ ] Promemoria giorno prima/giorno stesso e richiesta recensione sono consegnati.
- [ ] No-show/cancellazione tardiva attivano la regola caparra solo alla soglia approvata.

## Qualità

- [ ] Test automatici verdi.
- [ ] QA iPhone reale e Android.
- [ ] Tastiera, date picker e safe-area verificati.
- [ ] Accessibilità, performance e link esterni verificati.
- [ ] Nessun placeholder o dato inventato nell’interfaccia.

## Privacy e sicurezza

- [ ] Informativa coerente con sistema e fornitori effettivi.
- [ ] Consenso marketing separato e documentato.
- [ ] Retention, cancellazione ed export definiti.
- [ ] Segreti solo lato server; rate limit e anti-spam attivi.
- [ ] Accesso gestionale limitato all'email approvata da Paolo.
- [ ] Cookie/tracker bloccati fino alla scelta quando necessario.

## Go-live

- [ ] `siteUrl`, canonical, JSON-LD, sitemap e robots usano il dominio definitivo.
- [ ] `launchReady: true` solo nel commit approvato.
- [ ] Baseline “prima” archiviata.
- [ ] Monitoraggio prime 72 ore assegnato.
