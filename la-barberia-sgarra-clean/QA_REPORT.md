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

---

## Mobile Conversion V3

Data: 1 agosto 2026
Branch: `redesign-premium-v2`
Path sito: `la-barberia-sgarra-clean/` (cartella annidata nel repo Git)

### Audit mobile prima → dopo

| Problema | Prima | Dopo |
|----------|-------|------|
| Hero piena di meta | 4 righe (dove/tel/orari/conferma) | Solo Via Corato 48 + Conferma in chat |
| CTA hero | “Prenota su WhatsApp” → `#prenota` ma track `whatsapp_click_hero` | “Scegli servizio e orario” → `#prenota` + `booking_start_hero` |
| Form | Un blocco lungo + telefono | Wizard 3 step, senza telefono |
| Servizi | Card informative, 1 colonna | Card selezionabili 2 colonne + “Altri servizi” |
| Gallery | 1 colonna / 8 immagini | 2 colonne, 6 + “Mostra altri tagli”, lightbox prev/next/swipe |
| Trust | 4 item in colonna | 3 chip scroll-snap orizzontale |
| Sticky | Prenota / Chiama / Indicazioni equi | WhatsApp \| **Prenota** dominante \| Indicazioni |
| Hero LCP | WebP nativo 324px | `picture` + srcset 640/960 (nota: upscale da 324px → soft) |
| Font | Outfit + Instrument | System UI + solo Instrument Serif |

### Test viewport

| Viewport | Overflow | Sticky | Note |
|----------|----------|--------|------|
| 320 × 568 | No | Sì | Gallery/servizi 2 col |
| 375 × 812 | No | Sì | Hero CTA sopra piega, H1 mobile corretto |
| 430 × 932 | No | Sì | OK |
| 768 × 1024 | No | Nascosta | Menu desktop, gallery completa |
| 1440 (logica CSS) | — | Nascosta | Meta desktop completa |

### Wizard / WhatsApp

- Step 1→2→3 OK, dati preservati
- Continua disabilitato senza servizio
- Messaggio senza campo Telefono
- URL `wa.me/393296410828?text=…` strutturato correttamente

### Eventi analytics V3

`booking_start_hero`, `booking_step_view`, `booking_step_continue`, `booking_step_back`, `whatsapp_booking_submit`, `maps_click`, `instagram_click`, `gallery_expand`, `gallery_swipe`, `service_select`, `booking_validation_error`, `whatsapp_click_header`, `whatsapp_click_sticky`

### Problemi residui

1. Hero 640/960 WebP sono **upscale** da JPEG ~324px → su schermi grandi restano soft (nessun sharpen aggressivo applicato).
2. Repo Git ha cartella annidata `la-barberia-sgarra-clean/`: su Vercel Root Directory deve essere `la-barberia-sgarra-clean`.
3. Lighthouse numerico non rieseguito in questa passata.
4. Contenuto dei fieldset `hidden` ancora presente in alcuni alberi a11y (comportamento browser); focus e tab restano corretti sullo step attivo.

### Screenshot / descrizione 375px

Hero compatta: eyebrow, brand, H1 “Il taglio giusto, senza perdere tempo.”, lead breve, CTA primaria full-width “Scegli servizio e orario”, link “Guarda i tagli”, meta ridotta. Sticky inferiore con Prenota centrale dominante. Quick actions WhatsApp / Indicazioni / Instagram sotto la hero.

---

## Brand Experience V4

Data: 1 agosto 2026

### Architettura

Header → Hero cinematografica → Quick actions → Lavori → Paolo → Servizi → Dentro la Barberia → Prenotazione wizard → (Recensioni off) → Dove siamo → FAQ (2) → CTA finale → Footer + sticky

### Test rapidi

| Check | Esito |
|-------|-------|
| HTTP 200 index/css/js/config/asset brand/hero/paolo | OK |
| “Come funziona” / “Tre passaggi” assenti | OK |
| Telefono nel form assente | OK |
| Messaggio WA “Ciao Paolo…” | OK (script) |
| Gallery/services da config | OK |
| Video hero assente → Mode B foto | OK |
| Recensioni/reels nascosti se disabled | OK |
| JS syntax | OK |

### Viewport (smoke CSS/emulation previsti)

320–430 sticky + quick actions; ≥768 sticky/quick nascosti, nav desktop.

### Residui

- Hero soft (upscale)
- Media mancanti (MEDIA_TODO.md)
- Bio Paolo pending approval
- Lighthouse non rieseguito
- Root Vercel: `la-barberia-sgarra-clean`

---

## Hotfix iPhone reale → Brand Experience V4.1

Data: 1 agosto 2026
Branch: `redesign-premium-v2`
Trigger: test reale iPhone ~390×844 (registrazione)

### Legenda verifica

| Codice | Significato |
|--------|-------------|
| **REALE** | Osservato / segnalato su dispositivo iPhone fisico |
| **AUTO** | Verificato in questa sessione via CDP/emulazione Chrome (375 / 390 / 430) + `node --check` |
| **NON VERIFICATO** | Non rieseguito su Safari iOS fisico dopo le correzioni |

### Problemi segnalati (REALE) e stato fix

