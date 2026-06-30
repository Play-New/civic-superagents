# OpenPNRR (Openpolis) — PNRR per comune — nota fonte

**Tema**: progetti PNRR **veri** (ReGiS-derived) per comune. → `mart.pnrr_progetto` + `mart.pnrr_progetto_comune`. Ingestor: `ingestors/pnrr.ts`.
**File** (verificati 2026-06-29, browser UA, licenza **ODbL-1.0**):
- `https://openpnrr.s3.amazonaws.com/media/progetti.csv` (~117 MB, 298k progetti, decimale `.`)
- `https://openpnrr.s3.amazonaws.com/media/progetti_territori.csv` (~27 MB, 351k loc, 342k a grana comune)
- lookup: `openpnrr.it/csv/{territori,misure,componenti,missioni}.csv`
**Join**: `progetti_territori.istat_id` dove `tipologia='C'` = `codice_istat` (identità). Join a `progetti` su `progetto_id`.

## Quirk

- ⚠️ **`stato` per-progetto NON disponibile** (ReGiS chiuso). Lo status esiste solo a livello *misura* (`misure.status`). Proxy: `is_in_regis` (booleano). Non inventare lo stato.
- ⚠️ **Importi NON ripartiti tra comuni**: un CUP localizzato in N comuni compare N volte in `progetti_territori`, ma l'importo vive una volta su `progetti`. `SUM(importo) GROUP BY comune` **sovrastima** i multi-comune → teniamo `pnrr_progetto` (importi) separato da `pnrr_progetto_comune` (junction). I totali per-comune nel verify includono i multi-comune per intero (dichiararlo).
- `tipologia` in `progetti_territori`: `C`=comune (342k), `P`/`R`/`CM`/`N` = altri livelli → **filtrare `C`**.
- **Decimale diverso per file**: `progetti.csv` punto (`23147.00`); `misure.csv` virgola tra virgolette (`"900000000,00"`). Parsare per-file.
- **CSV RFC-4180 quotato**: `titolo`/`descrizione`/`denominazione` hanno virgole dentro le virgolette → parser CSV vero (no split).
- `missione`/`componente` derivati da `codice_misura` (`M1C1I1.04.05` → `M1`, `M1C1`) via regex. `descrizione` in `progetti` è l'etichetta della *misura*, non del progetto → usiamo `titolo` per il nome intervento. Missioni M1-M7 (M7=REPowerEU).
- Carichiamo solo i progetti **localizzati a comune** (291.184 / 298.338). Verifica: Milano 4.748 progetti, Brescia 915, Bergamo 599.
- ⚠️ I CSV S3 sono datati **2025-09-04** (la pagina dichiara 2026-02): controllare `Last-Modified` prima di ogni refresh. Cross-check: OpenCUP PNRR (CC-BY, daily).
