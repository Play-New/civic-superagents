# Temi civici × disponibilità dati — mappa

> Curation da deep research del **2026-06-09** (3 run, ~320 agenti, verifica adversariale 3-voti).
> Endpoint testati live quella data. **Le API italiane cambiano spesso e silenziosamente: riverificare prima di ogni release** (CLAUDE.md §11.2).
> Legenda confidenza: ✅ verificato con probe live + voto 3-0 · ⚠️ documentato ma non riverificato questo giro · ❓ refutato / incerto.

Il senso di questo file: il progetto era organizzato per **comune** (asse geografico). Le persone però pensano per **tema** (aria, scuola, treni…). Questa mappa serve a riorganizzare il commons per temi, col comune come *filtro* e non come entrata. Decisione di impostazione discussa il 2026-06-09, non ancora consolidata nel CLAUDE.md.

---

## 1. I 3 hub trasversali (le porte d'ingresso)

Quasi tutto è raggiungibile da tre porte, tutte con accesso programmatico aperto senza auth.

| Hub | Ente | Copre | Accesso | Note operative |
|---|---|---|---|---|
| **dati.gov.it** ✅ | AgID | Catalogo federato ~65.166 dataset, tutti i temi | CKAN v3 — base `https://www.dati.gov.it/opendata/api/3/action/` (`package_list/show/search`, `organization_list/show`), JSON | Aggregatore via **harvesting**: molti link-risorsa rotti → buono per *scoprire*, non garantisce dato vivo. Nomi dataset = **hash opachi** (no slug). Path `/opendata/` obbligatorio (bare `/api/3/` → 404). Backend è **DKAN** (profilo Drupal), si comporta come CKAN. |
| **ISTAT SDMX** ✅ | ISTAT | **4.871 dataflow**: aria, povertà, agricoltura, lavoro, istruzione, salute, turismo, demografia | SDMX 2.1 REST — `https://esploradati.istat.it/SDMXWS/rest/` (`/dataflow`, `/data`) | ⚠️ **Sostituisce/affianca** il vecchio `sdmx.istat.it` citato in CLAUDE.md §3. v2 `/rest/v2/` documentata ma **non pienamente implementata**. v1 ha **bug off-by-one su `endPeriod`**. Bare `/rest/` → 404 (atteso). Guida: github.com/ondata/guida-api-istat |
| **RNDT** ✅ | AgID | Tutto il **territoriale/geografico** (INSPIRE), 9 raggruppamenti tematici | Catalogo + servizi OGC (CSW/WMS/WFS) — `dati.gov.it/geodati` | Catalogo nazionale dati territoriali ex art. 59 CAD. RNDT 2.0, manuale metadati v3.1 (03/10/2025). |

**Strategia di accesso**: ISTAT come backbone statistico trasversale (un connettore SDMX copre ~10 temi), poi connettori puntuali ai portali tematici di titolarità per il dettaglio. Su dati.gov.it preferire la discovery, non l'hardcoding di ID.

---

## 2. Matrice temi: salienza × qualità dato

🟢 TESORO/WEDGE = partire da qui · 🟡 GENESIS = valore ma alto attrito · 🔴 TRAPPOLA = salienza alta, dato assente/chiuso

