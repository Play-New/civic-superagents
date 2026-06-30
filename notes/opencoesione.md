# OpenCoesione — nota fonte

**Tema**: progetti finanziati dai **fondi di coesione** per comune. → `mart.progetto_coesione` + `mart.progetto_comune`. Ingestor: `ingestors/opencoesione.ts`.
**URL**: `https://opencoesione.gov.it/it/opendata/regioni/progetti_esteso_LOM_2021-2027.zip` (ciclo 2021-2027, ~piccolo; segue 302 → `/media/...`). Verificato 2026-06-29. Licenza **CC-BY 4.0**, aggiornamento bimestrale.

## Quirk

- ⚠️ **NON è PNRR.** `progetti_esteso_LOM` = fondi di coesione (FSE/FESR/FSC/POC/IOG/FEASR/CTE/SNAI/ORD). `OC_AMBITO` non ha mai `PNRR`. Il PNRR vero sta in **OpenPNRR** (`openpnrr.it/opendata/`) / Italia Domani → ingestor separato (Fase 3). Non promettere PNRR da questa fonte.
- ⚠️ **Grain = `COD_LOCALE_PROGETTO`** (un progetto per riga), NON CUP (un CUP ricorre su molti progetti → keyare su CUP raddoppia gli importi). Mart keyato su `cod_locale`.
- **`COD_COMUNE` = `003` + 6 cifre ISTAT** → `right(,6)`. Progetti multi-comune: lista separata da `:::` (es. `003019036:::003020030`). Esplodiamo in `progetto_comune`.
- ⚠️ **Gli importi sono totali di progetto, NON ripartiti tra comuni** → sommare per comune sovrastima i multi-comune (157 nel file). `progetto_coesione.n_comuni` segnala quanti comuni tocca; gli importi vivono una sola volta sul progetto.
- **Solo ~6.651/56.434 progetti sono geolocalizzati a comune** (il resto è provinciale/regionale, tipico FSE) → 8.017 link comune. È corretto, non un bug.
- CSV (dentro lo zip): separatore `;`, campi quotati, **decimale virgola** (`1221,72`), niente separatore migliaia, 202 colonne → leggere per **nome colonna** (header), non per posizione.
- Campi → mart: `OC_TITOLO_PROGETTO`→titolo, `OC_DESCRIZIONE_PROGRAMMA`→programma, `OC_AMBITO`→ambito, `FINANZ_TOTALE_PUBBLICO`→importo_finanziato, `TOT_PAGAMENTI`→importo_pagato, `OC_STATO_PROGETTO`→stato.
- Nazionale (fan-out): `progetti_esteso.parquet` (~248 MB, preferire parquet).
