# geojson-italy (Openpolis) — nota fonte

**Cosa**: confini amministrativi italiani (comuni/province/regioni) in GeoJSON. Usato per popolare `geo.comuni`, la spina su cui fa join tutto il lake.
**Endpoint**: `https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_municipalities.geojson` (~38 MB).
**Snapshot ingerito**: 2026-06-29 → `raw/geojson_italy/2026-06-29/` · `meta.fonti#1`.
**Esito**: 7.899 comuni, tutti con geometria e `fonte_id`.

## Quirk

- ⚠️ **Licenza da verificare** sul repo openpolis prima di citare pubblicamente (registrata come "see repo" in `meta.fonti`).
- **Mapping proprietà → colonne**:
  - `com_istat_code` (string "001001") → `codice_istat` (PK, zero-pad a 6)
  - `com_istat_code_num` (int 1001) → `pro_com` (il codice numerico usato da **ISPRA** per il join IdroGEO)
  - `com_catasto_code` ("A074", Belfiore) → `codice_catastale`
  - `name` → `denominazione`; `prov_acr`/`prov_istat_code`/`prov_name`; `reg_istat_code`/`reg_name`
- **Geometria**: GeoJSON WGS84 → caricata con `ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(...),4326))` nella colonna `geometry(MultiPolygon,4326)`.
- **Il primo `"properties"` del file è il blocco CRS** (`{"name":"EPSG:4326"}`), non una feature — non confondersi parsando a mano.
- `popolazione` non è nel GeoJSON → resta NULL, da riempire con ISTAT (demografia).

## Riesecuzione

`npm run ingest:comuni` — idempotente (upsert su `codice_istat`).