| Tema | Salienza | Qualità dato | Fonte + accesso | Verdetto |
|---|---|---|---|---|
| **Qualità dell'aria** | 🔥🔥🔥 | ⭐⭐⭐⭐ near-real-time | ARPA → in Lombardia su `dati.lombardia.it` (Socrata: sensori `nicp-bhqi`, stazioni `ib47-atvt`). EEA aggrega a livello UE | 🟢 **WEDGE n.1** ✅ |
| **Rischio frane/alluvioni** | 🔥🔥 | ⭐⭐⭐⭐ fino al comune | **ISPRA IdroGEO REST API** `https://idrogeo.isprambiente.it/api` (`/api/pir/comuni`, `/api/iffi/comuni`), CC-BY 4.0 (frane) / CC-BY-SA 4.0 (alluvioni) | 🟢 **TESORO** ✅ (API in pre-release `2.0.0-development.x`) |
| **Rifiuti / differenziata** | 🔥🔥 | ⭐⭐⭐⭐ per comune 2010-2024 | **ISPRA Catasto Rifiuti** `catasto-rifiuti.isprambiente.it` (`?pg=downloadComune`), CSV per anno tutti i comuni, agg. 2025-12 | 🟢 **TESORO** ✅ |
| **Consumo di suolo** | 🔥🔥 | ⭐⭐⭐⭐ annuale per comune | **ISPRA** consumo di suolo (`isprambiente.gov.it/.../i-dati-sul-consumo-di-suolo`) | 🟢 **TESORO sottoutilizzato** ⚠️ |
| **Scuola / istruzione** | 🔥🔥🔥 | ⭐⭐⭐ struttura sì, esiti meno | **MIUR dati.istruzione.it** — SPARQL endpoint + CSV/JSON/RDF/XML, IODL 2.0. Domini: scuole, edilizia scolastica, personale, studenti, SNV | 🟢 **WEDGE** ✅ |
| **Territorio / cartografia** | 🔥🔥 | ⭐⭐⭐⭐ standard OGC | RNDT + geoportali regionali (Lombardia: CSW/WMS/WMTS/WFS, INSPIRE) | 🟢 **TESORO** ✅ |
| **Esiti ospedalieri (qualità cure)** | 🔥🔥 | ⭐⭐⭐ per struttura | **AGENAS PNE** `pne.agenas.it`, per singola struttura (es. `sel-str=01061001`), confrontabile con media nazionale | 🟡 **TESORO ma dashboard SPA** — machine-readability *non confermata* ✅(esistenza)/❓(accesso) |
| **Spesa pubblica / bilanci** | 🔥🔥 | ⭐⭐⭐ completo ma illeggibile | **BDAP** endpoint custom (CLAUDE.md §3) | 🟡 **GENESIS del progetto** ⚠️ |
| **Appalti** | 🔥🔥 | ⭐⭐⭐ sopra €40k | **ANAC** CKAN (serve User-Agent browser, WAF blocca curl) §3 | 🟡 GENESIS ⚠️ |
| **Fondi UE / coesione / PNRR** | 🔥🔥 | ⭐⭐⭐ | **OpenCoesione** (dataset Lombardia `progetti_esteso_lom` ✅), **OpenCUP** bulk ZIP §3 | 🟡 GENESIS ⚠️ |
| **Trasporti — orari TPL** | 🔥🔥 | ⭐⭐⭐ teorico | **GTFS** su `dati.mit.gov.it` (`?res_format=gtfs`) + regionale Lombardia (`3z4k-mxz9`), Agenzia TPL | 🟡 c'è l'orario teorico, non i ritardi |
| **Incidentalità stradale** | 🔥🔥 | ⭐⭐ con ritardo | `dati.mit.gov.it` serie storica | 🟡 ✅(esistenza) |
| **Demografia / migrazioni** | 🔥 | ⭐⭐⭐⭐ | ISTAT SDMX, per comune | 🟢 facile via ISTAT ✅ |
| **Lavoro / povertà / economia** | 🔥🔥 | ⭐⭐ provinciale | ISTAT SDMX (povertà assoluta, NEET), INPS | 🟡 granularità grossa ✅ |
| **Agricoltura / cibo** | 🔥 | ⭐⭐⭐ | ISTAT SDMX (coltivazioni, agriturismo) | 🟡 ✅ |
| **Turismo** | 🔥 | ⭐⭐⭐ | ISTAT SDMX | 🟡 ✅ |
| **Energia / rinnovabili / bollette** | 🔥🔥🔥 | ⭐⭐ | GSE Atlaimpianti (impianti), Terna, ARERA | 🟡 **da verificare** (non coperto) |

