# Quadro nazionale open data — federazione, standard, normativa

> Curation da deep research del **2026-06-09** (106 agenti, verifica adversariale, 23 claim confermati / 2 refutati).
> Probe live quella data. Riverificare prima di ogni release.
> Confidenza: ✅ probe live 3-0 · ⚠️ documentato · ❓ refutato.

---

## 1. Come è fatto l'ecosistema: federato, non centralizzato

**dati.gov.it** (gestito da **AgID**) **non ospita** i dati: raccoglie via **harvesting automatico** i metadati dei cataloghi delle PA, in una catena gerarchica:

> enti subordinati → enti intermedi (Regioni / Città metropolitane / Province autonome / Unioni di Comuni) → dati.gov.it → data.europa.eu (UE)

I soggetti intermedi "fungono da importatori (harvester) dei metadati degli enti sotto-ordinati e contemporaneamente da importati da dati.gov.it, **senza interventi manuali e senza cambiare la titolarità del dataset**", che resta sempre alla PA produttrice. ✅

- **Volume**: `package_search` → **~65.166 dataset** federati (2026-06-09). ✅
- **Standard metadati**: **DCAT-AP_IT**, profilo italiano del DCAT-AP UE (programma ISA), definito da AgID dopo consultazione pubblica 2016. Stabile. ✅
- Metodi di alimentazione: editor (pochi dataset), harvesting (numero elevato), endpoint TTL/RDF DCAT-AP_IT, CKAN con estensione DCATAPIT, SPARQL.

### ⚠️ Architettura: DKAN, non CKAN puro
dati.gov.it gira su **DKAN** (profilo Drupal che reimplementa CKAN). Le API *si comportano* come CKAN ma il backend è DKAN. Il repo legacy `github.com/italia/dati.gov.it` è **archiviato dal 23/12/2022** (read-only) — ma **il servizio è vivo e aggiornato nel 2026** (showcase progetti, statistiche real-time, open data PNRR). Non confondere repo morto con servizio morto. ✅

---

## 2. API del catalogo nazionale ✅

- Base funzionante: `https://www.dati.gov.it/opendata/api/3/action/`
- Operazioni CKAN: `package_list`, `package_show`, `package_search`, `current_package_list_with_resources`, `organization_list`, `organization_show`. JSON. Lettura senza auth.
- ⚠️ Il path `/opendata/` è **obbligatorio** (bare `/api/3/action/` → 404).
- ⚠️ I nomi dataset sono **hash opachi tipo SHA-256**, non slug leggibili.
- ⚠️ Essendo aggregatore via harvesting, parte dei dataset ha **link-risorsa rotti** → "copre tutti i temi" è affermazione di *ampiezza*, non di *usabilità per-dataset*. Per dati critici andare diretti al portale di titolarità (ISPRA, ISTAT, MIUR, AGENAS).

---

## 3. Statistica nazionale: ISTAT SDMX ✅

- Endpoint: `https://esploradati.istat.it/SDMXWS/rest/` (`/dataflow`, `/data`). NSI Web Service.
- **4.871 dataflow** bilingui EN/IT: aria, povertà assoluta, agricoltura, lavoro, istruzione, salute, turismo, demografia. Senza auth.
- ⚠️ **Sostituisce/affianca** il `sdmx.istat.it` citato in CLAUDE.md §3 — **aggiornare il riferimento**.
- ⚠️ v2 `/rest/v2/data` documentata ma non pienamente implementata; v1 ha bug off-by-one su `endPeriod`; bare `/rest/` → 404.
- Catalogata come API ufficiale su Developers Italia. Guida: `github.com/ondata/guida-api-istat`.

---

## 4. Dati territoriali: RNDT ✅

