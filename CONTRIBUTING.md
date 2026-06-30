# Contribuire a Civic SuperAgents

Un commons di skill AI civici e dati pubblici italiani, comune-keyed. Governance **RFC-style** sotto la community SuperAgents (skool.com/superagents).

## Regole non negoziabili

1. **Citation policy dura** (CLAUDE.md §5): ogni claim numerica/normativa risale a una riga `meta.fonti` → file immutabile in Storage `raw/`. Senza fonte, non si risponde.
2. **Il comune è la chiave**: ogni nuova `mart.*` ha `comune_istat` (→ `geo.comuni`) e `fonte_id` (→ `meta.fonti`).
3. **Trappole dichiarate**: i temi a dato assente/chiuso (liste d'attesa, acqua potabile, ritardi treni, criminalità comunale, soldi-cultura) si segnalano come *"non pubblicato"*, non si promettono.
4. **Italiano civico** (CLAUDE.md §5): né burocratico né infantile; terzo neutrale; disclaimer espliciti.
5. **Probe prima del codice** (CLAUDE.md §11): le API italiane cambiano in silenzio → riverificare gli endpoint prima di ogni release; aggiornare le note `notes/<fonte>.md`.
6. **Niente vendor lock-in** (LLM portabili) e **niente account utente** (stateless, minimal-risk AI Act, CLAUDE.md §10).

## Aggiungere una fonte (ingestor)

1. Sonda la fonte (shape: endpoint, formato, encoding, chiave comune, quirk). Apri un **RFC** (`rfc/`, vedi template) se introduce un nuovo tema o tabella.
2. Dichiara la fonte in `ingestors/manifest.yaml`.
3. Implementa l'ingestor seguendo il contratto in `ingestors/README.md` (fetch → land snapshot → load → upsert `mart.*` → `meta.fonti` + nota).
4. Scrivi `notes/<fonte>.md` coi quirk osservati.
5. Aggiungi una verifica (estendi `verify_*.ts`) su comuni reali.

## Aggiungere uno skill / tool MCP

Esponi il dato via `mcp/` (tool con `fonti` citabili). La narrazione in italiano civico la fa il client/skill, non il data layer.

## Processo RFC

Ogni nuovo tema, skill o cambiamento di schema entra con un RFC (`rfc/NNNN-titolo.md`) discusso in pubblico (Skool) prima del merge. Le decisioni si registrano in `CLAUDE.md` (fonte di verità per le sessioni LLM).

## Licenze

Codice EUPL-1.2, prompt/docs CC-BY-SA-4.0 (vedi `LICENSE`). Contribuendo accetti queste licenze.
