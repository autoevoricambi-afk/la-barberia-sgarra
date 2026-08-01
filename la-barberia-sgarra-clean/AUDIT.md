# AUDIT — La Barberia Sgarra

Data audit: 1 agosto 2026  
Branch: `redesign-premium-v2`  
Workspace: `la-barberia-sgarra-clean` (root statica, senza cartella annidata)

---

## Stato attuale

Sito statico monofile (`index.html` + `styles.css` + `script.js` + `assets/`) già orientato a barber shop locale, con modulo WhatsApp, galleria fotografica e JSON-LD base.

| Area | Valutazione |
|------|-------------|
| Stack | HTML/CSS/JS vanilla — corretto per Vercel statico |
| Conversione | Presente ma CTA fragmentate e copy auto-referenziale |
| SEO locale | Title/meta/JSON-LD presenti ma incompleti (canonical Vercel, OG relativi, no robots/sitemap) |
| Accessibilità | Parziale: menu mobile senza Escape/focus trap, no skip link, form error unico |
| Performance | Font Google pesanti (Inter + Cormorant), logo PNG 1.8 MB inutilizzato in hero, orb CSS blur |
| Contenuti | Frasi che parlano del sito (“Un vero sito da barbiere”, “Conversione da mobile”) |
| Deploy | `vercel.json` minimale OK; Git assente al momento dell’audit (inizializzato in questa sessione) |

---

## Punti validi

- Dati di contatto coerenti: Via Corato 48, Andria; +39 329 641 0828; Instagram `@la_barberia_sgarra`
- Flusso WhatsApp con messaggio strutturato già funzionante
- Servizi reali elencati (9 voci) senza prezzi inventati
- Fotografie autentiche di lavori (taglio-1…19, escluso 7)
- Logo ufficiale WebP + PNG disponibili
- Header sticky, menu mobile base, `aria-expanded` sul toggle
- Schema.org `Barbershop` già impostato
- `cleanUrls` su Vercel

---

## Problemi critici

1. **Copy fuori target**: H1 e fascia valori parlano del sito web, non del beneficio cliente.
2. **Hero a card collage**: logo + due foto in card — viola la direzione “full-bleed / brand first”.
3. **Canonical/url JSON-LD** puntano a `https://la-barberia-sgarra.vercel.app/` senza verifica dominio definitivo.
4. **OG image relativo** (`assets/...png`) — non valido per social crawler.
5. **Assenza** di `robots.txt`, `sitemap.xml`, `site.webmanifest`, favicon dedicati, `privacy.html`.
6. **Orari** mostrati senza giorni della settimana verificati — rischio SEO/Schema se dichiarati come `openingHoursSpecification` completi.
7. **Menu mobile** senza Escape, senza blocco scroll, senza ripristino focus.
8. **Validazione form** debole: un solo messaggio, nessun focus sul campo errato, nessun consenso informativo.

---

## Problemi di conversione

- CTA hero secondaria punta a Instagram invece che alla gallery (“Guarda i tagli”).
- Header CTA è “Prenota ora” (anchor) invece di WhatsApp diretto.
- Nessuna sticky bar mobile con Prenota / Chiama / Indicazioni.
- Floating WhatsApp generico senza contesto messaggio.
- Fascia fiducia con claim digitali inutili (“Conversione da mobile”).
- Nove service card uguali senza gerarchia → scan difficile su mobile.
- Manca sezione metodo (3 step) e FAQ che riducono attrito e false aspettative sull’orario.
- Telefono non sempre cliccabile (`tel:`) nelle zone chiave.
- Nessun tracking eventi predisposto.

---

## Problemi SEO

- Un solo H1 ma testo non locale-intent (“sito da barbiere”).
- Meta description OK ma migliorabile con CTA.
- Manca `og:url`, Twitter Card, canonical sicuro.
- JSON-LD: image/url relativi o non verificati; CAP 76123 presente ma da confermare; `openingHours` assenti (corretto finché i giorni non sono certi).
- Nessun contenuto FAQ strutturato.
- Keyword locali presenti ma affogate da copy “agenzia”.
- Asset non referenziati in sitemap.

