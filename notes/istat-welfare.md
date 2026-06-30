# ISTAT — servizi prima infanzia / asili nido — nota fonte (welfare)

**Tema**: asili nido / servizi educativi prima infanzia per comune. → `mart.welfare_comune`. Ingestor: `ingestors/welfare.ts`.
**Dataflow**: `IT1:47_850_DF_DCIS_SERVSOCEDU1_3` ("Servizi offerti dai comuni — prov. e com."). SDMX v2, granularità **comune**. Verificato 2026-06-29.
**Join**: `REF_AREA` = `codice_istat` (6 cifre), identità.

## Quirk

- ⚠️ **curl, non Node fetch** (WAF esploradati 500a undici). Serve **`curl -g`** (le parentesi di `c[TIME_PERIOD]=2023` non vanno globbate).
- ⚠️ **OR-list `+` ROTTO** su esploradati per questo dataflow (200 con 0 byte) → **una query per indicatore** (non `P_100CH+AUTP+EXPMUN`).
- Chiave dimensioni: `FREQ.REF_AREA.DATA_TYPE.TYPE_SOCIO_EDUC_SERVICE.TYPE_MANAGEMENT.HOLDER_SECTOR` → `A.*.{DATA_TYPE}.DNUR.ALL.9`. Servizio `DNUR` = nidi + sezioni primavera.
- Indicatori caricati (DATA_TYPE → label): `P_100CH_Y0_2`→posti per 100 bambini 0-2 (cardine), `AUTP`→posti autorizzati, `EXPMUN`→spesa dei comuni (€). Anno 2023 (ultimo).
- SDMX-CSV: separatore `,`, UTF-8, decimale punto. Campi: `REF_AREA`(5), `DATA_TYPE`(6), `TIME_PERIOD`(10), `OBS_VALUE`(11).
- `P_100CH_Y0_2` **può superare 100** (piccoli comuni: posti > bambini residenti / pendolarismo iscrizioni) — outlier reale, non scartare.
- `CL_ITTER107` contiene comuni soppressi (~9.300 codici) → i no-match con lo spine si scartano. Caricati 7.898 comuni.
- Verifica: Milano 48 posti/100, Brescia 33,6, Como 51,5 (2023). Serie storica 2013-2023 disponibile (`c[TIME_PERIOD]=ge:2013`).
