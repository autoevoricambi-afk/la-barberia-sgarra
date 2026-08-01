# La Barberia Sgarra

Landing page statica per la barberia ad Andria: taglio uomo, sfumature, barba e prenotazione via WhatsApp.

## Stack

- HTML5 semantico
- CSS moderno (nessun framework)
- JavaScript vanilla (`config.js` + `script.js`)
- Deploy statico su Vercel (nessun build)

## Avvio locale

Dalla root di questo progetto:

```bash
python3 -m http.server 8080
```

Apri [http://127.0.0.1:8080](http://127.0.0.1:8080).

Oppure:

```bash
npx --yes serve -l 8080
```

## Struttura

```
/
├── index.html
├── privacy.html
├── styles.css
├── script.js
├── config.js
├── robots.txt
├── sitemap.xml
├── site.webmanifest
├── vercel.json
├── AUDIT.md
├── CONTENT_TODO.md
├── DEPLOY.md
├── QA_REPORT.md
└── assets/
    ├── *.jpg / logo originali
    ├── optimized/   # WebP e OG
    └── icons/       # favicon
```

## Configurazione

Modifica `config.js` per:

- `siteUrl` — dominio definitivo
- `GA4_MEASUREMENT_ID` / `CLARITY_PROJECT_ID` — lasciare vuoti finché non pronti
- `debug: true` — log eventi analytics in console (senza dati sensibili)

## Contatti presenti nel sito

- Indirizzo: Via Corato 48, Andria
- Telefono / WhatsApp: +39 329 641 0828
- Instagram: [@la_barberia_sgarra](https://www.instagram.com/la_barberia_sgarra/)
- Orari indicati: 08:00–13:00 / 15:00–20:00 (giorni da verificare — vedi `CONTENT_TODO.md`)

## Documentazione

- `AUDIT.md` — audit pre-ricostruzione
- `CONTENT_TODO.md` — dati mancanti
- `DEPLOY.md` — pubblicazione Vercel
- `QA_REPORT.md` — test eseguiti
