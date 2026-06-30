# ISTAT SDMX — popolazione residente — nota fonte

**Tema**: popolazione residente per comune. → `geo.comuni.popolazione` (+ `popolazione_anno`, `popolazione_fonte_id`). Ingestor: `ingestors/istat_popolazione.ts`.
**Endpoint**: `https://esploradati.istat.it/SDMXWS/rest/v2/data/dataflow/IT1/22_389/1.0/A.*.JAN.9.TOTAL.99` (SDMX v2, CSV ~1,36 MB). Verificato 2026-06-29. Licenza CC-BY (ISTAT).
**Join**: `REF_AREA` = `codice_istat` (6 cifre), identità.

## Quirk

- ⚠️ **L'API 500a da Node/undici** (WAF su esploradati, server Java FusionRegistry) ma **funziona via `curl`** → l'ingestor shella `curl`. Bug non legato al wildcard (anche il singolo comune 500a da fetch).
- **Usare v2** (`/rest/v2/`): in v2 NON esistono `startPeriod`/`endPeriod` (422); per l'ultimo anno usare `lastNObservations=1`. Il bug off-by-one di v1 non ci riguarda.
- ⚠️ **OR `+` rotto** su esploradati (200 con 0 byte): batchare comuni con `A.x+y+...` non funziona → usare il wildcard `A.*` (un'unica chiamata, tutti i comuni) o un comune per richiesta.
- Campi CSV: `REF_AREA`(4), `TIME_PERIOD`(9), `OBS_VALUE`(10), `OBS_STATUS`(11). Filtrare `REF_AREA` con `^\d{6}$` (la codelist CL_ITTER107 contiene anche province/regioni/NUTS).
- **L'ultimo anno può essere una STIMA** (`OBS_STATUS=e`, es. 2026); 2025 è definitivo. Salviamo `popolazione_anno` → il disclaimer può dire "stima al 1° gennaio {anno}". Si prende il `max(TIME_PERIOD)` per comune.
- Monza: in CL_ITTER107 esistono sia `015149` (vecchio, prov. Milano pre-2009) sia `108033` (attuale, prov. MB) — i dati usano `108033`, corretto.
- 7.890/7.899 comuni del nostro spine ottengono la popolazione.
- Dataflow alternativo `22_289` (serie completa, ~5,4 MB); per età → `DF_DCSS_POP_DEMCITMIG_TV_1` (censuario, classi quinquennali, base 2024).
