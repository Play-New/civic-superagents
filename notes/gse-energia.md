# GSE — comunità energetiche (CER) — nota fonte (energia)

**Tema**: comunità energetiche rinnovabili per comune. → `mart.cer_comune`. Ingestor: `ingestors/energia.ts`.
**URL**: `https://www.gse.it/servizi-per-te_site/autoconsumo_site/Documents/Elenco%20Comunit%C3%A0%20Energetiche%20Rinnovabili.xlsx` (904 configurazioni, ~100 KB). Verificato 2026-06-29. Pagina: `gse.it/servizi-per-te/autoconsumo/elenco-delle-configurazioni`.
**Join**: NESSUN codice ISTAT → **spatial join** via `Latitudine`/`Longitudine` (decimale virgola) su `geo.comuni.geom` (`ST_Contains`). 904/904 georeferenziate → 751 comuni.

## Quirk

- XLSX, 13 colonne: `Tipologia di configurazione | Denominazione Comunità | Potenza totale (kW) | Numero impianti | Numero utenze | Comune | Provincia | Regione | Latitudine | Longitudine | ...`. Decimale **virgola** (anche lat/lng).
- Comune/Provincia in MAIUSCOLO con apostrofi → ecco perché si usa il **join spaziale** (più robusto del nome). Fallback nome+provincia possibile.
- 5 file di configurazioni (CER, gruppi autoconsumatori, autoconsumatori a distanza, gruppi clienti attivi, clienti a distanza). Carichiamo solo la **CER vera** (file #1). UNION dei 5 = tutte le CACER.
- 0 configurazioni in un comune = normale (es. Brescia città).
- ⚠️ **Impianti rinnovabili TUTTI per comune NON disponibili in bulk aperto**: GSE Atlaimpianti è una SPA WebGIS oggi **offline** ("in fase di aggiornamento"); Atlasole idem; Terna Download Center è solo **provinciale** (richiede token). → `mart.impianti_comune` rinviato; per ora solo le CER. Onestà: dichiararlo.
- Aggiornamento GSE periodico (stesso URL sovrascritto; ref dato 31/12/2025).
