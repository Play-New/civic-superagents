# MIUR Edilizia Scolastica — nota fonte

**Tema**: edilizia scolastica (agibilità, antincendio, zona sismica) per edificio. → `mart.scuola_edificio`. Ingestor: `ingestors/scuola.ts`.
**File**: 3 CSV su `https://dati.istruzione.it/opendata/opendata/file/<FILENAME>`. Verificato 2026-06-29. Licenza IODL-2.0.
- `EDIANAGRAFESTA202120242520250806.csv` — edificio→comune
- `EDICONSICUREZZASTA202120242520250806.csv` — agibilità + antincendio
- `EDIVINCOLISTA202120242520250806.csv` — zona sismica

**Join**: i 3 file su **`CODICEEDIFICIO`** (text, 10 char, zero-pad — **mai int**). 100% overlap (39.351 edifici). `CODICECOMUNE` (solo in ANAGRAFE) = 6 cifre = `codice_istat`.

## Quirk

- ⚠️ **Token nel filename** `202120242520250806` = copertura a.s. 2021-2024, snapshot 2025-08-06. Cambia a ogni ripubblicazione → **riscoprire il filename dal catalogo** (`?area=Edilizia+Scolastica`) prima di ogni run; il path `/file/` è stabile.
- ⚠️ **Grain duplicato**: 60.030 righe / 39.351 edifici (grain = scuola × edificio) → **dedup a CODICEEDIFICIO distinto** (attributi costanti per edificio).
- ⚠️ **Booleani a 4 valori**: `SI`/`NO`/`IN PARTE`/`NON DEFINITO` → map `SI→true`, `NO→false`, **`IN PARTE`/`NON DEFINITO`→NULL** (non forzare a false).
- Campi: agibilità = `CERTIFICATOSEGNALAZIONEAGIBILITA`; antincendio = `CERTIFICATOPREVENZIONEINCENDI`; sismica = `CLASSIFICAZIONESISMICANAZIONALE` (1-4, 1=rischio max; di fatto per-comune ma registrata per-edificio).
- **Niente nome edificio**: `denominazione` resta NULL (MIUR ha solo nome comune/indirizzo). `collaudo statico` come campo distinto **non esiste** → si usa l'agibilità.
- Encoding **UTF-8** (non latin1), line endings **CRLF** (strippare `\r`). Le colonne target sono le prime → split su `,` sicuro nonostante virgole annidate negli indirizzi (colonne successive).
- `CODICECOMUNE` solo in ANAGRAFE; gli altri due file joinano via CODICEEDIFICIO. ~20 edifici con comune non nel nostro spine → skip.
