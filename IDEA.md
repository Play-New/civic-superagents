# Civic SuperAgents

**Un commons di agenti AI civici per rendere leggibile la PA italiana ai cittadini che vogliono capirla.**

Progetto della community SuperAgents — [skool.com/superagents](https://skool.com/superagents). Non un prodotto, non un'offerta a pagamento. Un bene comune costruito in pubblico, con governance RFC-style, sotto licenza aperta.

---

## Il problema

In Italia i dati pubblici ci sono. Sono molti, sono aperti, sono in CC-BY. Non sono leggibili. OpenBDAP ha 3.555 dataset, ANAC pubblica appalti in OCDS, ISTAT espone SDMX, OpenCUP georeferenzia opere, onData mappa il PNRR. Tutto fruibile — in teoria. In pratica: tracciati record densi, codici SIOPE tecnici, capitoli di bilancio a migliaia di voci, interfacce per addetti.

Il cittadino italiano che vuole capire cosa fa il suo comune non ha strumenti. L'asimmetria informativa cittadino↔comune è intatta nonostante vent'anni di open data. L'AI sta arrivando nella PA dall'alto (progetti AgID, chatbot ai cittadini spinti dai fornitori, LCOAI da misurare) — nessuno sta costruendo dal basso, per il cittadino.

## L'idea

Un commons di **skill civici** (prompt + knowledge packs + tool calls) e **MCP server** sui dati pubblici italiani, che qualsiasi cittadino possa usare via Claude, o qualsiasi altro agente, per interrogare il proprio comune in italiano naturale. Sotto un tetto di community: RFC pubblici per ogni nuovo skill, test set condiviso, licenza aperta (EUPL per codice, CC-BY-SA per prompt), repo GitHub pubblico, discussione in Skool SuperAgents.

---

## I fondamenti strategici

### Chi è il cliente

Il **cittadino civic-engaged italiano**: giornalisti locali, consiglieri di opposizione, comitati di quartiere, studenti di policy, ricercatori GRINS, comuni di attivisti trasparenza, committenti di petizioni. Non il mass-market (Mario Rossi non apre l'app per il TARI). Il bacino realistico è il 5-10% della popolazione adulta che *vuole* leggere un bilancio ma non sa leggere SIOPE.

Il secondo cliente, per via dell'effetto Trojan, è il **dipendente PA** che scopre lo stesso skill dal lato cittadino e lo porta in ufficio — ma è conseguenza del design, non target.

### Valore atteso

Dato un comune qualsiasi, renderlo **leggibile in italiano naturale** su cinque dimensioni: bilancio, opere pubbliche, PNRR, personale, atti. Con confronto automatico a 10 comuni simili. Più helper per **esercitare diritti**: FOIA, osservazioni, accesso civico. Rompere l'asimmetria informativa con dati già pubblici, solo finalmente leggibili.

### Cosa accumula (World Model)

Un commons accumula in modo diverso da un prodotto. Quattro sorgenti di learning compound:

- **Taxonomy delle domande civiche.** Quali interrogazioni i cittadini fanno davvero, quali ricorrono per territorio, quali rivelano buchi nei dataset aperti. Questo è il signal più denso: dice dove BDAP è ancora opaco.
- **Narrative templates per comune.** Più un comune viene interrogato, più la sua lettura (peer set, flag anomalie, contesto storico) si sedimenta. Cache pubblica per comune, riusabile da qualsiasi agente.
- **Signal di accettazione via Interface.** Quali interpretazioni di un bilancio o di una delibera vengono citate, condivise, corrette. Dove il rewrite di una delibera viene modificato dall'utente prima di condividerlo — è la traccia più ricca di cosa l'agente ha sbagliato.
- **Corpus RFC + test set pubblico.** Ogni skill entra con test case e baseline. Il corpus stesso è il manufatto difendibile della community.

Scope: prevalentemente **aggregate**, con layer **per-comune**. Nessun account utente nel primo giro (sceglie stateless; riduce il costo regolatorio e operativo a zero).

### Dove sta il genesis

Non nei dati (commodity: sono lì, in CC-BY, già mappati da onData). Non nell'infrastruttura di query (OpenBDAP CKAN + OData, ANAC OCDS, ISTAT SDMX, Openpolis v3 — tutti esposti). Non nella modellistica (LLM disponibili ovunque).

Il genesis sta in **due punti precisi**:

1. **Il linguaggio civico italiano.** Tradurre `SIOPE 1.03.02.09.008` in "spese per servizi informatici", "il Comune di X spende il 40% in più dei suoi gemelli demografici sulla voce Y" — con lessico amministrativo corretto, citazione delle fonti, tono non partigiano, disclaimer calibrati. Nessun LLM lo fa bene out-of-the-box. Si costruisce solo con skill curati e test set specifico.

2. **Il grafo peer-similarity italiano.** Chi è "simile al mio comune" non è ovvio. Popolazione × classe demografica D.Lgs. 118/2011 × geografia × struttura economica × profilo politico. Il peer set giusto è la precondizione per ogni confronto. Oggi nessuno lo mantiene come risorsa pubblica riusabile.

Tutto il resto — skill individuali, interfaccia, connettori — è product-stage o commodity.

### Cosa comprare, cosa costruire

| | Costruire | Comprare/riutilizzare |
|---|---|---|
| Enrichment | Peer-similarity graph, classificazioni civiche | API onData (PNRR), IPA (codici enti), geojson-italy |
| Inference | Anomaly detection su bilanci, clustering domande | LLM per entity resolution |
| Interpretation | Skill di narrazione civica (il genesis) | — |
| Delivery | Pattern RFC + versioning skill | Claude (primo modello), Skool (community), GitHub (repo) |

### Postura regolatoria

Progetto **minimal-risk AI Act** nel primo giro, se: (a) query solo su dati pubblici CC-BY, (b) output consegnato al cittadino (non usato da comuni per triage di welfare — cambierebbe tier), (c) nessun account utente, (d) transparency labeling art. 50 rispettato, (e) tracking politici locali limitato a dati di ruolo pubblico. DPIA non richiesta. GDPR basis quasi irrilevante (server processa solo dati pubblici).

Il giorno in cui entriamo in Annex III (es. comune usa lo skill per decidere ISEE) diventiamo high-risk e la governance va riscritta. Da tenere fuori dal primo anno.

---

## Quali skill costruire per primi

Dei 10+ casi d'uso emersi nella conversazione, ne seleziono quattro che sono **buildable oggi** (API pubbliche verificate, no scraping, no crawler) e coprono i quattro livelli EIID del playbook:

### 1. Leggi il tuo comune — *genesi narrativa*
Carichi il nome del comune, l'agente pesca rendiconto BDAP + previsione 2026 + opere da OpenCUP + demografia ISTAT, normalizza pro capite, confronta con 10 gemelli e ti racconta in italiano dove spende, dove anomalie, dove ha fatto come promesso e dove no. **Dati: OpenBDAP + OpenCUP + ISTAT + IPA. Tutti aperti, tutti con API.**

### 2. Gemelli finanziari — *inferenza*
MCP server che dato un codice fiscale di comune restituisce i 10 peer più simili su criteri configurabili (popolazione, classe demografica, geografia, profilo spesa). Input per tutti gli altri skill. Costruisce il grafo di similarità — il genesis infrastrutturale del progetto.

### 3. Radar PNRR locale — *aggregazione*
Tutti i progetti PNRR sul territorio del comune con stato di avanzamento. **Dati: OpenCUP + ANAC (OCDS monthly) + onData pnrr.datibenecomune.it.** ReGiS non è aperto al pubblico, va ignorato.

### 4. Helper FOIA — *interpretazione*
Non serve accesso dati PA, serve knowledge base normativa (L. 241/1990, D.Lgs. 33/2013, giurisprudenza accesso civico). L'agente redige, il cittadino firma. Skill puro di prompting, governance semplice, rilascio rapidissimo. Utile da solo.

Esclusi dal primo giro perché buildable con sforzo maggiore o non buildable senza crawler:
- **Watchdog trasparenza**: ogni comune pubblica Amministrazione Trasparente in modo non standard. Richiede crawler per 7.900 comuni. Fase 2.
- **Il mio consigliere**: Openpolis copre i grandi comuni (API v3, `city_mayors` e simili). Sotto i 50k nessuno copre. Fase 2.
- **Bandi per te**: ANAC copre sopra i 40k€. Bandi comunali piccoli (buoni libro, assistenza sociale) sono nell'albo pretorio, scraping. Fase 2.
- **Segnala con contesto**: integrazione con sistemi comunali (SegnaLo ecc.) — out of scope commons.

---

## Il primo milestone (90 giorni)

1. **Manifesto in una pagina.** Cosa è, cosa non è, come si contribuisce, licenza. Pubblicato su Skool SuperAgents + landing pubblica.
2. **Repo GitHub `civic-superagents`.** README, CONTRIBUTING, RFC template, CODEOWNERS minimo.
3. **Un MCP server funzionante: `openbdap`**. Tre tool (`get_bilancio_comune`, `get_peer_comuni`, `get_opere_comune`). Test di integrazione con un codice fiscale reale.
4. **Uno skill pilota: `leggi-il-tuo-comune`**. Consuma l'MCP, risponde a "parlami del Comune di X" in italiano leggibile, con fonti citate.
5. **Uso reale su un comune pilota** — meglio piccolo/medio, non Milano. Un cittadino volontario (giornalista locale, consigliere opposizione, ricercatore) lo prova. Si misura: tempo-per-risposta, qualità percepita, cosa ha sbagliato.
6. **Prima live settimanale** dentro SuperAgents Skool con presentazione del primo RFC e onboarding contributor.

Niente manifesto-che-non-diventa-codice. Il manifesto e il primo skill viaggiano insieme.

## Cosa non fare

- **Non duplicare Developers Italia.** Loro sono il catalogo software riusabile per la PA. Noi siamo il catalogo di skill/prompt/MCP per chi vuole interrogare la PA. Linkare, non sovrapporre.
- **Non duplicare onData / datibenecomune.** Loro mappano dati, scrivono guide. Noi costruiamo lo strato agentico sopra. Prima di partire vale una DM a Andrea Borruso: "stiamo pensando a questo, si pesta qualcosa?".
- **Non cercare patrocini istituzionali prima di aver rilasciato.** AgID, ANCI, Anthropic arrivano quando c'è qualcosa da guardare. Prima i fatti.
- **Non legare l'architettura a un solo LLM.** Claude come modello iniziale (la community è lì, tu sei Ambassador), ma skill/MCP/prompt portabili. Un bene comune civico non può dipendere da un singolo vendor.
- **Non aprire account utente nel primo giro.** Stateless = zero GDPR operational, zero retention policy, zero Art 22. Quando servirà (fase 2), si apre con basis documentato.
- **Non prendere clienti PA come acquirenti.** Il momento in cui un comune ti paga per uno skill, il commons diventa fornitura e tu diventi vendor. Se qualche dirigente vuole pagare, va in una entità separata (Play New, se del caso) — ma il commons resta gratuito e aperto.

---

## Open questions

- **Entità titolare del namespace.** Community SuperAgents convened da Cosmico — ok nel breve. Nel medio: associazione del Terzo Settore? Fondazione dedicata? Hosting sotto un progetto esistente (ondata, Transparency Italia)? Va deciso prima che i contributor diventino molti.
- **Alleanza con onData.** Prima di partire: DM ad Andrea Borruso, esplorare co-branding o complementarità. Loro mappano dati, noi rendiamo i dati interrogabili in italiano via agente. Potenzialmente forte.
- **Finanziamento infra.** Chi paga l'inference LLM per l'uso pubblico? Opzioni: (a) il progetto è BYO-Claude (ogni cittadino usa la sua chiave) — povero ma pulito. (b) Sponsor istituzionale (fondazioni bancarie, Anthropic community grant). (c) Lo strato gratuito è limitato, pay-per-use oltre soglia — ma cambia natura.
- **Conferma tecnica su OpenBDAP.** Nel test di oggi il CKAN endpoint ha risposto 404 sul mio client; va rifatta prova con request reale prima del primo RFC. Se l'API pubblica fosse cambiata, piano B è consumare export CSV/JSON via cron locale.
- **Nome pubblico.** "Civic SuperAgents" è descrittivo ma lungo. "Comuno" (dominio libero?), "Leggilo" (verbo, italiano), altro. Da testare con la community.

---

## Inventario fonti

Il commons può estendersi molto oltre i quattro skill iniziali. Questo è il perimetro *realistico* delle fonti aperte italiane che un agente civico può consumare via API, SDMX, CKAN o download strutturato. Mappato per tema, con note su accessibilità e granularità comunale.

### Finanze e bilanci PA
- **OpenBDAP (MEF-RGS)** — [bdap-opendata.rgs.mef.gov.it](https://bdap-opendata.rgs.mef.gov.it/catalog) — 3.555 dataset CC-BY; CKAN v3 + OData proxy per interrogazione riga-per-riga
- **Soldipubblici** — [soldipubblici.gov.it](https://soldipubblici.gov.it) — pagamenti PA mensili RGS, export CSV
- **Banca d'Italia statistiche territoriali** — dati economici su base provinciale/regionale

### Appalti e contratti
- **ANAC Open Data** — [dati.anticorruzione.it/opendata](https://dati.anticorruzione.it/opendata/) — appalti OCDS, aggiornamento mensile, JSON
- **Piattaforma Contratti Pubblici (PCP)** — [developers.italia.it/it/piattaforma-contratti-pubblici](https://developers.italia.it/it/piattaforma-contratti-pubblici/) — API via PDND
- **Servizio Contratti Pubblici (MIT)** — bandi nazionali
- **CONSIP / MEPA** — centrale acquisti PA (accessibilità mista)

### PNRR e fondi
- **OpenCUP** — [opencup.gov.it](https://opencup.gov.it) — tutti i Codici Unici di Progetto, georeferenziati, API pubblica
- **OpenCoesione** — [opencoesione.gov.it](https://opencoesione.gov.it) — fondi FESR/FSE/FEASR e nazionali, progetti con CUP, API JSON
- **Italia Domani** — [italiadomani.gov.it](https://italiadomani.gov.it) — dashboard PNRR ufficiale
- **ReGiS** — chiuso al pubblico (solo PA)
- **Registro Nazionale Aiuti di Stato (RNA)** — [rna.mise.gov.it](https://rna.mise.gov.it) — aiuti ricevuti da imprese
- **OpenPNRR (Openpolis)** — monitoraggio civico
- **Monithon** — [monithon.eu](https://monithon.eu) — monitoraggio crowd-sourced

### Demografia e territorio
- **ISTAT** — SDMX web services; sottoportali: [esploradati.istat.it](https://esploradati.istat.it), [demo.istat.it](http://demo.istat.it) (popolazione), [situas.istat.it](https://situas.istat.it) (territoriale), Atlante comuni
- **IPA Indice PA** — [indicepa.gov.it](https://indicepa.gov.it) — codici fiscali e anagrafica enti pubblici, API
- **OpenStreetMap Italia** — dati geografici crowd-sourced, utile per georeferenziare opere
- **geojson-italy (Openpolis)** — [github.com/openpolis/geojson-italy](https://github.com/openpolis/geojson-italy) — confini comunali, provinciali, regionali

### Politica, atti, normativa
- **Openpolis API v3** — [api3.openpolis.it](http://api3.openpolis.it/) — `politici`, `parlamento`, `territori`; include city_mayors; repo [openpolis/op_api3](https://github.com/openpolis/op_api3)
- **Open Municipio** — [github.com/openpolis/open_municipio](https://github.com/openpolis/open_municipio) — piattaforma trasparenza comunale
- **Normattiva** — [normattiva.it](https://normattiva.it) — normativa italiana, API sperimentale
- **Gazzetta Ufficiale** — bandi, nomine, atti (scraping limitato)
- **Ministero Interno — elezioni** — [elezioni.interno.gov.it](https://elezioni.interno.gov.it) — risultati voto per comune, sezione
- **Corte dei Conti** — decisioni e referti pubblici

### Sanità
- **AGENAS Piano Nazionale Esiti (PNE)** — [pne.agenas.it](https://pne.agenas.it) — esiti ospedalieri per struttura
- **Ministero Salute open data** — [dati.salute.gov.it](https://dati.salute.gov.it)
- **ISS EpiCentro** — sorveglianza epidemiologica
- **ASL regionali** — anagrafiche, spesso scraping

### Scuola e formazione
- **MIUR Scuola in Chiaro** — [cercalatuascuola.istruzione.it](https://cercalatuascuola.istruzione.it) — ogni scuola italiana: iscritti, personale, indirizzi di studio
- **Anagrafe Nazionale Studenti** — parziale, aggregata
- **INVALSI open data** — risultati aggregati per scuola/provincia

### Ambiente, servizi, utenze
- **ARERA** — [arera.it](https://arera.it) — tariffe elettricità/gas/acqua/rifiuti per gestore
- **ISPRA** — [isprambiente.gov.it](https://isprambiente.gov.it) — qualità aria, acque, rifiuti
- **Copernicus / Geoportale Nazionale** — dati satellitari territoriali

### Welfare, lavoro, pensioni
- **INPS open data** — [dati.inps.it](https://dati.inps.it) — prestazioni pensionistiche e assistenziali, aggregate
- **ANPAL / Inapp** — statistiche lavoro e politiche attive
- **Dipartimento Funzione Pubblica** — personale PA, spesa

### Giustizia, sicurezza
- **Ministero Giustizia — Giustizia in cifre** — tempi processi, pendenze per tribunale
- **Ministero Interno — dati sicurezza** — reati per provincia
- **DAP** — dati popolazione detenuta

### Trasporti e mobilità
- **ACI** — [aci.it](https://aci.it) — parco veicolare per comune, incidenti stradali
- **MIT** — infrastrutture, mobilità urbana

### Catasto e fiscale
- **Agenzia delle Entrate open data** — [agenziaentrate.gov.it/portale/opendata](https://www.agenziaentrate.gov.it/portale/opendata) — dichiarazioni aggregate, catasto parziale, OMI (osservatorio mercato immobiliare)
- **Registro Imprese Infocamere** — parzialmente aperto, maggior parte a pagamento

### Media e comunicazione
- **AGCOM** — [agcom.it](https://agcom.it) — diffusione media, connettività territoriale
- **Osservatorio Rai-Sport-Stampa** — dati pubblicitari

### Regioni (portali open data — i più maturi)
- **Emilia-Romagna** — [dati.emilia-romagna.it](https://dati.emilia-romagna.it) (tra i più ricchi)
- **Lombardia** — [dati.lombardia.it](https://dati.lombardia.it) (Socrata-based)
- **Piemonte** — [dati.piemonte.it](https://dati.piemonte.it)
- **Toscana** — [dati.toscana.it](https://dati.toscana.it)
- **Veneto** — [dati.veneto.it](https://dati.veneto.it)
- **Puglia** — [dati.puglia.it](https://dati.puglia.it)
- **Sardegna** — [opendata.regione.sardegna.it](https://opendata.regione.sardegna.it)
- più tutte le altre con portali DCAT-AP_IT

### Comuni con open data proprio
- **Milano** — [dati.comune.milano.it](https://dati.comune.milano.it)
- **Torino** — [aperto.comune.torino.it](http://aperto.comune.torino.it)
- **Bologna** — [opendata.comune.bologna.it](https://opendata.comune.bologna.it)
- **Firenze** — [opendata.comune.fi.it](https://opendata.comune.fi.it)
- **Palermo**, **Napoli**, **Roma**, **Genova** hanno portali con qualità variabile

### Aggregatori nazionali ed europei
- **dati.gov.it** — catalogo nazionale CKAN compatibile
- **European Data Portal** — [data.europa.eu](https://data.europa.eu) — aggrega anche italiano
- **DCAT-AP_IT** — standard metadati nazionale

### Osservatori, ricerca, campagne
- **onData / datibenecomune** — [datibenecomune.it](https://datibenecomune.it) + [pnrr.datibenecomune.it](https://pnrr.datibenecomune.it) — coalizione ActionAid + onData + Transparency Italia
- **Openpolis** — ricerche e dataset
- **GRINS Spoke 7** (UniBa + Polimi) — Territorial Capacities Monitor
- **T-Index Troisi Ricerche** — indicatore composito performance territoriale
- **ForumPA / FPA** — indagini e dataset periodici
- **Transparency International Italia** — indici trasparenza

### Quadro normativo di riferimento
- **Legge 132/2025** — prima cornice nazionale AI, art. 20 AgID come autorità
- **Linee guida AgID IA nella PA** — in adozione da dicembre 2025, LCOAI come metrica di procurement
- **D.Lgs. 33/2013** — obblighi trasparenza (sezione Amministrazione Trasparente)
- **AI Act (Reg. UE 2024/1689)** — tier di rischio applicabili
- **CAD art. 69** — riuso software PA

### Cosa resta fuori dal perimetro aperto (limiti da conoscere)
- **ReGiS** — solo PA
- **ANPR** — solo per il proprio fascicolo, serve identità digitale
- **Amministrazione Trasparente dei singoli comuni** — legge c'è, standardizzazione no: ogni comune pubblica come vuole → scraping/parser per-comune
- **Albo Pretorio** — idem, scraping
- **Verbali Consiglio Comunale** — raramente in formato strutturato per comuni sotto 50k abitanti
- **Catasto completo** — a pagamento via Sister
- **Casellario giudiziale** — non pubblico

Questo inventario suggerisce che il commons può naturalmente estendersi in sei macroaree tematiche (**finanze**, **opere/PNRR**, **politica/atti**, **sanità/scuola/welfare**, **ambiente/servizi**, **trasparenza/compliance**), con un MCP server dedicato per ciascuna. I primi quattro skill restano finanze+PNRR perché sono le API più mature e i dati più comparabili tra comuni. La fase 2 si apre su sanità (PNE → "le performance del mio ospedale") e scuola (Scuola in Chiaro → "la mia scuola"), entrambe con dati pubblici strutturati e impatto civico alto.