- **RNDT** (Repertorio Nazionale Dati Territoriali, gestito da AgID): catalogo nazionale dei dati territoriali e servizio di discovery di riferimento per la **Direttiva INSPIRE**. Istituito ex art. 59 CAD.
- 9 raggruppamenti tematici allineati ai Thematic Working Group INSPIRE: biodiversità, copertura/uso del suolo, dati topografici e catastali, elevazione, impianti/servizi di pubblica utilità, mare/atmosfera, monitoraggio ambientale, scienze della terra, statistica.
- Accesso: `dati.gov.it/geodati`. RNDT 2.0, manuale metadati v3.1 (03/10/2025).

---

## 5. Quadro normativo ✅ / ❓

- **D.Lgs. 33/2013** ✅ — disciplina il **diritto di accesso civico (FOIA italiano)** e gli obblighi di pubblicità/trasparenza delle PA, finalità di "accessibilità totale". L'**accesso civico generalizzato** (FOIA pieno) è aggiunto dal **D.Lgs. 97/2016** (modifica art. 5/5-bis). L'originario 2013 prevedeva solo "accesso civico semplice". → conferma e precisa il CLAUDE.md §5.
- ❓ **REFUTATO (0-3)**: l'affermazione che l'open data italiano sia governato da **D.Lgs. 36/2006 + D.Lgs. 200/2021** come recepimento della **Direttiva UE Open Data 2019/1024** **NON è confermata**. **Riverificare il riferimento normativo corretto prima di citarlo** (open question aperta).

---

## 6. Fonti tematiche nazionali verificate

| Fonte | Ente | Contenuto | Accesso | Licenza |
|---|---|---|---|---|
| **dati.salute.gov.it** ✅ | Min. Salute | Personale SSN, posti letto, dispositivi medici, farmacie | CSV (primario), JSON, XML | IODL 2.0 |
| **dati.istruzione.it** ✅ | Min. Istruzione | Scuole, studenti, personale, edilizia scolastica, bilanci scuole, PON, ANIST | SPARQL + CSV/JSON/RDF/XML (4-star LOD) | IODL 2.0 |
| **dati.mit.gov.it** ✅ | MIT | Aeroporti, autorità portuali, ciclovie, Conto Naz. Trasporti, GTFS, incidentalità | CKAN — base `/catalog/api/3/action/` (bare `/api/3/` → 404) | — |
| **ISPRA** (ambiente, IdroGEO, Catasto Rifiuti, consumo suolo) | ISPRA | vedi `temi-civici-mappa.md` §2 | REST API / CSV / portali tematici | CC-BY 4.0 / CC-BY-SA 4.0 |

> Per le **fonti-spesa core del progetto** (BDAP, OpenCUP, ANAC, OpenCoesione, IPA): restano documentate in **CLAUDE.md §3** (probe 2026-05-08, ormai datati) — **non riverificate** in questi run. Da riprobare prima dell'MVP.

---

## 7. Criticità centrale per un commons di skill

L'ecosistema è una **giungla di piattaforme**: CKAN, **DKAN**, **Socrata/SODA**, **SDMX**, **SPARQL**, **OGC/WMS-WFS** — ognuna con path base e quirk diversi. Non esiste "il connettore" unico: servono **connettori multipli**. È esattamente il sapere operativo (le note) dove sta il valore difendibile del commons, non nel codice (cfr. CLAUDE.md §4, tabella genesis/commodity).

Trappole ricorrenti: path base variabili (`/opendata/`, `/catalog/`, `/it/api/3/`), nomi-hash su dati.gov.it, v2 SDMX incompleta, WAF che bloccano curl generici (ANAC).

## Fonti chiave (verificate 2026-06-09)
- https://www.dati.gov.it/api · https://www.dati.gov.it/Come-alimentare-il-Catalogo-nazionale · https://www.dati.gov.it/geodati
- https://esploradati.istat.it/SDMXWS · https://developers.italia.it/it/api/istat-sdmx-rest.html
- https://docs.italia.it/italia/daf/linee-guida-cataloghi-dati-dcat-ap-it/it/stabile/alimentarecatalogo.html
- https://docs.italia.it/AgID/documenti-in-consultazione/lg-opendata-docs/it/bozza/normativa-di-riferimento.html
