# EEA/WISE Balneazione (via EMODnet) — nota fonte (acque)

**Tema**: stato delle acque di balneazione per sito → comune. → `mart.balneazione_sito`. Ingestor: `ingestors/balneazione.ts`.
**Risolve il gap acque**: il Portale Acque del Min. Salute è SPA-only (refutato come fonte machine-readable). EMODnet è il mirror EEA/WISE georeferenziato e scaricabile.
**URL**: `https://ows.emodnet-humanactivities.eu/geonetwork/srv/api/records/8d85660c-7930-40dc-8733-96abdcf4bca7/attachments/EMODnet_HA_Environment_StatusBathingWater_20260116.zip` (~9,5 MB, browser UA). Verificato 2026-06-29. **Licenza CC-BY 4.0**.

## Quirk

- ⚠️ **Ultimo anno utile = 2024** (il 2025 esiste come "pubblicazione" ma non è ancora nei mirror machine-readable — 16 righe spurie). Non promettere il 2025.
- Lo zip ha 2 file uniti: **CSV** stato (`...BathingWaterStatus_YYYYMMDD.csv`, `;`, colonne `OBJECTID;BATHINGWATERIDENTIFIER;YEAR;STATUS`) + **shapefile** siti (`...BathingWaterSites_*.{shp,dbf}`, WGS84/4326, campi dbf troncati a 10 char: `bathingWat`, `name`, `lat`, `lon`). Carichiamo **entrambi** (lib `shapefile`): nome + coord + stato.
- **comune_istat via spatial join** (`ST_Contains` su `geom`, ground truth) con **fallback al codice ISTAT incorporato** nel `BATHINGWATERIDENTIFIER`: `IT` + regione(3) + provincia(3)+comune(3) + seq(3) → `substring(5,11)`. Es. `IT003013075002` → `013075` (Como). ⚠️ Molti siti sono **in acqua** (offshore/lago) → fuori dai poligoni comunali → solo ~1.700/5.538 risolti per spatial, il resto via codice incorporato (corretto). Codici non nel nostro spine → `comune_istat` NULL.
- `STATUS` = stringa enumerata: `1 - Excellent`, `2 - Good`, `3 - Sufficient`, `3 - Good or Sufficient`, `4 - Poor`, `0 - Not classified`, `Closed`, `Insufficiently Sampled` (parsare sul token, non sul solo numero).
- **0 siti = comune senza acque di balneazione designate** (Milano/Brescia landlocked) → normale, non errore. Como 2 siti (lago), Rimini 17 (costa).
- `nome`/`lat`/`lng` per ora NULL (nello shapefile `.dbf`/`.shp`, CRS WGS84/4326 → join PostGIS futuro). 5.538 siti IT, storico 1990-2024.
- EEA primario `sdi.eea.europa.eu/data/<uuid>` = Nextcloud SPA (no file diretto) → usare EMODnet.
