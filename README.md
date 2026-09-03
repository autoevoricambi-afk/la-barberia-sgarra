# La Barberia Sgarra — Case Study 001

Repository di fondazione del sistema digitale Barberia Sgarra.

## Stato

- Branch di lavoro: `case-study-001-operational`
- Applicazione statica nella **root del repository**
- Staging protetto: `launchReady: false`, meta `noindex` e `robots.txt` bloccante
- Sito storico pubblico rilevato in 404 il 1 settembre 2026
- V4.2 conservata come base visiva
- API booking, schema PostgreSQL/Supabase e gestionale mobile operativo protetti da feature gate
- Modalità pubblica attuale: richiesta WhatsApp; nessun prezzo, durata o orario inventato

## Comandi

```bash
npm test
npm run serve
npm run backup:encrypted
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
├── admin/                  # control room mobile autenticata
├── api/                    # booking, agenda, KPI, notifiche e cron
├── platform/               # validazione e regole condivise
├── supabase/migrations/    # database, anti-overlap e workflow
├── docs/
│   ├── CONTROL_ROOM.md
│   ├── DEPLOYMENT_MAP.md
│   ├── PAOLO_DISCOVERY.md
│   ├── BASELINE_2026-09-01.md
│   ├── BOOKING_DOMAIN_CONTRACT.md
│   ├── LAUNCH_GATE.md
│   ├── OPERATIONS_RUNBOOK.md
│   └── PILOT_30_DAYS.md
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
- inserimento manuale, spostamento, note, pause e chiusure;
- configurazione versionata di servizi, prezzi, durate e orari;
- database clienti/appuntamenti con vincolo anti-sovrapposizione e buffer reali;
- notifiche email/webhook con outbox e retry;
- lista d'attesa collegata agli slot liberati;
- giacenze con carico/scarico atomico e allerta sotto soglia;
- promemoria, richiesta recensione e regola caparra per recidive;
- KPI aggregati, log strutturati, rate limit e backup cifrato.

Google Calendar e WhatsApp Business non vengono dichiarati attivi: l'outbox consente di
collegarli successivamente senza perdere appuntamenti. La modalità reale resta spenta finché
Supabase, catalogo, durate, orari, privacy e canali di notifica non sono verificati.
Il contratto funzionale è in `docs/BOOKING_DOMAIN_CONTRACT.md`; la mappa dei due deployment
Vercel è in `docs/DEPLOYMENT_MAP.md`.
