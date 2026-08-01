# DEPLOY — Vercel (sito statico)

## Struttura Git reale

Il progetto pubblicato è la cartella:

`la-barberia-sgarra-clean/`

Qui si trovano `index.html`, `styles.css`, `script.js`, `config.js`, `assets/`.

**Non c’è una cartella annidata extra** con un secondo `index.html`.

Se su GitHub il repository ha questa cartella come root del repo, su Vercel:

- **Root Directory:** `.` (lasciare vuoto / default)

Se invece il repository contiene una cartella padre e dentro c’è `la-barberia-sgarra-clean`, allora:

- **Root Directory:** `la-barberia-sgarra-clean`

## Impostazioni progetto Vercel

| Campo | Valore |
|-------|--------|
| Framework Preset | **Other** |
| Build Command | *(vuoto)* |
| Install Command | *(vuoto)* |
| Output Directory | `.` |
| Node.js | non richiesto |

`vercel.json` attuale:

```json
{
  "cleanUrls": true
}
```

Nessun build step. Il sito è HTML/CSS/JS statico.

## Procedura di pubblicazione

1. Caricare il contenuto di questa cartella su GitHub (root del repo o sotto-cartella coerente).
2. Su [vercel.com](https://vercel.com) → Add New Project → importa il repo.
3. Imposta Root Directory come sopra.
4. Deploy senza build command.
5. Verifica che `https://TUO-PROGETTO.vercel.app/` mostri la landing (non 404).
6. Controlla in Network che `assets/optimized/hero-taglio-13-640.webp` e `styles.css` rispondano 200.

## Redeploy

- Push su branch collegato, oppure
- Vercel Dashboard → Deployments → Redeploy

## Dominio personalizzato

1. Vercel → Project → Settings → Domains
2. Aggiungi il dominio e completa i DNS richiesti
3. Quando il dominio è attivo:
   - Imposta `siteUrl` in `config.js` (es. `https://www.esempio.it`)
   - Aggiorna `sitemap.xml` e `robots.txt` con URL assoluti
   - Aggiorna il campo `url` del JSON-LD in `index.html`
   - Ricarica e verifica canonical / Open Graph Debugger

## Verifica post-deploy

- [ ] Home 200
- [ ] `/privacy` o `/privacy.html` 200
- [ ] Nessun asset 404
- [ ] WhatsApp apre con messaggio dal form
- [ ] `tel:` e Maps funzionanti
- [ ] Instagram corretto
- [ ] Canonical non punta a un URL Vercel “di prova” se esiste già il dominio definitivo

## Nota sul 404

Un 404 su Vercel di solito significa Root Directory sbagliata o `index.html` non nella cartella di output. Controllare la struttura Git **reale** prima di dichiarare risolto.
