# Civic SuperAgents

Un commons di agenti AI civici per interrogare la PA italiana in italiano naturale.

## 3.555 dataset pubblici, leggibili solo agli addetti

I dati sulla PA italiana sono aperti. OpenBDAP pubblica 3.555 dataset in CC-BY, ANAC rilascia ogni mese gli appalti in formato OCDS, ISTAT espone SDMX, Openpolis mantiene una API v3 sui politici italiani, onData ha mappato il PNRR progetto per progetto. Sulla carta la trasparenza esiste.

Nel concreto resta una promessa disattesa. Il bilancio del Comune di Varese è pubblico, ma scritto in codici SIOPE, capitoli e macrocategorie comprensibili a un ragioniere pubblico. Le delibere stanno in albo pretorio con un lessico amministrativo impenetrabile. I progetti PNRR sul territorio sono tracciati ma dispersi tra ReGiS (chiuso al cittadino), OpenCUP, ANAC e dashboard regionali. L'asimmetria informativa cittadino-amministrazione è intatta dopo vent'anni di politiche open data.

Nel frattempo l'AI entra nella PA dall'alto. Il censimento AgID 2025 su 108 amministrazioni centrali rileva 120 progetti IA attivi, il 60% dei quali sono chatbot, e solo il 20% ha definito KPI di impatto misurabili. Il mercato vende ai fornitori, i fornitori vendono alle PA, le PA comprano. Il cittadino resta fuori.

## Skill AI civici come bene comune

Un bene comune digitale: skill AI e MCP server sui dati pubblici italiani. Li si può consumare da Claude o da qualsiasi altro agente, per interrogare un comune in italiano naturale. Governance RFC-style, licenza aperta (EUPL per il codice, CC-BY-SA per prompt e documentazione), repo GitHub pubblico.

## Il 5-10% che vuole leggere e non sa leggere SIOPE

L'utente realistico è il cittadino civic-engaged: giornalisti locali, consiglieri di opposizione, comitati di quartiere, ricercatori di policy, attivisti trasparenza, studenti universitari. Sono circa 3-5 milioni di persone. Il bacino è il 5-10% della popolazione adulta che vuole leggere un bilancio e non sa leggere SIOPE. Quando gli strumenti funzionano per loro, i dipendenti pubblici interessati li scoprono dal lato cittadino e li portano in ufficio: è un effetto di seconda ondata, non un target di design.

## Da giorni a minuti

Il giornalista di un quotidiano di provincia che oggi impiega due giorni per scrivere un pezzo sul bilancio comunale lo scrive in due ore, con i confronti tra comuni simili già inclusi. Il consigliere di opposizione prepara un'interrogazione su un'opera PNRR in mezza giornata invece che in una settimana. Il comitato di quartiere che contesta un regolamento urbanistico trova in pochi minuti i cinquanta regolamenti simili già approvati altrove, con le osservazioni presentate e gli esiti dei ricorsi. Il ricercatore universitario che lavora a un'analisi sulla spesa sanitaria regionale ha accesso interrogabile ai dati strutturati che oggi richiedono settimane di pulizia.

La grandezza misurabile è il tempo. Giorni di lavoro manuale diventano minuti. Questo libera una capacità di verifica civica oggi frenata dal costo-tempo più che dalla mancanza di interesse.

## Perché un commons

La maggioranza dei comuni che oggi acquista AI lo fa da fornitori privati, nei propri silos, senza riuso. L'alternativa privata produce lock-in e moltiplica il costo pubblico sulla scala di 7.900 comuni. Un commons genera un corpus condiviso di skill testati, un repo RFC pubblico, un test set che cresce con l'uso, un patrimonio che resta italiano. Developers Italia ha dimostrato dal 2017 che il modello funziona per il software riusabile nella PA, con 663 amministrazioni e 159 software a catalogo. Per gli agenti AI il contenitore equivalente ancora manca.

## Quattro skill nel primo giro

**Leggi il tuo comune.** Dato un comune, l'agente racconta bilancio, opere in corso, PNRR locale e personale in italiano leggibile, con confronto a dieci peer simili. Dati: OpenBDAP, OpenCUP, ISTAT, IPA.

**Gemelli finanziari.** MCP server che restituisce i dieci comuni più simili a quello dato, calibrati su popolazione, classe demografica D.Lgs. 118/2011, geografia, profilo di spesa. È l'infrastruttura condivisa di tutti gli altri skill.

**Radar PNRR locale.** Progetti PNRR sul territorio con stato di avanzamento, importi, realizzatori. Dati: OpenCUP, ANAC OCDS, guida onData.

**Helper FOIA.** Accompagnamento alla redazione di un'istanza di accesso civico generalizzato, con citazione normativa corretta e identificazione dell'ufficio di competenza. Skill di knowledge-base normativa, senza API dati esterne.

## Primi 90 giorni

Manifesto pubblico in una pagina. Repo GitHub `civic-superagents` con README, CONTRIBUTING, template RFC. Un MCP server `openbdap` con tre tool funzionanti. Lo skill `leggi-il-tuo-comune` testato su un comune pilota medio-piccolo con un cittadino volontario reale. Prima live settimanale dentro Skool SuperAgents, con onboarding dei primi contributor. Un primo RFC approvato secondo processo.

Niente manifesto senza codice, niente codice senza test su un cittadino reale.

## Decisioni ancora aperte

L'entità titolare del namespace nel medio termine, fra associazione del Terzo Settore, fondazione dedicata, hosting sotto un progetto civico esistente come onData. Se attivare una collaborazione formale con onData/datibenecomune prima del primo RFC, dato che il perimetro dati si sovrappone. Il finanziamento dell'inference LLM per l'uso pubblico: BYO-Claude, sponsor istituzionale, soglia pay-per-use oltre una certa soglia di utilizzo. Il nome pubblico definitivo.
