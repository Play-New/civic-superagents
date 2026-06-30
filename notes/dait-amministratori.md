# DAIT (Min. Interno) — amministratori comunali — nota fonte

**Tema**: "chi governa" — amministratori comunali in carica (sindaci, assessori, consiglieri). → `mart.amministratore_comune`. Ingestor: `ingestors/amministratori.ts`.
**URL**: `https://dait.interno.gov.it/documenti/ammcom.csv` (~27 MB, 116.054 righe). Verificato 2026-06-29.
**Licenza**: ⚠️ **NON dichiarata** sulle pagine DAIT/dati.gov.it → **verificare prima di citare** (non assumere IODL/CC-BY).

## Quirk

- **Header alla riga 3** (righe 1-2 = metadati `"Amministratori..."` / `"Aggiornato al gg/mm/aaaa"`) → `from_line: 3`. Separatore `;`, campi quotati, UTF-8, date `GG/MM/AAAA`.
- ⚠️ **I codici comune DAIT NON sono ISTAT** (codifica storica Min. Interno, non mappabile aritmeticamente). → join per **nome + sigla provincia**, non per codice.
- Join robusto (vedi `normName`): strip accenti + apostrofi. Due trappole risolte:
  - **Alto Adige bilingue**: geo `Bolzano/Bozen` vs DAIT `BOLZANO` → si indicizzano gli **alias separati da `/`**.
  - **Province sarde abolite (2016)**: DAIT usa ancora `OT`/`VS`/`CI`/`OG` mentre lo spine ha le province attuali → **fallback su nome nazionalmente univoco** (Olbia, Carbonia… sono univoci). I 5 omonimi nazionali (SAMONE, CASTRO, LIVO, PEGLIO, SAN TEODORO) restano disambiguati per sigla.
  - Risultato: 115.654/116.054 (99,7%); ~400 residui = comuni fusi/rinominati (long tail accettabile).
- Campi → mart: `descrizione_carica`→carica (Sindaco/Assessore/Consigliere…), `incarico`→sotto-ruolo (Vicesindaco…, spesso vuoto), `lista_appartenenza/collegamento`→lista (multi-valore con ` | `), `data_nascita`/`data_elezione`→date.
- Include ruoli commissariali (Commissario Straordinario/Prefettizio) → filtrare se si vuole solo eletti.
- **Refresh completo** (delete+insert): la fonte è uno snapshot nazionale (es. "aggiornato al 06/06/2026").
- File per-provincia (`/documenti/provincia_di_*.csv`) per load incrementali.
