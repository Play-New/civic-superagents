# Mappa degli open data civici italiani — consolidata

> **Refresh liveness: 2026-06-29** (probe read-only, browser UA). Questo file è la **mappa di testa** del progetto: consolida e aggiorna i tre deep-dive (`quadro-nazionale-dati.md`, `temi-civici-mappa.md`, `lombardia-dati.md`) con la verifica più recente e i due temi prima scoperti (cultura, governo).
> Confidenza: ✅ probe live · ⚠️ cambiato/parziale · ❌ rotto/chiuso. **Le API italiane cambiano in silenzio: riverificare prima di ogni release** (CLAUDE.md §11.2).
> Versione macchina-leggibile → [`../ingestors/manifest.yaml`](../ingestors/manifest.yaml).

---

## 1. Verdetto di liveness (tutte le fonti, 2026-06-29)

| Fonte | Verdetto | Il fatto che conta | Δ vs probe mag/giu |
|---|---|---|---|
| **OpenBDAP** (MEF-RGS) | ✅ | `/SpodCkanApi/api/1/rest/dataset` → **3.831 dataset**. `/api/3/` 404; `q=` rotto → paginare client-side | ⬆ +58 |
| **OpenCUP** bulk ZIP | ✅ | Niente REST. `Complessivo` **3,32 GB** (Last-Modified 2026-06-05); per-area scaricabili no-auth | stabile; `/portale/` ora 301 |
| **ANAC** | ✅ | `dati.anticorruzione.it/opendata/api/3/action/package_list` → **70 package**. Browser UA obbligatorio (WAF) | più ricco del documentato |
| **IPA Indice PA** | ✅ | CKAN 2.9.8, **27 package**, CC-BY-4.0, aggiornato **oggi** (daily) | stabile |
| **OpenCoesione** | ✅ | aggregati: **1.826.394 progetti / €358,35 mld**, snapshot 2026-02-28; bulk LOM ~86 MB | ⬆ un trimestre |
| **Soldipubblici** | ❌ | Ancora 302 → `manutenzione.agid.gov.it`. Proxy: BDAP `pagamenti_bilancio_dello_stato` | morto da maggio |
| **ISTAT SDMX v1** | ✅ | `esploradati.istat.it/SDMXWS/rest/dataflow/` → **4.876 dataflow**. Bug off-by-one su `endPeriod` ancora vivo | +5 |
| **ISTAT SDMX v2** | ⚠️→✅ | `/rest/v2/structure/dataflow/` ora dà **SDMX-JSON 2.0 pulito** — prima "non implementato" | **ora usabile → default MVP** |
| **dati.gov.it** (AgID) | ✅ | `/opendata/api/3/action/package_search` → **65.078 dataset**. Prefisso `/opendata/` obbligatorio | -88 (fisiologico) |
| **RNDT / geodati** | ✅ | `dati.gov.it/geodati` è gateway; il catalogo vero è `geodati.gov.it` | raggiungibile |
| **geojson-italy** (Openpolis) | ✅ | confini regioni/province/comuni tutti 200 (comuni ~38 MB) | invariato |
| **ISPRA IdroGEO** | ✅ | `idrogeo.isprambiente.it/api` REST/JSON per-comune (pro_com). **7.899 pir / 7.904 iffi**. API code AGPL-3.0 | ver 2.0.0-dev.142 |
| **ISPRA Catasto Rifiuti** | ✅ | `getDettaglioComunale.csv.php?aa=2024` → CSV per-comune con % RD. **2024 ultimo utile; 2025 vuoto** | anno chiarito |
| **ISPRA Consumo di suolo** | ⚠️ | Vecchio `/i-dati` → **404**. Nuovo URL (vedi manifest). Ed. 2025, dati al 2024, per-comune XLSX+shp | **URL da sostituire** |
| **dati.lombardia** (Socrata) | ✅ | SODA, **2.901 dataset**. Aria `nicp-bhqi` real-time, CC0. Filtro `stato=VA`, scarta `-9999` | stabile |
| **MIUR scuola** (`dati.istruzione.it`) | ✅ | SPARQL (path lungo) + bulk CSV/JSON/RDF/XML, IODL-2.0, fino all'**edificio** | intatto |
| **Min. Salute** (`dati.salute.gov.it`) | ⚠️ | **NON CKAN** — Drupal custom. `/api/3/action` 404. Bulk diretto `/sites/default/files/opendata/FILE_YYYYMMDD.csv` | correzione accesso |
| **AGENAS PNE** | ⚠️ | Non più solo-dashboard: CSV/Excel per-vista + PDF, ma **SPA-gated, niente bulk/REST** | meglio del documentato |
| **PNLA liste d'attesa** | ❌ | Solo cruscotto, nessun download/API, non su roadmap | 🔴 trappola confermata |
| **MIT** (`dati.mit.gov.it`) | ⚠️ | **503 manutenzione oggi** (intero portale). È CKAN vero con GTFS + incidenti. **Riprobare** | outage transitorio |
| **MiC cultura** (`dati.cultura.gov.it`) | ⚠️ | ex `dati.beniculturali.it`. **DKAN non CKAN** — `/api/3/action`, `/data.json` 404. Solo SPARQL (`/sparql` 200) o scrape | nome+piattaforma cambiati |
| **ICCU Anagrafe Biblioteche** | ✅ | Bulk ZIP (`opendata.anagrafe.iccu.sbn.it/*.zip`), **CC0, daily**, per-biblioteca geocodato (ISIL→comune) | l'unico wedge pulito cultura |
| **Normattiva OpenData** | ⚠️ NEW | `dati.normattiva.it` + `api.normattiva.it`, **CC-BY-4.0, in produzione 01/01/2026**, Akoma Ntoso+JSON | **NUOVO** vs §3 ("no API") |
| **Openpolis api3** | ❌ | `api3.openpolis.io` = **NXDOMAIN**. Migrato a **OPDM** `service.opdm.openpolis.io` (10k req/giorno free) | endpoint morto → sostituire |
| **Min. Interno Eligendo** | ⚠️ | `elezioni.interno.gov.it/opendata` = "servizio sospeso". Usare `elezionistorico.interno.gov.it` + `dait.interno.gov.it/elezioni/open-data` | spostato |
| **DAIT Anagrafe Amministratori** | ✅ | `dait.interno.gov.it/elezioni/open-data` → **41 dataset**, per-comune, "in carica" agg. 2026-06-06 | fonte forte "chi governa" |
| **Camera / Senato SPARQL** | ✅ | `dati.camera.it/sparql` + `dati.senato.it/sparql` (Virtuoso) | confermato |
| **GSE Atlaimpianti / CER** | ✅ | Atlaimpianti per-impianto (~790k); **Configurazioni CER per comune/prov/reg** | CER-a-comune confermato |
| **Terna Driving Energy** | ✅ | `dati.terna.it` + REST API; regione/zona/provincia, non comune | API confermata |
| **INPS Open Data** | ⚠️ | NON `dati.inps.it` (host 000). Base reale **`serviziweb2.inps.it/odapi/`**, CKAN-aligned, **2.323 dataset**, IODL-2.0 | correzione host |
| **EEA Bathing Water** | ✅ | Datahub v2025 (pub. 2026-06-02), per-sito georef → comune. Excel+shp+SQL | risolve gap acque-balneazione |
| **EEA Air Quality download** | ✅ | servizio download (Italia presente), Parquet per sampling point | fallback nazionale all'ARPA |
| **Acqua potabile (AnTeA/ISS)** | ❌ | Nessuna fonte aperta machine-readable per-comune. AnTeA annunciato, non online | 🔴 confermato |

