# dati.lombardia — qualità aria (PILOT) — nota fonte

**Tema**: qualità aria (pilota Lombardia). → `glossary.sensore_comune` + `mart.aria_misure`. Ingestor: `ingestors/aria.ts`.
**Piattaforma**: Socrata SODA. Registry `ib47-atvt`; misure storiche `g2hp-ar79` (2018→); misure anno corrente `nicp-bhqi`. Verificato 2026-06-29.
**Licenza**: CC0-1.0 per-dataset (verificare sempre per-dataset).

## Quirk

- ⚠️ **Dataset giusto per anno**: `nicp-bhqi` = SOLO anno corrente (2026→). Per il 2024 usare **`g2hp-ar79`** (storico, ~21 M righe). Cutover 2026-01-01 presente in entrambi → dedup.
- ⚠️ **Le misure non hanno il comune**: solo `idsensore`. Comune/inquinante/unità si prendono dal registry per `idsensore`. → costruire `glossary.sensore_comune` PRIMA.
- ⚠️ **Join comune per NOME** (il registry espone `comune` come nome, niente ISTAT): join su `geo.comuni.denominazione` **ristretto alla Lombardia** per evitare omonimie. Normalizzare apostrofi/accenti (`d'Adda`, `de'`, `sull'Adda`). ~33 sensori non matchano (stazioni fuori regione/nomi).
- **Filtro validità `stato='VA'`** — esclude già i `-9999` (`-9999` ⊂ `NA`). Non filtrare solo su `valore!=-9999`.
- **PM10 = `nometiposensore='PM10 (SM2005)'`** (stringa esatta con spazio e parentesi). `Particolato Totale Sospeso` è il TSP legacy, non PM10.
- Valori e id sono **stringhe** in JSON; `valore` decimale con `.`. `data` = `YYYY-MM-DDTHH:MM:SS.000` senza timezone (Europe/Rome); PM10 è giornaliero (`T00:00:00`).
- **Mai fetch senza filtro** su g2hp-ar79/nicp-bhqi: sempre `idsensore in(...)` + range `data`. Paginare con `$limit=50000`+`$offset`.
- ⚠️ **Valori operativi, NON certificati**: per cifre 2024 legalmente citabili esiste il rilascio *certificato* ARPA separato — da verificare come endpoint. Trattare i valori SODA come provvisori.
- Ingerito finora: PM10 2024 (g2hp-ar79) + corrente (nicp-bhqi) per ~92 sensori. Altri inquinanti: stesso schema, estendere.
