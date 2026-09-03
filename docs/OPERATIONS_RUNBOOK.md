# Operational Pilot Runbook

## Prima dell'attivazione

1. Passare il progetto commerciale a Vercel Pro.
2. Creare Supabase e applicare, in ordine, le tre migrazioni in `supabase/migrations`.
3. Inserire in Vercel tutte le chiavi presenti in `.env.example`, con scope separati.
4. Creare l'utente Supabase Auth di Paolo e autorizzare l'email in `ADMIN_EMAILS`.
5. Verificare il dominio mittente Resend o configurare il webhook notifiche.
6. Accedere al gestionale e salvare servizi e orari confermati da Paolo.
7. Eseguire il backup cifrato e conservarlo fuori dal repository.
8. Tenere `booking.mode = request` finché tutti i test di accettazione sono verdi.

## Test di accettazione

- booking da sito e booking manuale;
- doppia richiesta concorrente sullo stesso slot;
- spostamento e cancellazione;
- pausa e chiusura;
- notifica a Paolo;
- accesso magic-link;
- metriche settimana;
- backup cifrato;
- iPhone e Android reali;
- fallback WhatsApp e rollback deployment.

## Attivazione

Solo dopo approvazione: attivare catalogo e orari, impostare booking live, aggiornare privacy,
dominio, canonical, sitemap e robots. Promuovere lo stesso artefatto già verificato, senza
ricostruirlo.

## Prime 72 ore

Controllare errori Vercel, outbox non processata, appuntamenti pending, doppioni, tempi di
risposta e chiamate di Paolo. Non eliminare il deployment precedente.

## Ripristino

In caso di blocco: riportare il booking a modalità request, mantenere il database intatto,
promuovere il deployment precedente e comunicare a Paolo l'uso temporaneo di WhatsApp.
