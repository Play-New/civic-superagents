# tests/ — il gate di accettazione

`questions.jsonl` contiene le **10 domande civiche verificate a mano** (CLAUDE.md §6). È il faro del progetto: il wedge slice non è "fatto" finché non risponde a queste con citazioni che risalgono a `meta.fonti`.

## Disciplina

- `risposta` e `fonti` si compilano **solo dopo verifica manuale** sui dati scaricati. Finché `stato` è `da_verificare`, la riga è una *candidata*, non un test.
- Niente risposte inventate. Se il dato non regge la citation policy, la domanda esce dal set wedge e si segnala come trappola.
- Le domande candidate vengono da `notes/temi-civici-mappa.md` §2bis, ancorate a "il mio comune" su comuni lombardi reali (dato forte).

## Schema (una riga JSON per domanda)

```json
{"id":"Q01","tema":"rifiuti","domanda":"...","comune":"...","codice_istat":"...","risposta":null,"fonti":[],"verificatore":null,"data_verifica":null,"stato":"da_verificare"}
```

## Misura

Eseguire le 10 domande con un prompt minimale ("rispondi in italiano civico, cita le fonti") + query su Supabase. Contare le corrette, registrare dove sbaglia. **Si itera lo schema dal fallimento, non dall'idea.**
