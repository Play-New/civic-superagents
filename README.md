# Civic SuperAgents — data lake + mappa open data civici

Commons di skill AI civici e **data lake** sugli open data pubblici italiani, **comune-keyed**, con uno strato agentico (MCP) che rende ogni comune leggibile in italiano naturale — ogni dato ancorato a una **fonte citabile**.

> Sintesi pubblica → [`civic-superagents.md`](civic-superagents.md) · **mappa verificata delle fonti** → [`notes/mappa-open-data-civici.md`](notes/mappa-open-data-civici.md).

## Stato

Data lake su **Supabase** (Postgres + Storage + PostGIS). **16 sistemi-fonte / 17 dataset**, **oltre 1,9 M righe**, prevalentemente **nazionali** (l'aria copre i ~comuni con centralina, per natura del dato). Strato serving via **MCP** con **11 tool** (eseguibile in locale o deployabile come server HTTP — vedi [`mcp/`](mcp/README.md)). Provenance per ogni dato (`meta.fonti` → file immutabile in Storage `raw/`).

## Cosa c'è nel lake

| Tema | Fonte | Tabella `mart.*` | Copertura |
|---|---|---|---|
| Rischio frane/alluvioni | ISPRA IdroGEO | `idrogeo_comune` | 🇮🇹 7.896 comuni |
| Rifiuti / differenziata | ISPRA Catasto Rifiuti | `rifiuti_comune_anno` | 🇮🇹 2020-24 |
| Consumo di suolo | ISPRA | `consumo_suolo_comune` | 🇮🇹 7.890 |
| Qualità aria (PM10) | EEA (sintesi annuale) · ARPA Lombardia (pilota) | `aria_comune_anno` · `aria_misure` | comuni con centralina |
| Edilizia scolastica | MIUR | `scuola_edificio` | 🇮🇹 39.331 edifici |
| Popolazione / demografia | ISTAT SDMX | `geo.comuni.popolazione` | 🇮🇹 7.890 |
| Spesa per **missione** | BDAP FET Rendiconto | `bilancio_comune` | 🇮🇹 2024 (99%) |
| Appalti (chi vince) | ANAC | `appalto` | 🇮🇹 2024, ~313k (≥ €40k) |
| Fondi di coesione | OpenCoesione | `progetto_coesione` (+`_comune`) | 🇮🇹 2021-27, 171k progetti |
| PNRR | OpenPNRR | `pnrr_progetto` (+`_comune`) | 🇮🇹 291k progetti |
| Chi governa | Min. Interno DAIT | `amministratore_comune` | 🇮🇹 115k |
| Cultura — biblioteche | ICCU | `biblioteca_comune` | 🇮🇹 19.598 |
| Acque — balneazione | EEA/WISE (EMODnet) | `balneazione_sito` | 🇮🇹 siti costieri/lacustri |
| Energia — CER | GSE | `cer_comune` | 🇮🇹 751 comuni |
| Welfare — asili nido | ISTAT SDMX | `welfare_comune` | 🇮🇹 7.898 |

## Lo strato agentico

`mcp/` espone il lake come **11 strumenti civici** (vedi [`mcp/README.md`](mcp/README.md)) — la narrazione in *italiano civico* la fa l'agente, il data layer restituisce dati citati:
- **`cerca_comune`** / **`leggi_comune`** — risolve un comune e ne dà il profilo civico completo (ambiente · scuola · cultura · welfare · energia · **bilancio per missione** · appalti · fondi coesione+PNRR · **gemelli** finanziari · chi governa), ogni numero con la sua **fonte**.
- **`progetti_comune`**, **`confronta_comuni`**, **`classifica`**, **`appalti_comune`** — query mirate sui mart.
- **`helper_foia`** — bozza di accesso civico con i riferimenti normativi.
- **`domande_da_verificare`/`firma_risposta`** e **`fonti_da_verificare`/`verifica_licenza`** — revisione umana del test set e delle licenze.

```bash
npm run mcp          # server MCP (stdio, locale)
npm run start:http   # server MCP (Streamable HTTP) — proteggi /mcp con MCP_AUTH_TOKEN
```

Registrazione locale in Claude Code:
```bash
claude mcp add civic-superagents -- npx tsx /ABS/PATH/civic-superagents/mcp/stdio.ts
```

È attiva anche un'istanza HTTP (Streamable HTTP) su **`https://civic.playnew.com/mcp`** — accesso protetto da bearer token:
```bash
claude mcp add --transport http civic-superagents https://civic.playnew.com/mcp --header "Authorization: Bearer <token>"
```
Per Claude Desktop, claude.ai e Messages API → [`mcp/README.md`](mcp/README.md#collegarsi-allistanza-live-per-client).

## Licenze delle fonti

Ogni fonte è stata verificata (con URL di prova). Riuso libero **citando la fonte**; due fonti sono **share-alike**.

| Fonte | Licenza |
|---|---|
| ISPRA — IdroGEO, Catasto Rifiuti, Consumo di suolo | CC-BY-4.0 |
| ISTAT — popolazione, servizi prima infanzia | CC-BY-4.0 |
| ANAC — appalti | CC-BY-4.0 |
| Min. Interno DAIT — amministratori | CC-BY-4.0 |
| OpenCoesione — progetti coesione | CC-BY-4.0 |
| EEA — aria PM10, balneazione (via EMODnet) | CC-BY-4.0 |
| Openpolis geojson-italy — confini (da ISTAT) | CC-BY-4.0 |
| MIUR — edilizia scolastica | IODL-2.0 (≈ CC-BY) |
| BDAP / MEF-RGS — rendiconti | CC-BY-3.0 |
| dati.lombardia (ARPA) — aria · ICCU — biblioteche | CC0-1.0 |
| **OpenPNRR** — progetti PNRR | **ODbL-1.0** ⚠️ *share-alike* |
| **GSE** — comunità energetiche | **CC-BY-SA-3.0-IT** ⚠️ *share-alike* |

> ⚠️ Il dataset **combinato** include due fonti **share-alike** (OpenPNRR ODbL-1.0, GSE CC-BY-SA-3.0-IT): le elaborazioni derivate vanno ricondivise con la stessa licenza e il lake **non è ridistribuibile come CC0**. Vanno sempre attribuite tutte le fonti usate (la `leggi_comune` espone `fonti` per ogni profilo).
>
> **Questo repo**: codice **EUPL-1.2**, prompt e documentazione **CC-BY-SA-4.0** (vedi [`LICENSE`](LICENSE) e [`LICENSES/`](LICENSES/)). I *dati* restano sotto le licenze delle rispettive fonti, qui sopra.

## Struttura

```
supabase/      progetto Supabase: config.toml + migrations/ (geo · meta · glossary · mart)
ingestors/     un modulo per fonte (fetch → land Storage → load → upsert mart → nota) + manifest.yaml
  _framework/  download · storage · provenance · util (parser IT, normName, bulkUpsert)
mcp/           server MCP (11 tool) — read-only via SUPABASE_DB_URL_READONLY (ruolo civic_serve)
glossary/      lookup JSON curati
notes/         mappa consolidata + una nota per fonte (quirk operativi)
tests/         questions.jsonl — 16 domande civiche con risposta verificata a mano
rfc/ · LICENSE · CONTRIBUTING.md · LICENSES/   governance RFC-style, EUPL-1.2 + CC-BY-SA-4.0
```

## Principi non negoziabili

- **Citation policy dura**: ogni numero → riga `meta.fonti` → file immutabile in `raw/`. Senza fonte non si risponde.
- **Il comune è la chiave**: tutto fa join su `geo.comuni` (ISTAT / pro_com / catastale / PostGIS).
- **Trappole dichiarate**: liste d'attesa, acqua potabile, ritardi treni, criminalità comunale → *"non pubblicato"*, mai promesse.
- **Le API italiane cambiano in silenzio** → riverificare la liveness delle fonti prima di ogni release.

## Setup

`.env` da [`.env.example`](.env.example) (Supabase: URL, service-role key, **pooler** `SUPABASE_DB_URL`). Poi `supabase db push`, `npm run ingest:wedges` / `ingest:money`, `npm run verify`, `npm run mcp`. Dettagli in `ingestors/README.md`.

> ⚠️ Le API pubbliche italiane cambiano spesso e in silenzio: riverificare la liveness delle fonti prima di qualsiasi ridistribuzione. I valori dell'aria sono operativi, non certificati.
