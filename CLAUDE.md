# CLAUDE.md — Civic SuperAgents

Istruzioni per ogni sessione LLM (Claude Code, Codex, altro agente) che lavora in questo repo. Da leggere prima di toccare qualsiasi file.

Per il quadro strategico esteso → [`IDEA.md`](IDEA.md) (21/04/2026, 251 righe).
Per la sintesi pubblica → [`civic-superagents.md`](civic-superagents.md).
Per l'inventario dati verificato → [`notes/temi-civici-mappa.md`](notes/temi-civici-mappa.md) (temi × dati + domande tipiche), [`notes/quadro-nazionale-dati.md`](notes/quadro-nazionale-dati.md) (federazione, standard, normativa), [`notes/lombardia-dati.md`](notes/lombardia-dati.md) (territorio pilota).
Questo CLAUDE.md è lo **schema** del progetto: voice, convenzioni, vincoli, prossimi passi.

---

## 1. Cos'è questo progetto

Un **commons di skill AI civici** e MCP server sui dati pubblici italiani, per cittadini civic-engaged (giornalisti locali, opposizione, comitati, ricercatori). Governance RFC-style sotto la community SuperAgents (skool.com/superagents). Licenze: **EUPL** per il codice, **CC-BY-SA** per prompt e documentazione.

**Cosa NON è.** Non un prodotto. Non un'offerta a pagamento. Non per Mario Rossi che paga la TARI. Non per la PA come acquirente.

**Posizionamento confermato.** Cittadini-first. Pivot esplicito dal 16 aprile 2026 dopo un primo giro PA-oriented. Effetto sui dipendenti PA è conseguenza di design, non target.

---

## 2. Stato al 16 giugno 2026

Conversazione strategica condotta tra aprile e maggio 2026. Probe API completati l'8 maggio. Decisioni architetturali consolidate. Il 9 giugno: ricognizione open data esaustiva (3 deep research, ~320 agenti, verifica adversariale 3-voti) → consolidata in `notes/`. Il 16 giugno: pivot tematico discusso (vedi §7bis) e documentazione chiusa.

Il data lake è operativo su Supabase (17 dataset, comune-keyed, PostGIS) con uno strato serving MCP a 11 tool. Lo storico operativo dettagliato e i parametri di deploy/infra sono tenuti fuori da questo documento pubblico.

**Cosa esiste oggi:**
- `IDEA.md` — idea doc strategico (21/04)
- `civic-superagents.md` — sintesi pubblica narrativa
- `CLAUDE.md` — questo file (16/06)
- `notes/temi-civici-mappa.md` — temi civici × disponibilità dati, matrice salienza×qualità, **domande tipiche per tema** (materia prima per le 10 domande)
- `notes/quadro-nazionale-dati.md` — federazione dati.gov.it/DKAN, ISTAT SDMX, RNDT, normativa
- `notes/lombardia-dati.md` — ricognizione del territorio pilota
- Memoria di conversazione LLM (locale, fuori dal repo)

**Cosa NON esiste ancora:**
- Manifesto in una pagina
- MVP skill

**Cosa esiste ora (oltre allo scaffold):** data lake a 17 dataset su Supabase + strato serving MCP (11 tool).

**Il prossimo passo è UNO solo** → vedi §6.

---

## 3. Fonti dati: stato verificato 2026-05-08

Probe reali via curl. Da rifare prima di qualsiasi rilascio pubblico.

> **Refresh liveness 2026-06-29** → la verifica più recente di TUTTE le fonti (wedge + spesa + cultura + governo + energia/welfare/acque) è consolidata in [`notes/mappa-open-data-civici.md`](notes/mappa-open-data-civici.md) e in forma macchina-leggibile in [`ingestors/manifest.yaml`](ingestors/manifest.yaml). Correzioni principali rispetto a questa §3: ISTAT v2 ora usabile (sotto); Openpolis api3 morto → OPDM (sotto); Normattiva ora ha un'API (§8.8); INPS host corretto `serviziweb2.inps.it/odapi`; ISPRA consumo-suolo URL cambiato; `dati.salute.gov.it` non è CKAN; AGENAS PNE non più solo-dashboard.

