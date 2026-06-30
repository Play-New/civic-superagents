# EEA — qualità aria PM10 nazionale — nota fonte

**Tema**: PM10 sintesi annuale per comune (estende l'aria oltre il pilota Lombardia). → `mart.aria_comune_anno`. Ingestor: `ingestors/aria_nazionale.ts` + helper `_aria_parquet.py`.
**Fonti EEA** (verificate 2026-06-30):
- Misure: `POST https://eeadmz1-downloads-api-appservice.azurewebsites.net/ParquetFile/urls` (countries=IT, pollutant=5=PM10, **dataset=2** = E1a verificato 2013-2024) → 809 file Parquet (1 per sampling-point).
- Registro stazioni (coord): `discomap.eea.europa.eu/App/AQViewer` (GET `/init` → POST `/download?...&f=csv` con `RequestFilter` Country=Italy, AirPollutant=PM10) → `DataExtract.csv` (Sampling Point Id, Longitude, Latitude, WGS84).

## Quirk

- **Parquet schema**: `Samplingpoint, Pollutant, Start, End, Value(decimal), Unit, AggType, Validity, Verification, ...`. Filtrare **`AggType='day'`** (media giornaliera PM10) + **`Validity>0`**. `Value` = decimal128 → cast float.
- **Lettura Parquet**: `_aria_parquet.py` (pyarrow, 24 thread) aggrega i 809 file all'anno 2024 per sampling-point (media, giorni>50, n giorni validi). DuckDB non disponibile in questo ambiente → pyarrow.
- **Join Parquet↔registro**: `Samplingpoint` (con prefisso `IT/`) → togliere `IT/` → `Sampling Point Id` del registro. (439 sampling-point con dato 2024, tutti matchati alle coord.)
- **comune via spatial join** (`ST_Contains` su coord stazione, WGS84). Le stazioni cadono su terra → join robusto. **300 comuni** hanno una stazione PM10.
- ⚠️ **Copertura sparsa per natura**: il monitoraggio aria non è capillare → solo ~300 comuni (quelli con stazione), non tutti i 7.899. È il limite intrinseco del dato, non dell'ingest.
- Grana sintetica: `media_annua` (media delle medie-stazione), `giorni_sforamento_max` (stazione peggiore; limite UE 35/anno, dir. 2008/50/CE).
- Verifica: Milano 72 gg sforamento, Roma 27, Napoli 57, Torino 55, Como 23 (2024). NB: l'EEA è il dato *verificato* E1a; il pilota `mart.aria_misure` (dati.lombardia) è operativo → piccole differenze attese.
- `dati.lombardia` (`mart.aria_misure`) resta per il dettaglio giornaliero lombardo; `leggi_comune` usa la sintesi nazionale `aria_comune_anno`.