---

## Problemi tecnici

- Dipendenza runtime da Google Fonts (2 famiglie, molti pesi).
- Reveal CSS nasconde contenuto (`opacity: 0`) → rischio FOUC / no-JS se JS fallisce (mitigato parzialmente dall’observer fallback).
- Nessun `width`/`height` espliciti sulle immagini → rischio CLS.
- `loading="eager"` su hero secondaria; logo WebP 265 KB ancora grande per header.
- Checkbox custom con `opacity: 0` + `pointer-events: none` → potenziale issue tastiera/AT.
- `window.open` per WhatsApp può essere bloccato; meglio `location` / link diretto.
- Nessun `config.js` per analytics/dominio.
- README orientato al packaging, non all’operatività del titolare.

---

## Problemi mobile

- A 560px tutti i button full-width + floating WhatsApp full-bleed → possibile overlap con form/CTA.
- Gallery 1 colonna OK ma 8 immagini senza lightbox/focus.
- Choice grid servizi a 1 colonna → form molto lungo senza raggruppamento.
- Touch target menu OK (52px); focus ring non esplicitato.
- Safe-area iPhone non gestita sul floating button.
- Hero media stack: tre blocchi sopra la piega → LCP e scroll eccessivi.

---

## Piano di ricostruzione

1. Branch `redesign-premium-v2` + snapshot Git iniziale.
2. Inventario asset, WebP ottimizzati in `assets/optimized/`, icone in `assets/icons/` (originali intatti).
3. Nuova architettura pagina: skip → header → hero full-bleed → fiducia → servizi gerarchici → lavori → metodo → prenota → contatti → FAQ → CTA finale → footer + sticky mobile.
4. Identità: carbone / antracite / avorio / ottone desaturato; brand red/blue solo come dettaglio.
5. SEO: title/meta/OG/Twitter/canonical placeholder, JSON-LD verificato, robots, sitemap, manifest, privacy.
6. JS modulare: nav a11y, form validation, WhatsApp builder, analytics stub, year.
7. `config.js` con GA4/Clarity disattivati.
8. Test locale + `QA_REPORT.md`, `CONTENT_TODO.md`, `DEPLOY.md`, README aggiornato.

---

## Dati aziendali da verificare

| Dato | Valore attuale in repo | Stato |
|------|------------------------|--------|
| Nome | La Barberia Sgarra | Verificato in file |
| Indirizzo | Via Corato 48, Andria | Presente; da confermare CAP/civico formale |
| CAP | 76123 | Presente in HTML; da confermare |
| Provincia | BT | Presente in HTML; da confermare |
| Telefono | +39 329 641 0828 | Presente |
| WhatsApp | stesso numero | Presente |
| Instagram | @la_barberia_sgarra | Presente |
| Orari | 08:00–13:00 / 15:00–20:00 | Presenti; **giorni settimana non verificati** |
| Prezzi | — | Assenti (non inventare) |
| Dominio definitivo | — | Assente |
| Partita IVA / titolare privacy | — | Assente |
| Recensioni / rating | — | Non usare |
| GA4 / Clarity ID | — | Assenti |

---

## Inventario asset (sintesi)

| File | Dim. | Peso | Uso proposto |
|------|-------|------|--------------|
| logo-…-premium.png | 1024² | 1.8 MB | Archivo; sorgente icone/OG |
| logo-…-premium.webp | 1024² | 265 KB | Fallback brand; sostituire con versioni ottimizzate |
| taglio-13.jpg | 324×424 | 59 KB | **Hero primario** (fade preciso, contesto negozio) |
| taglio-8, 18, 19, 14, 9, 17, 12, 10 | ~320×400 | 48–61 KB | Gallery editoriale |
| taglio-1…6, 11, 15, 16 | simili | 34–55 KB | Gallery / riserva |
| taglio-7 | — | — | Non presente |

Tutte le foto taglio sono portrait, qualità buona da smartphone/social, idonee a gallery; hero a full-bleed richiede overlay scuro e `object-fit: cover` senza deformazione.