---

## 2. Matrice temi × dato (wedge 🟢 / genesis 🟡 / trappola 🔴 + citabilità al comune)

### 🟢 Wedge — salienza alta + dato forte e citabile (si parte da qui)
| Tema | Fonte | Citabile al comune? |
|---|---|---|
| **Qualità aria** | dati.lombardia (pilota) + EEA download (nazionale) | ✅ stazione→comune |
| **Rischio frane/alluvioni** | ISPRA IdroGEO REST | ✅ per-comune |
| **Rifiuti / differenziata** | ISPRA Catasto Rifiuti (2024) | ✅ per-comune |
| **Consumo di suolo** | ISPRA consumo suolo (ed. 2025, dati 2024) | ✅ per-comune |
| **Scuola / edilizia scolastica** | MIUR dati.istruzione.it | ✅ fino all'edificio |
| **Demografia** | ISTAT SDMX v2 | ✅ per-comune |
| **Energia / CER** | GSE Atlaimpianti + Configurazioni CER | ✅ per-comune |
| **Welfare / asili nido** | ISTAT (servizi prima infanzia) + INPS | ✅/⚠️ (verificare dim. territoriale nel DSD) |
| **Acque — balneazione** | EEA WISE | ✅ sito→comune |
| **Cultura — biblioteche** | ICCU Anagrafe Biblioteche | ✅ ISIL→comune |
| **Governo — chi governa** | DAIT Amministratori + Eligendo storico | ✅ per-comune |

### 🟡 Genesis — dato forte ma illeggibile (il valore è renderlo civico)
| Tema | Fonte | Nota |
|---|---|---|
| **Spesa / bilanci** | BDAP | il cuore originale; serve glossario SIOPE. Soldipubblici morto |
| **Appalti** | ANAC | sopra €40k; WAF richiede browser UA |
| **Fondi UE / coesione / PNRR** | OpenCoesione + OpenCUP | bulk pesante; partire da slice regionale |
| **Confronti statistici** | ISTAT SDMX v2 | "mio comune vs media regionale", un connettore per molti temi |
| **Cultura — musei** | ISTAT (flusso "Musei e istituzioni similari - comuni") | un flusso per-comune; il resto regionale |
| **Layer normativo (FOIA)** | Normattiva OpenData (NEW) | citazioni normative immutabili → Helper FOIA |
| **Spesa centrale / personale PA** | BDAP + Conto Annuale RGS + IPA | astratto dal cittadino, tenere dietro i wedge |

