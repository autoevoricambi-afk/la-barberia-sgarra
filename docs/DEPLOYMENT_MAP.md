# Mappa deployment — fonte unica

Aggiornata: 1 settembre 2026.

## GitHub

- Repository canonico: `autoevoricambi-afk/la-barberia-sgarra`
- `main` (`974ac11`): versione storica, non usare come base.
- `redesign-premium-v2` (`0baed4b`): V4.2 visuale del 1 agosto 2026.
- `case-study-001-foundation`: sola linea di sviluppo corrente; parte dalla V4.2 e porta l'app nella root.

## Vercel

| Progetto / URL | Stato verificato | Versione | Decisione |
|---|---|---|---|
| `https://la-barberia-sgarra.vercel.app/` | `404 NOT_FOUND` | nessun deployment raggiungibile | deve diventare il dominio tecnico canonico dopo il collaudo |
| `https://la-barberia-sgarra-vqdz-git-rede-37e3c6-ivans-projects-06740a94.vercel.app/` | `200`, `x-robots-tag: noindex` | V4.2: hash di `config.js`, `script.js` e `styles.css` uguali a `redesign-premium-v2` | solo riferimento storico/preview; non sviluppare qui |

## Regola anti-duplicazione

Si modifica soltanto `case-study-001-foundation`. Prima del go-live:

1. collegare il branch al progetto Vercel canonico `la-barberia-sgarra`;
2. impostare Root Directory su `.`;
3. verificare il preview protetto;
4. promuovere quel deployment;
5. archiviare il progetto duplicato `la-barberia-sgarra-vqdz` soltanto dopo verifica e rollback disponibile.

Non copiare file tra i due progetti Vercel e non correggere direttamente la V4.2 pubblicata.