### 🔴 Trappole (alta salienza, dato assente/chiuso) — pattern, non casi isolati

| Tema | Perché trappola | Stato |
|---|---|---|
| **Liste d'attesa sanitarie** | **PNLA** (art. 1 L.107 del 29/07/2024) pubblica indicatori reali (tempi medi per prestazione e classe priorità U/B/D/P) ma **solo dashboard web sul Portale Trasparenza AGENAS — nessun download né API**. Open data e API solo su roadmap. | ✅ **confermata** |
| **Ritardi reali dei treni** | Solo GTFS (orario teorico). Flussi Trenord Lombardia (`m2u2-frtq`) fermi al 2023. La puntualità reale non è aperta. | ✅ |
| **Criminalità a livello comunale** | ISTAT delittuosità solo **provinciale**, 1-2 anni di ritardo. | ⚠️ |
| **Qualità acque (balneazione/potabili)** | Portale Acque Min. Salute **refutato** (0-3) come fonte primaria machine-readable. Buco aperto: verificare ISPRA/SNPA, EEA bathing water, ARPA regionali. | ❓ **gap da chiarire** |

L'insight: l'open data italiano fa peggio proprio sui temi più emotivi. Un commons onesto qui fa un servizio che nessuno fa — dire *"questo non è pubblicato, ecco cosa invece sappiamo"* — ma non promettere questi temi come wedge.

---

## 2bis. Domande tipiche per tema

Le domande che un **cittadino / giornalista locale / comitato / consigliere di opposizione** farebbe davvero. Materia prima diretta per le 10 domande del §6 (test set verificato a mano). Il comune è il filtro, il tema è l'entrata.

### 🟢 Wedge / Tesori

**Qualità dell'aria**
- Quanti giorni l'anno il mio comune ha sforato il limite di PM10? È peggio o meglio dei comuni vicini?
- La centralina più vicina a casa che valori ha registrato nell'ultima settimana?
- L'ozono estivo nella mia provincia sta peggiorando negli anni?

**Rischio frane / alluvioni**
- Quante persone nel mio comune vivono in aree a pericolosità idraulica o da frana elevata?
- La mia via / la scuola di mio figlio è in zona a rischio?
- Quanta parte del territorio comunale è classificata a rischio alluvione?

**Rifiuti / raccolta differenziata**
- Qual è la % di differenziata del mio comune e come è cambiata negli ultimi 5 anni?
- Produciamo più o meno rifiuti pro-capite dei comuni simili?
- Il mio comune ha raggiunto l'obiettivo di legge sul differenziato?

**Consumo di suolo**
- Quanti ettari ha cementificato il mio comune nell'ultimo anno?
- Il consumo di suolo qui cresce più o meno della media regionale?
- Dove sono le nuove superfici impermeabilizzate?

**Scuola / istruzione**
- Le scuole del mio comune hanno i certificati di agibilità e antincendio?
- Quanti edifici scolastici sono in zona sismica senza adeguamento?
- Quanti studenti per classe nelle scuole del mio quartiere?

**Territorio / cartografia** (layer abilitante)
- Cosa prevede il PGT per l'area dietro casa mia?
- Quali vincoli paesaggistici o idrogeologici insistono sul mio comune?

**Esiti ospedalieri (qualità cure)**
- L'ospedale dove devo operarmi ha esiti migliori o peggiori della media per quell'intervento?
- Quanti interventi di quel tipo fa quel reparto all'anno? (volumi = qualità)
- La mortalità a 30 giorni dopo infarto nel mio ospedale com'è rispetto alla media?

**Demografia / migrazioni**
- Quanto è invecchiata la popolazione del mio comune in 10 anni?
- Il mio paese si sta spopolando?
- Quanti nuovi residenti, e quanti stranieri?

### 🟡 Genesis (i soldi) e dato medio

