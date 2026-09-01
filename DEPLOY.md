# Deploy staging e produzione

## Struttura corretta

`index.html`, `vercel.json`, `assets/` e tutti i file pubblici sono nella root del repository.
Non esiste più la cartella annidata `la-barberia-sgarra-clean/`.

## Impostazioni Vercel

| Campo | Valore |
|---|---|
| Framework Preset | Other |
| Root Directory | `.` |
| Build Command | vuoto |
| Install Command | vuoto |
| Output Directory | `.` |

## Variabili booking

Configurare su Vercel esclusivamente come variabili protette:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — mai esporla nel client
- `ADMIN_EMAILS`
- `ADMIN_REDIRECT_URL`

Applicare in ordine le migrazioni in `supabase/migrations/`. Senza variabili e migrazioni,
le API rispondono in sicurezza con booking non configurato e il sito resta in modalità WhatsApp.

## Staging

Lo staging deve essere pubblicabile ma non indicizzabile:

- `config.js` → `launchReady: false`;
- `index.html` → `noindex, nofollow`;
- `robots.txt` → `Disallow: /`;
- sitemap con URL tecnico assoluto, non inviata ai motori.

## Controlli prima di ogni deploy

```bash
npm test
git status --short
```

Il deploy è valido soltanto se:

- `/` e `/privacy` rispondono 200;
- CSS, JS, manifest e asset hero rispondono 200;
- header di sicurezza presenti;
- nessun asset o destinazione hash mancante;
- form WhatsApp e navigazione mobile verificati;
- il branch pubblicato corrisponde al commit approvato.

## Go-live

Completare prima `docs/LAUNCH_GATE.md`, poi nello stesso commit:

1. impostare il dominio proprietario in `config.js`;
2. aggiornare canonical, Open Graph, JSON-LD e sitemap;
3. cambiare `robots.txt` in `Allow: /` e aggiungere la sitemap assoluta;
4. impostare `launchReady: true`;
5. eseguire `npm test` e QA su dispositivi reali;
6. pubblicare e monitorare le prime 72 ore.

## Rollback

Conservare l’ultimo deployment verificato. Se home, booking o asset critici falliscono,
ripristinare quel deployment e correggere sul branch di lavoro: mai modificare produzione alla cieca.
