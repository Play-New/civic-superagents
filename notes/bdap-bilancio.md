# BDAP FET Rendiconto — spesa per missione — nota fonte

**Tema**: spesa comunale per **missione** (rendiconto armonizzato). → `mart.bilancio_comune`. Ingestor: `ingestors/bilancio.ts`.
**Fonte**: portale OpenBDAP "FET → Analizza" (NON la CKAN SpodCkanApi, che ha solo SIOPE economico). Verificato 2026-06-29.
- Discovery: `GET https://openbdap.rgs.mef.gov.it/fet/GetDocumentsYears?type=Rendiconto` → anni 2016-2025.
- File: `https://openbdap.rgs.mef.gov.it/Datasets_FET/Rendiconto/{YYYY}/{YYYY}_Rendiconto%20-%20Schemi%20di%20bilancio_{REGIONE}.zip` (Lombardia ~50 MB). Ingeriti: Lombardia 2022-2024.
**Join**: `comune_istat = lpad("Codice Provincia",3,'0') || lpad("Codice Comune",3,'0')` (NON il Codice Regione).

## Quirk

- ⚠️ **FILTRO OBBLIGATORIO `Codice Tipologia Soggetto = 'ELCOMU'`** (= COMUNI). Senza, si sommano Regione/Città Metropolitana/enti strumentali (es. Milano missione 13 Salute grezza = €25,8 mld = Regione Lombardia, non il Comune). Con ELCOMU la chiave (comune, missione) è unica.
- Dentro lo ZIP servono il CSV **`*_Rendiconto SDB Spese Riepilogo Missioni_{REGIONE}.csv`** (missione) — NON il PDF omonimo né `... - Voce di Riepilogo_...csv`. ⚠️ Glob preciso `*Spese Riepilogo Missioni_{REGIONE}.csv` (un glob largo prende i PDF → `unzip -p` estrae il primo = PDF).
- ZIP **ZIP64** → `unzip -p` / `bsdtar` (adm-zip/python zipfile possono fallire). `HEAD` mente (`text/html`) → usare **GET**; serve browser UA + Referer `…/it/FET/Analizza`.
- CSV: `;`, campi quotati, **latin-1**, CRLF, **decimale `.`**, vuoto=`""`→NULL, valori **negativi** reali (riaccertamenti). Header con refuso `Fondo Puriennale` (sic) + colonna vuota finale.
- Campi → mart: `Codice Missione`→missione_cod (`01`..`20`,`50`,`60`,`99`), `Descrizione Missione`→missione_desc, **`Impegni`→impegni** (competenza, default per "quanto spende"), `Totale Pagamenti`→totale_pagamenti.
- 23 missioni (04=Istruzione, 12=Diritti sociali, 09=Ambiente, ecc.). Verifica: Milano 2024 M04 €315,7 mln, M12 €436,1 mln (impegni).
- Disclaimer: impegni = competenza; nazionale = file unico da 334 MB/anno; SIOPE (CKAN) resta per le domande di natura *economica* (personale/beni), non per missione.
