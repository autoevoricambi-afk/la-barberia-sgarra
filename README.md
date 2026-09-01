# La Barberia Sgarra — Case Study 001

Repository di fondazione del sistema digitale Barberia Sgarra.

## Stato

- Branch di lavoro: `case-study-001-foundation`
- Applicazione statica nella **root del repository**
- Staging protetto: `launchReady: false`, meta `noindex` e `robots.txt` bloccante
- Sito storico pubblico rilevato in 404 il 1 settembre 2026
- V4.2 conservata come base visiva
- API booking, schema PostgreSQL/Supabase e gestionale mobile già costruiti ma protetti da feature gate
- Modalità pubblica attuale: richiesta WhatsApp; nessun prezzo, durata o orario inventato

## Comandi

```bash
npm test
npm run serve
```

Preview locale: [http://127.0.0.1:8080](http://127.0.0.1:8080).

## Struttura

```text
/
├── index.html
├── privacy.html
├── styles.css
├── script.js
├── config.js
├── assets/
├── admin/                  # agenda mobile autenticata
├── api/                    # availability, booking e funzioni admin
├── platform/               # validazione e regole condivise
├── supabase/migrations/    # database, anti-overlap e workflow
├── docs/
│   ├── CONTROL_ROOM.md
│   ├── DEPLOYMENT_MAP.md
│   ├── PAOLO_DISCOVERY.md
│   ├── BASELINE_2026-09-01.md
│   ├── BOOKING_DOMAIN_CONTRACT.md
│   └── LAUNCH_GATE.md
├── tests/site-integrity.mjs
├── tests/*.test.mjs
├── package.json
├── robots.txt
├── sitemap.xml
├── site.webmanifest
└── vercel.json
```

## Configurazione centrale

`config.js` contiene dati, feature flag e stato di lancio. Nessun dato non verificato deve
essere reso pubblico. `launchReady` resta `false` fino al completamento di `docs/LAUNCH_GATE.md`.

## Architettura realizzata

Il repository contiene una PWA unica con:

- esperienza cliente;
- API per booking con disponibilità reale;
- pannello gestionale mobile autenticato via magic link;
- database clienti/appuntamenti con vincolo anti-sovrapposizione;
- integrazioni Calendar e WhatsApp;
- automazioni e KPI del Case Study 001.

La modalità reale resta spenta finché Supabase, catalogo, durate e orari non sono verificati.
Il contratto funzionale è in `docs/BOOKING_DOMAIN_CONTRACT.md`; la mappa dei due deployment
Vercel è in `docs/DEPLOYMENT_MAP.md`.
