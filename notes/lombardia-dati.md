# Lombardia — ricognizione open data

> Curation da deep research del **2026-06-09** (107 agenti, verifica adversariale, 21 claim confermati / 4 refutati).
> Probe live quella data. Riverificare prima di ogni release (le API italiane cambiano silenziosamente).
> Confidenza: ✅ probe live 3-0 · ⚠️ documentato/parziale · ❓ refutato.

La Lombardia è un buon territorio pilota proprio perché è il caso *peggiore* d'Italia per smog (rilevanza emotiva alta) e perché mette insieme **più piattaforme** (Socrata regionale + CKAN comunali + nazionali filtrate) — banco di prova onesto della frammentazione, non uno facile.

---

## 1. Hub regionale: dati.lombardia.it ✅

- Piattaforma **Socrata** (Tyler Technologies) — *non* gestito tecnicamente in casa da Regione Lombardia (claim "gestito direttamente" refutato 1-2).
- **~2.899 dataset** (~4.398 asset totali incluse viste/grafici/mappe).
- **API SODA** standard: `https://www.dati.lombardia.it/resource/{id}.json` con **ID formato 4x4** (8 caratteri alfanumerici, due gruppi di 4, es. `nicp-bhqi`). Parametri SoQL funzionanti (`$limit`, `$where`, `$order`…).
- **Discovery**: catalog API EU `https://api.eu.socrata.com/api/catalog/v1?domains=dati.lombardia.it` (`only=dataset` → 2899).
- Host alias: `hub.dati.lombardia.it` = stesso dominio SODA2.
- Region AWS: `aws-eu-west-1-prod`.

### ⚠️ Due insidie operative verificate
1. **Licenza NON uniforme**: molti dataset sono **CC0 1.0** (es. `nicp-bhqi`, `m2u2-frtq`), non IODL 2.0 come si assumeva. → leggere la licenza **per-dataset**, mai assumerla.
2. **Gli ID Socrata scadono**: un ID ritirato → HTTP 404 (es. `npva-smv6`, sopravvive solo come stub Foundry). → gli skill devono fare **discovery dinamica via catalog API**, mai hardcodare gli ID, e gestire i 404/ID stale.

### ❓ Refutato (non usare)
- La ripartizione dei dataset per 26 categorie con conteggi (Trasparenza 928, Ambiente 544, Sanità 251…) — **non confermata**.
- L'esistenza di un dataset-indice self-describing `8ask-gxyr` con campi `LINK_API`/`FREQUENZA_AGGIORNAMENTO` — **refutata** (usare la catalog API EU per la discovery).
- ARPA fornisce storici "solo via email" — **refutato**, il canale è dati.lombardia.it.

---

## 2. Dataset chiave per dominio (ID verificati ✅)

| Dominio | Dataset | ID | Note |
|---|---|---|---|
| **Ambiente — aria** | Dati sensori aria | `nicp-bhqi` | Misure orarie NOX/SO2/CO/O3/PM10/PM2.5/benzene da stazioni fisse. **Fresco near-real-time** (ultimo record a 1 giorno dalla richiesta). CC0. |
| | Stazioni qualità dell'aria | `ib47-atvt` | Anagrafica: idsensore, nomestazione, provincia, comune, lat/lng |
| | Stazioni aria NRT | `9xaz-9vbz` | Near-real-time |
| **Ambiente — acqua** | Qualità acque sotterranee | `48pe-a97y` | |
| **Trasporti** | Flussi Stazioni Ferroviarie | `m2u2-frtq` | Viaggiatori saliti/discesi + corse, misurati da Trenord (Contratto di servizio). **Copertura 2015-2023** (fermo). ~4.073 record, ~423 stazioni. CC0. |
| | Orario Ferroviario Regionale GTFS | `3z4k-mxz9` | GTFS |
| **Sanità** | Prestazioni Ambulatoriali | `d4mg-9zw3` | |
| | Dati ospedali | `avsh-7tmk` | |
| | ATS Regione Lombardia | `wwrk-2vck` | Anagrafica ATS |

> ⚠️ **ARPA Lombardia non ha un'API open separata**: pubblica direttamente su dati.lombardia.it. `arpalombardia.it` offre solo form di richiesta; rinvia esplicitamente a dati.lombardia.it "per grosse moli di dati".

---

## 3. Territorio / cartografia ✅

- **Geoportale Regione Lombardia** (`geoportale.regione.lombardia.it`): servizi OGC standard — **CSW** (ricerca catalogo), **WMS/WMTS** (visualizzazione), **WFS** (download feature). Conformi **INSPIRE**, fruibili da client esterni.

---

## 4. Open data comunali lombardi

| Comune | Portale | Piattaforma | Note |
|---|---|---|---|
| **Milano** ✅ | `dati.comune.milano.it` | **CKAN 2.8.12** | ~2.440 dataset (`package_list`). API `/api/3` (query a `/it/api/3/action/`). DataStore API: interrogazione dinamica senza scaricare file. |
| **Brescia** ✅ | `dati.comune.brescia.it` | **CKAN 2.11.3** | Online dal 2015. Stack: datastore, dcat, harvest, scheming. ⚠️ cert TLS misconfigurato (WebFetch fallisce, API funziona). |
| **Bergamo, Monza** ⚠️ | pubblicano (anche) via dati.lombardia.it | Socrata | `COMUNE-MONZA-elenco-dataset-pubblicati` `iksk-jz83`; Bergamo su `dati.lombardia.it/comune-bergamo` |
| Como, Pavia, Cremona, Mantova, Varese, Lecco, Sondrio | **non verificati** | — | da probare uno per uno |

> Insegnamento: anche dentro una sola regione convivono **Socrata (regione) + CKAN (comuni) + nazionali**. Niente "connettore unico".

---

## 5. Copertura nazionale filtrata su Lombardia

- **OpenCoesione** ✅: dataset territoriale dedicato `progetti_esteso_lom` (`opencoesione.gov.it/it/opendata/dataset/progetti_esteso_lom/`) + pagina territori `lombardia-regione`.
- **ANAC** ✅: `dati.anticorruzione.it/opendata/` (appalti enti lombardi filtrabili).
- **ISTAT / BDAP / OpenCUP**: ⚠️ non riverificati questo giro per la Lombardia — vedi `quadro-nazionale-dati.md` e CLAUDE.md §3.

---

## Domini Lombardia ancora da mappare (open questions)
- Distribuzione reale dei ~2.899 dataset per categoria (il breakdown è refutato).
- Sanità lombarda di dettaglio (liste d'attesa ATS-ASST — probabile trappola anche qui).
- Energia, agricoltura, istruzione, demografia, turismo, lavoro, sicurezza: dataset specifici non ancora verificati (mappare via catalog API EU per categoria).
- Comuni capoluogo minori (vedi tabella §4).

## Fonti chiave (verificate 2026-06-09)
- https://www.dati.lombardia.it/ · https://api.eu.socrata.com/api/catalog/v1?domains=dati.lombardia.it
- https://dev.socrata.com/foundry/www.dati.lombardia.it/nicp-bhqi
- https://www.geoportale.regione.lombardia.it/servizi-ogc
- https://dati.comune.milano.it/ · http://dati.comune.brescia.it/
- https://opencoesione.gov.it/it/opendata/dataset/progetti_esteso_lom/