### ✅ Funzionano

| Fonte | Endpoint reale | Note operative |
|---|---|---|
| **OpenBDAP** | `https://bdap-opendata.rgs.mef.gov.it/SpodCkanApi/api/1/rest/dataset` | **3.773 dataset** (cresciuto da 3.555 in IDEA.md). NON è CKAN standard `/api/3/action/...` (quello dà 404). Endpoint custom CKAN-like. `package_show` per nome OK, `q=` di search NON funziona — paginare lato client. |
| **OpenCUP** | `https://www.opencup.gov.it/portale/documents/21195/299152/Opendata*.zip` | **Niente REST API**. Bulk ZIP Liferay scaricabili senza auth: `OpendataComplessivo.zip` (3.29 GB tutta Italia) o per area `OpendataCsv{Sud,NordEst,NordOvest,Centro,Isole}.zip`. Aggiornamento **giornaliero**, CC-BY. Contiene 4 CSV semantici: `OpendataProgetti`, `OpendataLocalizzazione`, `OpendataSoggetti`, `OpendataFontiCopertura`. Pattern: cron locale → DuckDB → query. |
| **ANAC** | `dati.anticorruzione.it/opendata/api/3/action/...` | CKAN standard. **Serve User-Agent browser** (WAF blocca curl generici). Dataset: `aggiudicatari`, `aggiudicazioni`, `bandi-cig-*`. |
| **IPA Indice PA** | `indicepa.gov.it/ipa-dati/api/3/action/...` | CKAN 2.9.8 standard. **IDEA.md ha il link sbagliato** (`ipa-portale` è la SPA Angular, non l'API). Dataset: `amministrazioni`, `enti`, `aoo`, `domicili-digitali`. |
| **ISTAT SDMX** | `esploradati.istat.it/SDMXWS/rest/` (verificato 2026-06-29, **4.876 dataflow**). Il vecchio `sdmx.istat.it/SDMXWS/rest/dataflow/IT1` è citato solo per storico. | ⚠️ **v2 `/rest/v2/structure/dataflow/` ora restituisce SDMX-JSON 2.0 pulito → usare v2 come default** (evita il parsing XML e il bug off-by-one). v1 ha ancora bug off-by-one su `endPeriod`; bare `/rest/` → 404. Copre aria, povertà, agricoltura, lavoro, istruzione, salute, turismo, demografia. |
| **OpenCoesione** | `opencoesione.gov.it/it/api/aggregati/` | Aggregati 2025-12-31: 1.817.138 progetti, €354B costo pubblico. `/it/api/progetti/` timeout senza filtri — serve paginazione. |
| **onData PNRR** | `pnrr.datibenecomune.it` | Sito Quarto static, dati scaricabili. |
| **geojson-italy** | raw GitHub Openpolis | Confini comunali/provinciali/regionali. |

### ❌ Rotti / non utilizzabili

| Fonte | Stato | Mitigazione |
|---|---|---|
| **Soldipubblici.gov.it** | Intero sito redirect a "AgID Maintenance Page" | Rimosso da skill V1. Pagamenti SIOPE ricostruibili da BDAP. |
| **Italia Domani — dati aperti** | Pagina citata 404, solo CMS | Rimosso da inventario. |
| **Openpolis API v3** | ⚠️ **`api3.openpolis.io` morto (NXDOMAIN, verificato 2026-06-29)**. Migrato a **OPDM** `service.opdm.openpolis.io` (10k req/giorno free) | Usare OPDM. Per "chi governa" preferire comunque DAIT Amministratori (per-comune) — vedi `notes/mappa-open-data-civici.md`. |

### Bonus inattesi (non in IDEA.md)

- **OsservaCantieri MIT** (`osservacantieri.mit.gov.it`) — cantieri infrastrutture, federato dal portale OpenCUP
- **SILOS** (`silos.infrastrutturestrategiche.it`) — opere strategiche legge obiettivo

Entrambi 200 OK ma struttura ancora non esplorata. Fase 2.

### Inventario esteso (verificato 2026-06-09 → `notes/`)

Questa §3 copre le fonti-**spesa** core (probe 2026-05-08, da rifare). L'inventario tematico ampio — ambiente, scuola, salute, territorio, mobilità, ecc. — è in `notes/`:
- **Mappa di testa consolidata** (`notes/mappa-open-data-civici.md`, refresh 2026-06-29): verdetto di liveness di tutte le fonti + zoo piattaforme + ordine di ingestione. È il punto di partenza; gli altri tre file sono i deep-dive.
- **3 hub trasversali** (`notes/quadro-nazionale-dati.md`): dati.gov.it (CKAN/DKAN, ~65k dataset, harvesting → molti link rotti), **ISTAT SDMX** (4.871 dataflow), **RNDT** (geo/INSPIRE).
- **Tesori machine-readable** (`notes/temi-civici-mappa.md`): ISPRA IdroGEO (rischio frane/alluvioni, REST API fino al comune), ISPRA Catasto Rifiuti (CSV per comune 2010-24), ISPRA consumo di suolo, MIUR scuola (SPARQL+CSV), AGENAS PNE esiti ospedalieri.
- **Trappole confermate** (alta salienza, dato chiuso): liste d'attesa (PNLA solo dashboard), ritardi treni, criminalità comunale, qualità acque.
- ⚠️ **Da riverificare prima di citare**: il recepimento italiano della Direttiva UE Open Data 2019/1024 (claim D.Lgs. 36/2006 + 200/2021 **refutato** in verifica) — vedi §8.

---

## 4. Architettura: cosa fare, cosa NON fare

### Il principio

**Bootstrap minimo, non commons completo.** Civic SuperAgents al giorno 1 non sta accumulando conoscenza per mesi — sta rilasciando 4 skill testati su cittadini reali. La struttura pesante (capability + LLM wiki + autoresearch) è il **target naturale**, non il punto di partenza.

### Forma del repo bootstrap (3 cartelle, non 6 layer)

```
raw/                        ← dati scaricati. Immutable. Nessuna sessione modifica qui.
  bdap/
  opencup/
  istat/
  
glossary/                   ← lookup table JSON, machine-readable
  siope.json
  natura_cup.json
  classi_demografiche.json
  
notes/                      ← markdown corti, una nota per dataset (5-15 quirk per file)
  bdap.md
  opencup.md
  istat.md
  
prompts/                    ← prompt degli skill
  leggi-comune.md
  
tests/                      ← domande civiche con risposta verificata
  questions.jsonl
  
CLAUDE.md                   ← questo file
IDEA.md                     ← storico strategico
README.md                   ← landing pubblica (da scrivere)
```

**Skill consuma**: `glossary/` (lookup deterministico) + `notes/` (sense-making) + `raw/` (dati). Nient'altro al primo giro.

### Pattern che NON usiamo ora (target futuro)

- **LLM Wiki stile Karpathy** (`gist.github.com/karpathy/442a6bf555914893e9891c11519de94f`): pattern giusto quando arriviamo a ~20 fonti ingerite + ~5 contributor attivi + ~6 mesi di curation. La struttura `notes/` promuove naturalmente a `wiki/` senza rifare nulla.
- **Autoresearch stile Karpathy** (`github.com/karpathy/autoresearch`): valido per ottimizzare prompt/pesi/pipeline contro un test set verificato. Prerequisito è il test set. Considerare alle settimane 4-6.
- **MCP server dedicati per capability**: dopo che lo skill MVP funziona, non prima.
- **Capability folders (BDAP/OpenCUP/ANAC/ISTAT/Linguaggio civico/Peer-similarity)**: emergono quando 2+ contributor reclamano ownership di un dominio. Non prima.

### Cosa è genesis e cosa è commodity

| Genesis (dove sta il valore) | Commodity (replicabile) |
|---|---|
| Glossario SIOPE→italiano civico curato e corretto | Connettore CKAN/CSV |
| Grafo peer-similarity calibrato vs giudizio esperto | LLM call |
| Test set di 50 domande civiche verificate da domain expert | Prompt engineering generico |
| Citation policy applicata coerentemente | Repo CI/CD |

Il manufatto difendibile del commons è la **curation accumulata**, non il codice.

---

## 5. Convenzioni di voice e citation

### Lingua

**Italiano civico**, non burocratico né infantile. Esempi:

| ❌ Burocratico | ❌ Infantile | ✅ Civico |
|---|---|---|
| "Le spese di cui al SIOPE 1.03.02.09.008 ammontano a..." | "Il tuo Comune ha speso un sacco di soldi in computer!" | "Il Comune di X ha speso €120.000 in servizi informatici nel 2024, il 40% in più della media dei dieci comuni simili." |

Tono: terzo neutrale, non partigiano, mai sarcastico. Disclaimer espliciti quando i dati hanno ambiguità o ritardo di aggiornamento.

### Citation policy (regola dura)

**Ogni claim numerica o normativa deve citare la fonte immutabile.**

- Numero da BDAP → cita `dataset_id`, anno, riga/cella
- Citazione normativa → cita atto e articolo (es. "art. 5 D.Lgs. 33/2013")
- Aggregazione → mostra il calcolo o linka all'aggregato citabile
- Se la fonte non è verificabile → l'agente dice "non ho potuto verificare" e si ferma. **Non inventa.**

Formato suggerito in coda alla risposta:
```
Fonti:
- OpenBDAP, comuni_certificati_consuntivo_armonizzato_2024, riga 4291
- OpenCUP, OpendataProgetti 2026-05-06, CUP J47H21000280001
```

### Disclaimer obbligatori

- Dati BDAP: ritardo medio 12-18 mesi sull'anno corrente
- OpenCUP: progetti possono essere revocati ma restare in elenco (`elenco-cup-revocati-e-cancellati`)
- ANAC: copertura completa solo sopra soglia €40k
- Confronti tra comuni: sempre dichiarare il peer set usato

---

## 6. Il primo step concreto

**Scrivere 10 domande civiche reali con risposta verificata a mano.**

Niente repo, niente MCP, niente wiki, niente landing. Solo:

1. **10 domande** che un giornalista locale / consigliere di opposizione / comitato farebbe sul suo comune. Esempi reali, non astratti:
   - "Il mio comune spende più o meno di comuni simili in scuola?"
   - "Quanti soldi PNRR sono arrivati a Matera e per fare cosa?"
   - "Il bilancio 2024 di Bologna l'hanno rispettato o no?"
   - "Chi sono le 3 ditte che hanno preso più appalti dal mio comune negli ultimi 5 anni?"
   - "Quanto è cresciuto il personale del Comune di Lecce dal 2018?"

> **Aggiornamento 2026-06-16**: le domande candidate (2-3 per tema) sono già scritte in `notes/temi-civici-mappa.md` §2bis, in italiano civico e ancorate al "mio comune". Pescare da lì invece di inventare da zero. Consiglio: prendere le prime 10 dai **wedge** (aria, scuola, rifiuti, frane) su comuni lombardi reali — dove il dato regge la citation policy dura del §5. Vedi anche §7bis sul perché partire dai temi e non dal bilancio.

2. **Per ognuna**: domanda + risposta corretta (cercata a mano nei CSV) + fonti puntuali.

3. **File**: `tests/questions.jsonl`, schema:
   ```json
   {"id": "Q01", "domanda": "...", "comune": "...", "risposta": "...", "fonti": ["..."], "verificatore": "matteo", "data_verifica": "2026-05-..."}
   ```

4. **Provare a rispondere con Claude + i CSV scaricati + un prompt minimale** ("rispondi in italiano civico, cita le fonti"). Misurare: quante risposte sono corrette? Dove sbaglia?

5. **Iterare lo schema dal fallimento, non dall'idea.**

Dopo questi 10 (3-5 giorni di lavoro), si decide se:
- Servono più domande (scalare a 50, con domain expert)
- Servono primi `glossary/` o `notes/`
- Si scrive l'MVP da release pubblica

**Non saltare questo passo.** È il faro del progetto.

---

## 7. I 4 skill (ordine rivisto al 2026-05-08)

| Skill | Buildable oggi? | Note |
|---|---|---|
| **#2 Gemelli finanziari** | ✅ Tutte API verificate (BDAP + ISTAT + IPA) | Genesis infrastrutturale. Probabile primo MVP. |
| **#4 Helper FOIA** | ✅ Niente API esterne | Knowledge base normativa pura. |
| **#1 Leggi il tuo comune** | ✅ Tutte le fonti accessibili | Dipende da #2. Versione integrale richiede anche OpenCUP. |
| **#3 Radar PNRR** | ✅ Dopo OpenCUP indicizzato | OpenCUP + ANAC + onData. |

Esclusi dal primo giro (richiedono crawler o scraping):
- Watchdog trasparenza
- Il mio consigliere
- Bandi per te
- Segnala con contesto

---

## 7bis. Riorganizzazione per temi (in valutazione dal 2026-06-16)

**Spostamento di impostazione, non ancora deciso definitivamente.** I 4 skill del §7 hanno un solo asse: il **comune** (unità geografico-amministrativa) e la sua **spesa**. Eredità del primo giro PA-oriented. Ma un cittadino non si sveglia pensando al bilancio armonizzato: pensa **"che aria respira mio figlio"**, **"la scuola è sicura"**, **"perché il treno ritarda"**. Il tema è la porta d'ingresso emotiva; il comune è la **lente**, non l'entrata.

**Punto dolce = tema × luogo**: *"la qualità dell'aria nel mio comune"*, *"le scuole del mio quartiere"*, *"i fondi PNRR per la mobilità nella mia città"*. Il comune non sparisce — diventa il filtro.

**Tre gruppi (matrice salienza × qualità-dato, `notes/temi-civici-mappa.md` §2):**
- 🟢 **Wedge / Tesori** — salienza alta + dato forte e citabile: **qualità aria, rischio frane/alluvioni, rifiuti, consumo di suolo, scuola**. Da qui partire.
- 🟡 **Genesis** — dato forte ma illeggibile: **spesa pubblica/bilanci, appalti, PNRR**. È il cuore originale del progetto; resta centrale ma NON è la porta d'ingresso.
- 🔴 **Trappole** — salienza altissima + dato assente/chiuso: liste d'attesa, ritardi treni, criminalità comunale, acque. Gestire con onestà ("non è pubblicato, ecco cosa invece sappiamo"), mai prometterle come wedge.

**Effetto sui 4 skill**: non si buttano, diventano *viste tematiche*. "Gemelli finanziari" e "Leggi il tuo comune" sono il tema 🟡 soldi; i wedge ambientali/scuola sono nuovi temi 🟢 da affiancare come primo MVP. Decisione finale rinviata (vedi §8).

---

## 8. Open questions (al 2026-06-16)

1. **Entità titolare namespace** medio termine — ETS? Fondazione? Hosting sotto onData?
2. **Alleanza con onData / Andrea Borruso** — DM da fare prima del primo RFC.
3. **Finanziamento infra LLM** — BYO-Claude / sponsor / soglia pay-per-use?
4. **Nome pubblico definitivo** — "Civic SuperAgents" descrittivo ma lungo.
5. **Domain expert per validare test set** — chi firma le risposte alle 10/50 domande?
6. **Pivot tematico (§7bis): si conferma?** Riorganizzare il commons per temi (wedge ambientali/scuola come primo MVP) o tenere i soldi/comune al centro? Decisione aperta dal 16/06.
7. **Temi non ancora verificati** — energia/comunità energetiche, qualità acque (fonte primaria refutata), criminalità di dettaglio, welfare/asili nido, democrazia/eletti: serve un quarto run o probe puntuali.
8. **Riferimento normativo UE** — recepimento italiano della Direttiva Open Data 2019/1024: il claim su D.Lgs. 36/2006 + 200/2021 è stato **refutato** (0-3), va trovato e verificato il riferimento corretto prima di citarlo nella citation policy. *Aggiornamento 2026-06-29: Normattiva ora espone un'API ufficiale (`api.normattiva.it`, CC-BY-4.0, in produzione dal 01/01/2026) — è lo strumento per verificare e citare il riferimento corretto, ma la verifica del recepimento non è ancora stata fatta.*
9. **Fonti-spesa §3 da riprobare** — i probe BDAP/OpenCUP/ANAC/OpenCoesione/IPA sono dell'8 maggio. *Liveness riverificata 2026-06-29 (tutte ✅ tranne Soldipubblici ❌ — vedi `notes/mappa-open-data-civici.md`); restano da riverificare gli schemi campo-per-campo prima dell'MVP.*

---

## 9. Cosa NON fare (da IDEA.md, ancora vigente)

- ❌ Duplicare Developers Italia (loro = catalogo software; noi = skill/MCP)
- ❌ Duplicare onData/datibenecomune (loro mappano dati; noi strato agentico)
- ❌ Cercare patrocini AgID/ANCI prima del primo rilascio
- ❌ Legare l'architettura a un singolo LLM (Claude come primo, prompt portabili)
- ❌ Aprire account utente nel primo giro (stateless = zero GDPR operational)
- ❌ Prendere clienti PA come acquirenti (il giorno che pagano, il commons diventa fornitura)
- ❌ Manifesto-che-non-diventa-codice
- ❌ Strutture grandi (wiki, capability folders, autoresearch) prima che servano

---

## 10. Vincoli regolatori

**Postura: minimal-risk AI Act.** Valida finché:
- Query solo su dati pubblici CC-BY ✓
- Output al cittadino, non a PA per triage welfare ✓
- Nessun account utente ✓
- Transparency labeling art. 50 rispettato (da implementare al rilascio)
- Tracking politici locali limitato a dati di ruolo pubblico ✓

DPIA non richiesta. GDPR basis quasi irrilevante. Cambia tier se un comune usa lo skill per decisione welfare (Annex III) → riscrivere governance. **Da tenere fuori dal primo anno.**

---

## 11. Per LLM agent che lavora qui

Quando ti viene chiesto di costruire qualcosa in questo repo:

1. **Leggi `IDEA.md`** se non l'hai mai letto in questa sessione.
2. **Probe le API prima di scrivere codice** — la sezione §3 va riverificata prima di ogni release, le API italiane cambiano spesso e silenziosamente.
3. **Non saltare al codice**: chiedi se siamo prima delle 10 domande, dell'MVP, o dopo. Le risposte cambiano radicalmente.
4. **Quando in dubbio sulla struttura**, scegli la versione più piccola. La struttura grossa è esplicitamente vietata finché non serve (§4).
5. **Citation policy è dura**: se non hai una fonte, non rispondere — di' "non ho potuto verificare".
6. **Italiano civico è il default** — vedi §5.
7. **Aggiorna questo CLAUDE.md** quando una decisione cambia. È la fonte di verità per le sessioni future.

---

## Riferimenti esterni

- LLM Wiki pattern (target futuro): https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- Autoresearch pattern (target futuro): https://github.com/karpathy/autoresearch
- Community: https://skool.com/superagents
- Developers Italia (non duplicare): https://developers.italia.it
- onData (non duplicare, alleare): https://datibenecomune.it
