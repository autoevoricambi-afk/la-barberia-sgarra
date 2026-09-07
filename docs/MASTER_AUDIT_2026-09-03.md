# Audit Master — aggiornato 7 settembre 2026

## Verdetto

La piattaforma applicativa copre le richieste espresse da Paolo. GitHub, preview Vercel e Supabase
sono collegati e il deployment operativo è sano. Il booking pubblico resta spento finché accesso
amministratore e canale notifiche non sono configurati e collaudati con dati reali.

## Copertura richiesta

| Richiesta | Implementazione | Stato pre-attivazione |
|---|---|---|
| Sito e prenotazione personale | sito premium, servizi dinamici, disponibilità e booking atomico | preview completa; booking pubblico protetto |
| App installabile | PWA cliente e manifest gestionale tablet/mobile | completa; installazione fuori dagli store |
| Agenda unica | sito, telefono, WhatsApp, walk-in e inserimento manuale nella stessa agenda | completa |
| Niente doppie prenotazioni | vincolo PostgreSQL sugli intervalli riservati e idempotenza | database live e test automatici verdi |
| Lista d'attesa | richiesta cliente, pannello Paolo e avviso su cancellazione | completa; richiede canale messaggi |
| Giacenze | prodotti, carico, vendita/uso, scarto, correzione e soglia minima | completa; richiede inventario iniziale |
| “Paolo, ne restano 2” | evento automatico quando la quantità passa sotto soglia | completa; richiede canale messaggi |
| Promemoria appuntamenti | giorno prima e stesso giorno tramite cron/outbox | completa; richiede provider |
| Recensioni | richiesta automatica dopo servizio completato | link Google collegato; richiede sesta migrazione |
| Ritardi/no-show | contatori cliente separati e cronologia | completa |
| Caparra recidivi | soglia configurabile, importo/link e stati pagamento | completa; il pagamento online resta esterno |
| KPI del mese di prova | appuntamenti, provenienza, valore agenda, attesa, scorte e clienti a rischio | completa |
| Accesso protetto | Supabase Auth magic link e allow-list email | email Paolo nota; richiede variabile Vercel e redirect Supabase |
| Sicurezza/privacy | segreti server-side, RLS, rate limit, noindex staging e informativa aggiornata | validata live; segreti non esposti |

## Dipendenze esterne non sostituibili dal codice

1. Variabile Vercel `ADMIN_EMAILS` e redirect Auth Supabase per l'accesso di Paolo.
2. Canale messaggi: Resend per email oppure provider ufficiale WhatsApp/SMS via webhook.
3. Dominio definitivo e, solo in seguito, eventuali account Apple/Google per gli store.
4. Inventario iniziale e regole di cancellazione/no-show/caparra approvate.

Nessuna password o carta va inviata in chat. I costi esterni vengono sottoscritti direttamente
dal titolare e non vanno inclusi in chiavi o account personali dello sviluppatore.

## Sequenza di chiusura

1. Applicare la sesta migrazione e configurare `ADMIN_EMAILS`, `ADMIN_REDIRECT_URL` e `CRON_SECRET`.
2. Consentire il redirect del gestionale in Supabase Auth e far entrare Paolo con magic link.
3. Inserire inventario e regole concordate; collegare il canale notifiche.
4. Collaudare gli eventi reali e installare la PWA sul telefono di Paolo.
5. Avviare i 30 giorni mantenendo il booking pubblico spento finché Paolo non approva.
6. Eseguire il Launch Gate e promuovere in produzione lo stesso artefatto già collaudato.
