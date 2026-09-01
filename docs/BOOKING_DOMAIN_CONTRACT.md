# Booking — contratto di dominio

Il gestionale dovrà rispettare queste regole indipendentemente dalla tecnologia scelta.

## Fonte di verità

Il database degli appuntamenti è la fonte primaria. WhatsApp invia comunicazioni e Google
Calendar può rispecchiare/bloccare disponibilità, ma nessuno dei due sostituisce il database.

## Stati appuntamento

`pending` → `confirmed` → `completed`

Uscite alternative:

- `cancelled_by_customer`
- `cancelled_by_shop`
- `no_show`

Ogni transizione salva autore, timestamp e motivazione quando prevista.

## Regole slot

Uno slot è prenotabile solo quando:

1. il servizio è attivo e ha durata valida;
2. l’operatore è abilitato al servizio;
3. lo slot rientra negli orari effettivi e non attraversa pause o chiusure;
4. durata + buffer non si sovrappongono ad altri appuntamenti o blocchi calendario;
5. rispetta anticipo minimo, orizzonte massimo e regole di cancellazione;
6. il salvataggio atomico conferma che nessun altro utente lo abbia preso nel frattempo.

## Servizi

Ogni servizio richiede:

- ID stabile e nome pubblico;
- prezzo in centesimi e valuta;
- durata in minuti;
- buffer prima/dopo;
- operatori compatibili;
- regole add-on/combinazioni;
- stato attivo e ordine di visualizzazione.

“Taglio + barba” è un servizio composto: non può essere prenotato insieme a “Taglio” o
“Barba” se questo duplicasse lavoro, durata o prezzo.

## Cliente

Dati minimi MVP:

- nome;
- recapito necessario alla conferma;
- storico appuntamenti;
- consensi separati e versionati;
- note operative limitate a ciò che serve per il servizio.

Marketing, preferenze tecniche e note interne non devono essere confuse con i dati necessari
alla prenotazione.

## Concorrenza e integrità

- vincolo database contro sovrapposizioni;
- idempotency key su creazione e webhook;
- scadenza delle prenotazioni temporanee;
- timezone `Europe/Rome` con ora legale;
- log degli eventi senza dati personali in chiaro;
- retry sicuro per Calendar e messaggistica;
- cancellazione sincronizzata senza perdere lo storico.

## Eventi misurabili

`service_view`, `booking_start`, `slot_view`, `slot_selected`, `booking_confirmed`,
`booking_cancelled`, `appointment_completed`, `no_show`, `review_requested`,
`review_clicked`, `rebooking_confirmed`.

Gli analytics non ricevono nome, telefono, note o contenuto dei messaggi.

