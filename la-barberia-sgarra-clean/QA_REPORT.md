# QA_REPORT — La Barberia Sgarra (redesign-premium-v2)

Data: 1 agosto 2026  
Ambiente: `python3 -m http.server 8080` su `http://127.0.0.1:8080/`  
Branch: `redesign-premium-v2`

---

## Test eseguiti

| # | Test | Risultato |
|---|------|-----------|
| 1 | Console / JS syntax (`node --check`) | OK — nessun errore di sintassi |
| 2 | HTTP 200 su HTML/CSS/JS/config/privacy/robots/sitemap/manifest/asset | OK — tutti 200 |
| 3 | Asset referenziati in `index.html` | OK — 0 mancanti |
| 4 | Validazione form (submit vuoto) | OK — “Seleziona almeno un servizio.” + `aria-invalid` |
| 5 | Messaggio WhatsApp generato | OK — struttura corretta con Nome/Telefono/Servizio/Giorno/Orario |
| 6 | Menu mobile (open + Escape + scroll lock) | OK |
| 7 | Sticky CTA mobile (320 px) | OK — Prenota / Chiama / Indicazioni |
| 8 | Overflow orizzontale a 320 px | OK — `scrollWidth === 320` |
| 9 | Overflow desktop (~1900 px) | OK |
| 10 | Link `tel:`, WhatsApp, Maps, Instagram, Privacy | OK |
| 11 | Metadata title/description/OG/Twitter/canonical | OK (canonical relativo finché manca dominio) |
| 12 | JSON-LD `Barbershop` | OK — solo dati verificati; no `openingHoursSpecification` |
| 13 | robots.txt + sitemap.xml | OK |
| 14 | privacy.html | OK — base da completare |
| 15 | Cookie banner | OK — nascosto (GA/Clarity disattivati) |
| 16 | `trackEvent` disponibile senza errori | OK |
| 17 | Frasi vietate (“Un vero sito da barbiere”, ecc.) | OK — assenti |
| 18 | Screenshot hero mobile / desktop | OK — brand + CTA + foto taglio |
| 19 | Lighthouse CLI | Non eseguito (Chrome/Lighthouse non lanciati in CI locale) |

---

## Problemi corretti durante i test

1. Hero WebP upscalato (640/960) troppo morbido → ripristinato WebP nativo `taglio-13.webp`.
2. CTA header tagliata su viewport medi → testo corto “Prenota” sotto 1100 px.
3. `img` lightbox con `src=""` causava richiesta alla home → rimosso `src` iniziale.
4. Meta description portata a ~155 caratteri.

---

## Problemi residui

1. **Foto hero a bassa risoluzione nativa (~324 px)** — su desktop full-bleed resta soft; servono scatti più grandi dal titolare.
2. **Canonical / OG assoluti** — in attesa di dominio definitivo (`CONTENT_TODO.md`).
3. **Giorni di apertura** — orari presenti, giorni non verificati → non in Schema.org.
4. **Lighthouse numerico** — da rieseguire dopo il deploy Vercel.
5. **Cookie banner** resta nel DOM (nascosto); appare in alcuni alberi a11y ma non è interattivo.

---

## Dati ancora da verificare

Vedi `CONTENT_TODO.md`:

- Dominio definitivo
- Giorni settimanali di apertura
- CAP/provincia formali
- Titolare privacy / P.IVA
- ID GA4 / Clarity

---

## Punteggi Lighthouse

Non misurati in questa sessione. Target richiesti dopo deploy:

- Performance mobile ≥ 90
- Accessibility ≥ 95
- Best Practices ≥ 95
- SEO ≥ 95

---

## Istruzioni finali di deploy

1. Aprire il progetto in Vercel con Framework **Other**, build/install vuoti, Output `.`
2. Root Directory = cartella che contiene `index.html` (questa root se il repo è pulito)
3. Dopo il dominio: aggiornare `config.js` → `siteUrl`, sitemap, robots, JSON-LD `url`
4. Dettaglio completo in `DEPLOY.md`

---

## Criteri di accettazione

| Criterio | Stato |
|----------|-------|
| Sito visivamente nuovo | Sì |
| Copy orientato al cliente | Sì |
| CTA WhatsApp funzionante | Sì |
| Messaggio form corretto | Sì |
| Nessun dato inventato | Sì |
| Funziona a 320 px | Sì |
| Nessun asset 404 | Sì |
| Menu accessibile | Sì |
| SEO locale + JSON-LD | Sì (canonical da finalizzare) |
| Analytics predisposto, disattivato | Sì |
| Statico senza build | Sì |
| AUDIT / QA / CONTENT_TODO / DEPLOY / README | Sì |
