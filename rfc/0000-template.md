# RFC NNNN — <titolo>

- **Stato**: bozza | in discussione | accettato | rifiutato | superato
- **Autore**: <nome / handle>
- **Data**: AAAA-MM-GG
- **Tipo**: nuovo tema | nuova fonte | nuovo skill/tool | cambio schema | governance

## Sommario
Una frase: cosa propone questo RFC.

## Motivazione (civica)
Quale domanda civica reale abilita? Per chi (giornalista locale, comitato, opposizione, ricercatore)? Perché ora.

## Fonte/i dati
- Endpoint(s), formato, licenza, granularità (comune?), cadenza.
- Esito del **probe** (verificato il AAAA-MM-GG): quirk, encoding, chiave comune, trappole.
- Regge la **citation policy** (ogni dato → fonte immutabile)? Se no, è una 🔴 trappola da dichiarare, non un wedge.

## Schema / impatto
- Tabelle `mart.*` nuove o modificate (con `comune_istat` + `fonte_id`).
- Impatto su `leggi_comune` / altri tool MCP.

## Verifica
Come si verifica end-to-end (query su comuni reali, risposte attese, note `notes/<fonte>.md`).

## Onestà / limiti
Cosa NON copre. Dato mancante o chiuso → dichiararlo.

## Alternative considerate
Altre fonti/approcci scartati e perché.
