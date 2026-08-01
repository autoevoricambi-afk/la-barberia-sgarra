# MEDIA_TODO — materiali da fornire

Documentazione asset per La Barberia Sgarra.
Originali esistenti **non eliminati**; nuova struttura in `assets/`.

## Inventario attuale (disponibile)

| Tipo | File | Note |
|------|------|------|
| Logo | `assets/brand/logo.webp` (+ 256/512) | 1024² originale presente |
| Tagli gallery | `assets/images/gallery/taglio-*.webp/jpg` | ~315–325px, portrait |
| Hero | `assets/images/hero/hero-640/960.webp` | **Upscale** da ~324px → soft su desktop |
| Paolo (proxy) | `paolo-lavoro`, `paolo-dettaglio` | Scatti dove Paolo compare; **non sono ritratti dedicati** |
| Studio (proxy) | `interno-01/02/03` | Ambienti da foto tagli; non esterni dedicati |
| Video | — | **Assenti** |
| Reel locali | — | **Assenti** |
| Recensioni file | — | Non presenti |

## Mancanti — priorità alta

- [ ] **Hero video** proprietario 6–9s, muted, MP4 H.264 &lt; 2,5 MB + poster HQ
- [ ] **Hero foto** alta risoluzione (≥1600px lato lungo) di Paolo mentre taglia
- [ ] **Ritratto Paolo** dedicato (volto/mezzo busto, luce negozio)
- [ ] **Dettaglio lavoro** (mani, macchinetta, sfumatura close-up) HQ
- [ ] **Esterno** Via Corato / insegna
- [ ] **Interno** wide: postazioni, specchi, poltrone, verde/bordeaux
- [ ] **Studio video** 15–25s del locale (con/senza parlato + sottotitoli se parlato)

## Mancanti — priorità media

- [ ] 2–3 **Reel originali** esportati (file locali) + URL Instagram ufficiali
- [ ] Poster dedicati hero/studio (≥1200px)
- [ ] Eventuali **prima/dopo** autorizzati dal cliente

## Contenuti / dati (non media)

- [ ] Approvazione bio Paolo (testo attuale in `config.js` → `barber.bioApproved`)
- [ ] Giorni di apertura collegati agli orari
- [ ] Prezzi (solo se comunicati)
- [ ] Recensioni Google verificate + link fonte
- [ ] Dominio definitivo
- [ ] Partita IVA / ragione sociale (solo con approvazione)
- [ ] `foundingDate` (es. “Dal 2023”) solo se confermato

## Come attivare i video

1. Caricare file in `assets/video/hero/` e `assets/video/studio/`
2. In `config.js`:
   - `media.hero.mode = 'video'`
   - `media.hero.videoMp4 = '...'`
   - `media.studio.videoMp4 = '...'`
3. Poster in `assets/posters/`

## Come attivare Reel

1. Mettere file in `assets/video/reels/` **oppure** solo URL ufficiali
2. Compilare `instagramMedia[]` con `enabled: true`
3. Nessuno scraping: solo file forniti o embed su interazione

## Come attivare recensioni

1. `reviewsEnabled: true`
2. Array `reviews` con `verified: true`, testo, autore, `sourceUrl`
