# ANAC — appalti per comune — nota fonte

**Tema**: appalti aggiudicati dove la **stazione appaltante è un comune** ("chi vince gli appalti del mio comune"). → `mart.appalto`. Ingestor: `ingestors/appalti.ts`.
**CKAN**: `https://dati.anticorruzione.it/opendata/download/dataset/...` — ⚠️ **browser User-Agent obbligatorio** (WAF blocca curl generico). Verificato 2026-06-30. Ingerito: **2024**.
**4 dataset uniti su CIG**:
- `cig-2024` (master, zip mensili `cig_csv_2024_MM.zip`): cig, oggetto_gara, importo_complessivo_gara, cf_amministrazione_appaltante, denominazione_amministrazione_appaltante, anno.
- `stazioni-appaltanti` (3 MB): `codice_fiscale` → `citta_codice` (ISTAT) → comune.
- `aggiudicazioni` (151 MB, full): cig → importo_aggiudicazione, esito.
- `aggiudicatari` (151 MB, full): cig → vincitore (denominazione + CF, ruolo).

## Quirk

- **Comune = stazione appaltante**: si ancora a `cf_amministrazione_appaltante` con `denominazione LIKE 'COMUNE %'` → comune via `stazioni-appaltanti.citta_codice`. (Alternativa: `luogo_istat` = luogo di esecuzione, può differire dalla sede della SA → NON usato.)
- ⚠️ **Caso speciale ROMA CAPITALE**: Roma non si chiama "Comune di Roma" (L. 42/2009) → la sua SA ha `denominazione='ROMA CAPITALE'` (CF `02438750586`, `citta_codice=058091`) e il filtro `^COMUNE` la scartava → **Roma aveva 0 appalti** (bug trovato 2026-06-30). Fix: match anche `^ROMA CAPITALE$` (esatto, per NON catturare i decoy omonimi dello stesso dataset: "Stazione Unica Appaltante della Città Metropolitana di Roma Capitale", "Azienda per la Mobilità di Roma Capitale SpA", "Commissario Straordinario … di Roma Capitale"). Roma è l'**unico** capoluogo con questo problema (gli altri sono "Comune di X").
- ⚠️ **Schema spezzato**: aggiudicazioni/aggiudicatari hanno SOLO il CIG (niente comune/SA) → bisogna tenere il `cig` master per sapere il comune. Join su `cig` (+`id_aggiudicazione` per multi-lotto).
- ⚠️ **Due importi**: `importo_complessivo_gara` (base d'asta, in cig) vs `importo_aggiudicazione` (prezzo di aggiudicazione) → `importo` = aggiudicazione, `importo_base` = base.
- **Multi-vincitore (ATI)**: aggiudicatari ha più righe per CIG con `ruolo` (MANDATARIA/MANDANTE) → preferiamo **MANDATARIA**.
- ⚠️ **Soglia ~€40k**: questi sono i CIG **ordinari** (sopra soglia); il sotto-soglia/affidamenti diretti è in **SmartCIG** (dataset separati) → **NON incluso**, da dichiarare ("copertura sopra ~€40k").
- Gare in corso senza vincitore: `esito` tipo "NON È ANCORA STATO SELEZIONATO…" → restano senza aggiudicatario (filtrare su `aggiudicatario is not null` per "chi vince").
- CSV: `;`, quotati, UTF-8, decimale `.`. CIG revocati restano in elenco (flag cancellazione) — gestire.
- Esito 2024 (post-fix Roma): 7.545 comuni SA, **331.042 gare comunali**, ~**331k appalti** upserted (con Roma Capitale incluso). Verifica: Milano top aggiudicatario MM S.p.A. (in-house, €410M); Brescia 563 gare.
- IPA Indice PA (`enti.xlsx`, `Codice_comune_ISTAT`) è una lookup CF→comune **alternativa** (non usata: ANAC `stazioni-appaltanti` è già self-contained).

**Licenza** (verificata 2026-06-30): **CC-BY-4.0** — il portale ANAC opendata adotta lo schema CC-BY 4.0 raccomandato AgID; conferma indipendente su Open Contracting Partnership (publication 117). Attribuzione ad ANAC obbligatoria.