### 🔴 Trappole — salienza altissima, dato assente/chiuso (dichiarare, mai promettere)
| Tema | Perché |
|---|---|
| **Liste d'attesa sanitarie** | PNLA solo cruscotto, niente download |
| **Acqua potabile** | nessuna fonte aperta per-comune (AnTeA non online) |
| **Ritardi reali treni** | solo GTFS (orario teorico) |
| **Criminalità comunale** | ISTAT solo provinciale, 1-2 anni di ritardo |
| **Soldi cultura** (FUS/SIAE) | PDF / liste nominali / paywall, non aggregabile a comune |

> L'insight (CLAUDE.md §7bis): l'open data italiano fa **peggio** sui temi più emotivi. Un commons onesto qui fa un servizio che nessuno fa — *"questo non è pubblicato, ecco cosa invece sappiamo"*.

---

## 3. Lo zoo di piattaforme (il sapere operativo difendibile)

Non esiste "il connettore" unico: servono connettori multipli, ognuno coi suoi quirk.

| Piattaforma | Chi | Path base / quirk |
|---|---|---|
| **CKAN** standard | ANAC, IPA, MIT, Milano, Brescia | `/api/3/action/...`. MIT usa `/catalog/api/3/`. ANAC: browser UA obbligatorio |
| **DKAN** (Drupal, finto-CKAN) | dati.gov.it, MiC cultura | si comporta come CKAN ma nomi-hash; `/opendata/` obbligatorio su dati.gov.it |
| **Socrata / SODA** | dati.lombardia | `/resource/{id}.json`, ID 4x4, SoQL. ID scadono → discovery via catalog API EU |
| **SDMX** | ISTAT | `esploradati.istat.it/SDMXWS/rest/` — **usare v2 JSON**, evitare bug v1 |
| **SPARQL** | MIUR, MiC, Camera, Senato | endpoint Virtuoso/4-star LOD; potente ma expert-only |
| **OGC (CSW/WMS/WFS)** | RNDT, geoportali regionali | INSPIRE; per il territoriale/cartografia |
| **REST custom** | BDAP (`SpodCkanApi`), ISPRA IdroGEO | fuori standard, leggere caso per caso |
| **Bulk file** (ZIP/CSV/XLSX) | OpenCUP, ISPRA rifiuti/suolo, ICCU, EEA | scaricare snapshot, trasformare locale (DuckDB) per i pesanti |

Trappole ricorrenti: path base variabili, nomi-hash su dati.gov.it, ID Socrata che scadono, v2 SDMX a volte parziale, WAF che bloccano curl generici (ANAC), licenze **non uniformi per-dataset** (leggere sempre).

---

## 4. Ordine di ingestione (perché questa sequenza)

Allineato a `manifest.yaml` e alla decisione "wedge prima":

1. **`geo.comuni`** (geojson-italy + ISTAT) — la spina su cui fa join tutto.
2. **5 wedge** — IdroGEO, rifiuti, consumo suolo, aria, scuola: massima citabilità per-comune, parsing più semplice; reggono le prime 10 domande.
3. **ISTAT SDMX v2** — un connettore, molti temi di confronto.
4. **Money/genesis** — BDAP + OpenCoesione (LOM bulk) + ANAC.
5. **Governo** — DAIT amministratori + Normattiva.
6. **Fan-out nazionale** — energia/CER, welfare, biblioteche ICCU, balneazione; poi pesanti/scomodi (OpenCUP, MIT quando ≠503, INPS, fallback EEA).

---

## Deep-dive e fonti

- **Federazione, standard, normativa** → [`quadro-nazionale-dati.md`](quadro-nazionale-dati.md)
- **Temi × dato + domande tipiche** → [`temi-civici-mappa.md`](temi-civici-mappa.md)
- **Territorio pilota** → [`lombardia-dati.md`](lombardia-dati.md)
- **Ecosistema**: `github.com/italia/awesome-italian-public-datasets` · onData/datibenecomune (alleato) · Developers Italia (catalogo API)

### Fonti chiave verificate 2026-06-29
- BDAP `bdap-opendata.rgs.mef.gov.it/SpodCkanApi` · OpenCoesione `opencoesione.gov.it/it/api/aggregati` · ANAC `dati.anticorruzione.it/opendata/api/3`
- ISTAT `esploradati.istat.it/SDMXWS/rest/v2` · dati.gov.it `/opendata/api/3` · geodati.gov.it
- ISPRA `idrogeo.isprambiente.it/api` · `catasto-rifiuti.isprambiente.it` · dati.lombardia.it `/resource/nicp-bhqi.json` · dati.istruzione.it
- DAIT `dait.interno.gov.it/elezioni/open-data` · Normattiva `api.normattiva.it` · ICCU `opendata.anagrafe.iccu.sbn.it` · GSE Atlaimpianti · EEA WISE bathing-water
