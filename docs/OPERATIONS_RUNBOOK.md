# Operational Pilot Runbook

## Prima dell'attivazione

1. Tenere il pilot su Vercel Hobby finché limiti e cron giornaliero sono sufficienti; passare a
   Pro solo per un'esigenza misurata.
2. Creare Supabase nell'account della Barberia e applicare, in ordine, le quattro migrazioni in
   `supabase/migrations`.
3. Inserire in Vercel tutte le chiavi presenti in `.env.example`, con scope separati.
4. Creare l'utente Supabase Auth di Paolo e autorizzare l'email in `ADMIN_EMAILS`.
5. Verificare il dominio mittente Resend o configurare il webhook WhatsApp/SMS.
6. Accedere al gestionale e salvare servizi e orari confermati da Paolo.
7. Eseguire il backup cifrato e conservarlo fuori dal repository.
8. Inserire prodotti, quantità iniziali, soglie, link recensioni e regole caparra.
9. Tenere il booking pubblico disattivato nel database finché tutti i test sono verdi.

## Test di accettazione

- booking da sito e booking manuale;
- doppia richiesta concorrente sullo stesso slot;
- spostamento e cancellazione;
- pausa e chiusura;
- notifica a Paolo;
- promemoria cliente giorno prima e giorno stesso;
- richiesta recensione dopo completamento;
- lista d'attesa e avviso su slot liberato;
- carico, scarico, inventario insufficiente e allerta sotto soglia;
- conteggio no-show/cancellazione tardiva e richiesta caparra;
- accesso magic-link;
- metriche settimana;
- backup cifrato;
- iPhone e Android reali;
- fallback WhatsApp e rollback deployment.

## Attivazione

Solo dopo approvazione: attivare catalogo, orari e `publicBookingEnabled`, impostare booking live, aggiornare privacy,
dominio, canonical, sitemap e robots. Promuovere lo stesso artefatto già verificato, senza
ricostruirlo.

## Prime 72 ore

Controllare errori Vercel, outbox non processata, appuntamenti pending, doppioni, tempi di
risposta e chiamate di Paolo. Non eliminare il deployment precedente.

## Ripristino

In caso di blocco: riportare il booking a modalità request, mantenere il database intatto,
promuovere il deployment precedente e comunicare a Paolo l'uso temporaneo di WhatsApp.
