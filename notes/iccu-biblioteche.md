# ICCU Anagrafe Biblioteche — nota fonte (cultura)

**Tema**: biblioteche per comune (l'unico wedge 🟢 pulito della cultura). → `mart.biblioteca_comune`. Ingestor: `ingestors/biblioteche.ts`.
**URL**: `https://opendata.anagrafe.iccu.sbn.it/biblioteche.zip` (ZIP → `biblioteche.json`, 19.598 biblioteche, ~32 MB). Verificato 2026-06-29. **Licenza CC0**, aggiornamento giornaliero.
**Join**: `indirizzo.comune.istat` = `codice_istat` (6 cifre), identità. Chiave `isil` 100% popolata e unica.

## Quirk

- **Preferire il JSON** (`biblioteche.zip`), non i CSV (`territorio.csv` è un subset di 13.717 righe, BOM, decimale virgola).
- **Due assi di tipologia** (ortogonali): `tipologia-funzionale` (Pubblica/Specializzata/Scolastica/Istituto sup./…) e `tipologia-amministrativa` (Comune/Università/Enti ecclesiastici/…). Il wedge "biblioteca pubblica comunale" = funzionale `Pubblica` + amministrativa `Comune`. Conserviamo entrambi.
- `NON SPECIFICATA` è un valore reale (non null) in entrambi gli assi.
- `coordinate` = `[lat, lng]` (lat prima), decimale punto; 24 record con `[]` vuoto → lat/lng NULL.
- 9 biblioteche con codice comune non nel nostro spine (cessati) → `comune_istat` NULL.
- Verifica: Milano 658 biblioteche, Brescia 89, Bergamo 82, Como 38. Chiave incrocio cross-dataset = ISIL.
