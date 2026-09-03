# Audit Master — 3 settembre 2026

## Verdetto

La piattaforma applicativa copre le richieste espresse da Paolo. Il codice resta in staging e il
booking pubblico resta spento finché database, dati ufficiali, accesso amministratore e canale
notifiche non sono configurati e collaudati con dati reali.

## Copertura richiesta

| Richiesta | Implementazione | Stato pre-attivazione |
|---|---|---|
| Sito e prenotazione personale | sito premium, servizi dinamici, disponibilità e booking atomico | codice completo; richiede catalogo/orari |
| App installabile | PWA cliente e manifest gestionale tablet/mobile | completa; installazione fuori dagli store |
| Agenda unica | sito, telefono, WhatsApp, walk-in e inserimento manuale nella stessa agenda | completa |
| Niente doppie prenotazioni | vincolo PostgreSQL sugli intervalli riservati e idempotenza | completa; da riprovare sul DB live |
| Lista d'attesa | richiesta cliente, pannello Paolo e avviso su cancellazione | completa; richiede canale messaggi |
| Giacenze | prodotti, carico, vendita/uso, scarto, correzione e soglia minima | completa; richiede inventario iniziale |
| “Paolo, ne restano 2” | evento automatico quando la quantità passa sotto soglia | completa; richiede canale messaggi |
| Promemoria appuntamenti | giorno prima e stesso giorno tramite cron/outbox | completa; richiede provider |
| Recensioni | richiesta automatica dopo servizio completato | completa; richiede link Google |
| Ritardi/no-show | contatori cliente separati e cronologia | completa |
| Caparra recidivi | soglia configurabile, importo/link e stati pagamento | completa; il pagamento online resta esterno |
| KPI del mese di prova | appuntamenti, provenienza, valore agenda, attesa, scorte e clienti a rischio | completa |
| Accesso protetto | Supabase Auth magic link e allow-list email | completa; richiede email Paolo |
| Sicurezza/privacy | segreti server-side, RLS, rate limit, noindex staging e informativa aggiornata | completa; da validare live |

## Dipendenze esterne non sostituibili dal codice

1. Progetto Supabase intestato o controllato dalla Barberia.
2. Email di Paolo per accesso e notifiche.
3. Canale messaggi: Resend per email oppure provider ufficiale WhatsApp/SMS via webhook.
4. Dominio definitivo e, solo in seguito, eventuali account Apple/Google per gli store.
5. Servizi, prezzi, durate, orari, inventario iniziale, regola caparra e link recensioni approvati.

Nessuna password o carta va inviata in chat. I costi esterni vengono sottoscritti direttamente
dal titolare e non vanno inclusi in chiavi o account personali dello sviluppatore.

## Sequenza di chiusura

1. Pubblicare il branch operativo come preview Vercel.
2. Collegare Supabase e applicare le quattro migrazioni.
3. Inserire segreti con scope Preview e Production separati.
4. Creare Paolo in Supabase Auth e configurare catalogo, orari, inventario e regole.
5. Collegare il canale notifiche e collaudare ogni evento reale.
6. Eseguire Launch Gate, consegnare `/admin/` e avviare i 30 giorni.
7. Promuovere in produzione soltanto l'artefatto già collaudato.
