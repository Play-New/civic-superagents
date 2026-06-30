# mcp/ — Civic SuperAgents MCP server

Serve il data lake come **strumenti civici** (stdio in locale, **Streamable HTTP** in produzione). È lo strato agentico del progetto: un cittadino (via Claude o altro agente) interroga il proprio comune in italiano naturale, con ogni dato ancorato a una fonte citabile.

`createServer()` (`mcp/server.ts`) registra tutti i tool e viene montato da due entry: `mcp/stdio.ts` (locale/Claude Desktop) e `mcp/http.ts` (Express + `StreamableHTTPServerTransport`, per il deploy).

## Tool (11)

**Lettura / consultazione**
| Tool | Cosa fa |
|---|---|
| `cerca_comune({ nome })` | Trova comuni per nome (anche parziale) → codice ISTAT, provincia, regione, popolazione. Per disambiguare. |
| `leggi_comune({ comune })` | Profilo civico completo (ambiente · scuola · bilancio per missione · fondi coesione+PNRR · **appalti** + top aggiudicatari · **gemelli** finanziari · chi governa) + `fonti` citabili. Input: nome o codice ISTAT. |
| `progetti_comune({ comune, tipo })` | Elenca i progetti reali (`pnrr` o `coesione`): titolo, importo, stato/ambito. |
| `confronta_comuni({ comune_a, comune_b })` | Confronto fianco-a-fianco delle metriche chiave (pop, RD%, consumo suolo, PM10, spesa pro-capite, fondi). |
| `classifica({ tema, regione?, ordine?, limite? })` | Ranking comuni per tema (consumo_suolo, rifiuti_rd, rifiuti_procapite, aria_pm10, spesa_procapite, frane, biblioteche), filtrabile per regione. |
| `appalti_comune({ comune, limite? })` | Appalti ANAC del comune (≥ €40k): aggiudicatario, importo, oggetto, anno. |
| `helper_foia({ oggetto, ente? })` | Bozza di accesso civico (FOIA) con i riferimenti normativi verificati. |

**Revisione (scrittura sulle 2 tabelle `meta.test_question` / `meta.source_license_review`)** — i due task umani, eseguibili in chat:
| Tool | Cosa fa |
|---|---|
| `domande_da_verificare()` | Elenca le risposte del test set ancora da firmare. |
| `firma_risposta({ id, esito, risposta_corretta?, note? })` | Firma una risposta (`verificato`/`corretto`/`scartato`). |
| `fonti_da_verificare()` | Elenca le fonti con licenza non ancora confermata. |
| `verifica_licenza({ source, esito, license?, note? })` | Conferma/corregge la licenza di una fonte. |

`leggi_comune` & co. restituiscono JSON strutturato + un array `fonti` (da `meta.fonti`): la narrazione in *italiano civico* e la citazione la fa il client/skill (separazione dati ↔ voce, CLAUDE.md §5).

## Avvio

```bash
npm run mcp            # tsx mcp/stdio.ts (stdio, locale)
npm run start:http     # tsx mcp/http.ts  (Streamable HTTP, prod) — usa PORT, MCP_AUTH_TOKEN
```
Richiede `.env` con `SUPABASE_DB_URL_READONLY` (ruolo `civic_serve`, pooler). Lo strato serving usa **solo** la connessione DB read-only.

## Deploy come server HTTP

`mcp/http.ts` espone gli stessi tool via **Streamable HTTP** (Express). Imposta `MCP_AUTH_TOKEN` per proteggere l'intero endpoint `POST /mcp` con un bearer token (`GET /health` resta aperto per l'healthcheck). Esegui la tua istanza dove preferisci:

```bash
MCP_AUTH_TOKEN=$(openssl rand -hex 32) npm run start:http
# client: claude mcp add --transport http <nome> https://<tuo-host>/mcp --header "Authorization: Bearer <token>"
```

## Registrazione locale (stdio)

```bash
claude mcp add civic-superagents -- npx tsx /ABS/PATH/civic-superagents/mcp/stdio.ts
```

## Posture

- **Read-only**: il ruolo `civic_serve` ha solo SELECT, più INSERT/UPDATE **esclusivamente** sulle 2 tabelle di revisione (`scripts/setup_readonly.ts`). Nessuna service key nel serving.
- **Bearer token**: l'intero `/mcp` è chiuso da `MCP_AUTH_TOKEN`; senza header → 401.
- **Stateless**: nessun account utente (postura minimal-risk AI Act).
- **Citation policy dura**: ogni numero risale a `meta.fonti` → file immutabile in Storage `raw/`.
