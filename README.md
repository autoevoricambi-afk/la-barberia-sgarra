# La Barberia Sgarra — sito prenotazioni statico

Sito single-page mobile-first pronto per:
- GitHub Pages
- Vercel
- Netlify o hosting statico equivalente

## File principali
- `index.html`
- `styles.css`
- `script.js`
- `assets/`

## Funzionalità integrate
- Hero premium con CTA conversione
- Servizi selezionabili
- Gallery lavori barber
- Modulo di prenotazione completo
- Slot da 1 ora: 08:00–12:00 e 15:00–19:00
- Preferenza pagamento: contanti, carta/POS, carta online
- Riepilogo automatico
- Invio richiesta su WhatsApp alla barberia
- Pulsante per copiare il riepilogo
- Navigazione mobile sticky

## Numero WhatsApp configurato
`+39 329 641 0828`

Per cambiarlo, aprire `script.js` e modificare:
```js
const whatsappNumber = "393296410828";
```

## Pubblicazione su GitHub
1. Crea un repository.
2. Carica tutti i file e la cartella `assets`.
3. Vai in Settings > Pages.
4. Seleziona deploy da branch `main`, root `/`.
5. Salva.

## Pubblicazione su Vercel
1. Importa il repository GitHub in Vercel.
2. Framework preset: `Other`.
3. Build command: lascia vuoto.
4. Output directory: lascia vuoto.
5. Deploy.

## Nota
La richiesta di prenotazione viene preparata su WhatsApp, ma non viene salvata in un database. Per prenotazioni automatiche con agenda reale, blocco slot e pagamenti online effettivi servirà una V2 con backend/database.


## V2 mobile
Questa versione rafforza:
- visibilità del logo in testata su smartphone
- header mobile più compatto e leggibile
- hero più pulito e meno dispersivo
- servizi più compatti
- gallery più rapida da scorrere
- modulo prenotazione più comodo da mobile
- sticky bar inferiore meno invasiva