| # | Problema (REALE) | Fix | AUTO |
|---|------------------|-----|------|
| 1 | Nota “Testo da approvare con Paolo.” in UI | Rimossa; bio neutra se `paoloBioApproved: false` | OK — stringa assente |
| 2 | Sticky troppo alta / copre CTA | Altezza ~60px + safe-area; hide su `#prenota`, focus campi, menu, lightbox; `visualViewport` | OK — h≈60, pad=60, hide/restore |
| 3 | Duplicazione servizio (step 1 dopo Continua) | Continua servizi → step 2; step 1 solo senza selezione | OK — skip a step 2; senza servizio → step 1 |
| 4 | Card servizi / stato selezione debole | Card cliccabile, check, “Selezionato”, chip “Hai scelto [×]” | OK — chip Barba× |
| 5 | “Guarda tutti i lavori” → Instagram sorprendente | “Vedi tutti su Instagram” + icona + aria-label; “Mostra altri lavori” locale | OK |
| 6 | Handle Instagram isolato | Riga social: label + @handle + Segui → | OK |
| 7 | Nota editoriale Paolo | Flag `paoloBioApproved`; copy neutro sicuro | OK |
| 8 | Foto locale non ambientali | `studioMediaApproved: false` → sezione nascosta | OK |
| 9 | Foto taglio come posizione | `locationMediaApproved: false` → tipografica, no img | OK |
| 10 | Orari “da confermare” in UI | `openingHoursApproved: false` → orari nascosti | OK |
| 11 | Date iOS mostra data nativa a vuoto | Date control “Scegli il giorno” + value controllato | OK in Chrome; **NON VERIFICATO** su Safari iOS |
| 12 | Errori duplicati / box rosso | Summary generico + inline specifico | OK |
| 13 | Pulsanti indifferenziati | Primary / Secondary / Text link | OK (markup/CSS) |
| 14 | Contrasto muted basso | `--muted` e descrizioni servizi più chiari | OK (CSS); contrasto strumentale **NON VERIFICATO** |
| 15 | QA viewport | Emulazione 375×812, 390×844, 430×932 | OK overflow; sticky |

### Verificato tramite test automatico (AUTO)

- `node --check` su `script.js` / `config.js`
- Nessuna stringa pubblica vietata (approvare / giorni da confermare / Orari indicati)
- Overflow orizzontale assente a 375 / 390 / 430
- Sticky visibile in alto (~60px), nascosta su `#prenota` in view, menu, lightbox; ripristino scroll top
- Selezione Barba → Continua → Passaggio 2; Indietro preserva data/ora/servizio
- Validazione data vuota: summary “Controlla il campo evidenziato.” + “Scegli un giorno.” + focus `#booking-date`
- Data selezionata → display “1 agosto 2026”; step 3 con riepilogo
- Link WhatsApp / Maps / Instagram corretti
- Sezione studio nascosta; ore nascoste; posizione senza immagine

### Non ancora verificato (dopo fix)

- Safari iOS fisico con toolbar inferiore reale (safe-area + chrome Safari)
- `input[type=date]` / `showPicker` sul device
- Tastiera iOS reale su select/textarea e ripristino sticky
- Invio WhatsApp end-to-end dal device
- Lighthouse / contrasto strumentale WCAG
- Media approvati (studio/facciata/orari/bio) quando i flag passeranno a `true`

### Residui aperti

1. Hero e molte foto restano a bassa risoluzione nativa (MEDIA_TODO).
2. CTA finale usa ancora uno still proxy come texture di sfondo (non è la sezione Posizione).
3. Safe-area reale iPhone non misurata in emulazione desktop (inset spesso 0 in CDP).
4. Flag contenuti ancora `false`: bio, studio, location, orari.
---

## Hotfix V4.2 — secondo test iPhone reale

Data: 1 agosto 2026
Branch: `redesign-premium-v2`
Trigger: secondo test reale iPhone ~390×844

### PHYSICAL IPHONE VERIFIED (segnalato dal test reale, pre-fix)

- caricamento
- hero
- menu
- sticky hide menu
- gallery layout
- card servizio
- stato selezionato
- chip servizio
- sticky hide in booking
- navigazione verticale
- footer layout

### Fix applicati in V4.2

| Bug | Intervento |
|-----|------------|
| Skip step 1 non globale | `openBooking()` unica per hero, Continua servizi, sticky, menu, CTA finale, `#prenota` |
| Titolo sotto header | `scroll-margin-top` + `scrollToId()` con offset header |
| Placeholder FACCIATA/INSEGNA/MAPPA | Rimossi dal DOM pubblico; `locationMediaApproved: false` → solo tipografia |
| Azioni posizione strette | Griglia 2×2, target ≥48px, gerarchia primary/secondary/tertiary |
| Sticky in hero/finale/footer | Zone measure + IO + `visualViewport`; padding body stabile |
| Altri servizi | `details` chiuso: “Altri servizi +” / “Nascondi altri servizi −” |
| Instagram frammentato | Una sola `instagram-card` |
| Copy hero / Paolo | Aggiornati; `paoloBioApproved: false` |
| Crash sticky init | `stickyZones` dichiarato in testa IIFE |

### AUTO (emulazione 375 / 390 + CDP)

| Check | Esito |
|-------|-------|
| Barba → Continua → step 2 + focus `step-2-title` | OK |
| Modifica → step 1 preserva data/ora/nome | OK |
| Sticky Prenota con/senza servizio → step 2/1 | OK |
| Hero CTA / CTA finale con servizio → step 2 | OK |
| Nessun placeholder posizione | OK |
| Altri servizi chiusi | OK |
| Sticky nascosta hero / finale / footer | OK |
| Sticky visibile sezioni centrali | OK |
| Overflow 375 / 390 | OK |
| Offset preciso sotto header | PARZIALE in CDP; predisposto per Safari |

### NOT YET PHYSICALLY VERIFIED (dopo V4.2)

- gallery expand, lightbox, swipe
- date picker / validation / keyboard iOS
- step 3, back persistence su device
- WhatsApp final, Maps, Instagram external
- offset header su Safari iOS reale con toolbar

### Feature flag (stato config)

- `paoloBioApproved: false`
- `studioMediaApproved: false`
- `locationMediaApproved: false`
- `openingHoursApproved: false`
