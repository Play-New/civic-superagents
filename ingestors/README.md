# ingestors/ — un modulo per fonte

Ogni fonte in [`manifest.yaml`](manifest.yaml) ha un ingestor che segue lo **stesso contratto in 5 passi**:

1. **fetch** — scarica dall'endpoint (browser User-Agent; alcune fonti lo richiedono, es. ANAC WAF).
2. **land** — salva lo snapshot **immutabile** in Storage `raw/<source>/<snapshot_date>/<file>`.
3. **load** — porta in staging Postgres (o trasforma con DuckDB se il file è pesante, es. OpenCUP 3.3 GB → aggrega a comune-anno prima del load).
4. **upsert** — scrive nelle tabelle `mart.*` comune-keyed, risolvendo il comune via `geo.comuni` (codice_istat / pro_com / catastale).
5. **provenance + nota** — inserisce una riga in `meta.fonti` e scrive/aggiorna `notes/<source>.md` con i quirk osservati.

## Invariante

Nessuna riga `mart.*` senza `comune_istat` **e** `fonte_id`. Se un valore non risale a una fonte immutabile, non entra (citation policy, CLAUDE.md §5).

## `_framework/`

Codice condiviso (da costruire dopo la connessione Supabase):
- `download.ts` — fetch + snapshot datato in Storage
- `supabase.ts` — client (service role da env, mai committato)
- `provenance.ts` — writer di `meta.fonti`
- `comuni.ts` — resolver nome/pro_com/catastale → codice_istat

## Esecuzione

Locale: `npm run ingest <source-id>`. In CI: GitHub Actions cron (cadenza per fonte dal manifest), secret `SUPABASE_SERVICE_ROLE_KEY`.

> Stato: contratto definito. L'implementazione runnable parte appena il progetto Supabase è connesso (vedi handoff).
