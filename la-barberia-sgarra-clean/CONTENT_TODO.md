# CONTENT_TODO — dati da verificare o completare

Aggiornare questo file man mano che il titolare fornisce le informazioni mancanti.

## Critici per pubblicazione

- [ ] **Dominio definitivo** (es. `https://www.labarberiasgarra.it`)
  - Aggiornare `SITE_CONFIG.siteUrl` in `config.js`
  - Aggiornare canonical, `og:url`, `og:image` assoluti
  - Aggiornare `url` nel JSON-LD in `index.html`
  - Aggiornare `robots.txt` Sitemap e `sitemap.xml` con URL assoluti
  - Documentare in `DEPLOY.md` dopo il collegamento

- [ ] **Giorni di apertura** collegati agli orari `08:00–13:00 / 15:00–20:00`
  - Solo dopo verifica aggiungere `openingHoursSpecification` nello Schema.org
  - Eventuali chiusure settimanali / festivi

- [ ] **CAP e provincia** (`76123`, `BT`) — presenti nel vecchio HTML; confermare formalmente

- [ ] **Indirizzo completo** — confermare civico “Via Corato 48” su Google Business Profile

## Privacy e legale

- [ ] Nome / ragione sociale del titolare del trattamento
- [ ] Partita IVA o codice fiscale (se applicabile)
- [ ] Email dedicata privacy (se diversa dal telefono)
- [ ] Completare `privacy.html` con i dati reali
- [ ] Valutare necessità di cookie policy quando si attivano GA4/Clarity

## Analytics

- [ ] `GA4_MEASUREMENT_ID` in `config.js`
- [ ] `CLARITY_PROJECT_ID` in `config.js` (opzionale)
- [ ] Attivare solo dopo consenso/banner e aggiornamento privacy

## Contenuti commerciali (non inventare)

- [ ] Listino prezzi servizi (solo se comunicato ufficialmente)
- [ ] Eventuali servizi aggiuntivi / rimossi
- [ ] Foto alta risoluzione del locale (se disponibili, senza rimuovere quelle attuali)
- [ ] Coordinate GPS precise per Maps embed leggero (se desiderato in futuro)

## Non aggiungere senza prove

- Recensioni o rating Google
- Numero clienti / anni di esperienza
- Nomi dello staff (anche se “Davide” compare nel logo: non usarlo nel copy finché non confermato)
- Premi, promozioni, percentuali di sconto

## Copy già allineato — da rivedere solo se cambia l’offerta

- Hero, servizi, metodo, FAQ, CTA finale