**Spesa pubblica / bilanci**
- Il mio comune spende più o meno di comuni simili in scuola / sociale?
- Il bilancio 2024 l'hanno rispettato o sforato?
- Quanto è cresciuta la spesa per il personale dal 2018?

**Appalti**
- Chi sono le 3 ditte che hanno preso più appalti dal mio comune negli ultimi 5 anni?
- Quanti affidamenti diretti rispetto alle gare aperte?
- Ci sono ditte che vincono quasi sempre?

**Fondi UE / coesione / PNRR**
- Quanti soldi PNRR sono arrivati al mio comune, e per fare cosa?
- I progetti finanziati sono partiti o sono fermi?
- Quanto è stato speso davvero rispetto a quanto assegnato?

**Trasporti — orari TPL**
- Quante corse al giorno servono la mia fermata?
- C'è un collegamento diretto tra il mio paese e il capoluogo?

**Incidentalità stradale**
- Qual è l'incrocio o il tratto più pericoloso del mio comune?
- Gli incidenti sulla mia strada sono aumentati negli ultimi anni?

**Lavoro / povertà / economia**
- Qual è il tasso di disoccupazione giovanile nella mia provincia?
- Quanti NEET (giovani che non studiano né lavorano)?

**Agricoltura / cibo**
- Quante aziende agricole e quali colture prevalgono nel mio territorio?

**Turismo**
- Quanti turisti e quante presenze nel mio comune? Il trend cresce?

**Energia / rinnovabili**
- Quanti impianti fotovoltaici / rinnovabili sono installati nel mio comune?
- Esiste una comunità energetica sul mio territorio?

### 🔴 Trappole — le domande più sentite, ma il dato aperto manca

> Queste sono le domande che la gente fa di più. Vanno gestite con onestà: dire cosa **non** è pubblicato e cosa invece è disponibile. Non prometterle come wedge.

**Liste d'attesa sanitarie** — "Quanto devo aspettare per una risonanza / una visita nella mia ASL?" → solo dashboard PNLA, niente dato scaricabile.
**Ritardi reali dei treni** — "Il mio treno dei pendolari quanto ritarda in media?" → solo orario teorico (GTFS).
**Criminalità a livello comunale** — "I reati nel mio comune sono aumentati?" → ISTAT solo provinciale, con 1-2 anni di ritardo.
**Qualità acque** — "L'acqua del mio rubinetto è sicura? Il lago dove mi bagno è balneabile?" → fonte primaria refutata, gap da chiarire.

---

## 3. Lettura per il commons

1. **Wedge candidati** (salienza alta + dato forte e citabile): **aria, rischio idrogeologico, rifiuti, consumo di suolo, scuola**. Da qui si parte e si rispetta la citation policy dura (§5).
2. **I "soldi" sono GENESIS, non WEDGE**: dato forte ma illeggibile, il valore è renderlo civico. Resta centrale ma non è la porta d'ingresso emotiva.
3. **Trappole**: gestirle con onestà (non-disponibilità dichiarata), mai prometterle.

---

## Risorse di discovery / ecosistema

- `github.com/italia/awesome-italian-public-datasets` — lista curata dataset pubblici italiani
- **onData / datibenecomune** (`ondata.it`, `datibenecomune.it/advocacy`) — alleato, advocacy open data (CLAUDE.md §9: non duplicare, alleare)
- **Developers Italia** (`developers.italia.it`) — catalogo API ufficiali (es. ISTAT SDMX listata lì)

## Fonti chiave (primarie, verificate 2026-06-09)
- https://www.dati.gov.it/api · https://www.dati.gov.it/geodati
- https://esploradati.istat.it/SDMXWS/rest/dataflow
- https://idrogeo.isprambiente.it/api · https://idrogeo.isprambiente.it/app/page/open-data
- https://www.catasto-rifiuti.isprambiente.it/index.php?pg=downloadComune
- https://dati.istruzione.it/opendata/opendata/
- https://pne.agenas.it/ · AGENAS news 2661 (PNLA)
