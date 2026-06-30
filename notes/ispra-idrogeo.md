# ISPRA IdroGEO — nota fonte (frane/alluvioni)

**Tema**: rischio frane e alluvioni per comune. → `mart.idrogeo_comune`. Ingestor: `ingestors/idrogeo.ts`.
**API**: `https://idrogeo.isprambiente.it/api/pir/comuni/{pro_com}` — un GET per comune, JSON object. Verificato 2026-06-29.
**Join**: path `{pro_com}` = `geo.comuni.pro_com` (int). L'API **non** restituisce codice ISTAT → si risale via `pro_com`.
**Licenza**: AGPL-3.0 (codice API); il dato ISPRA è verosimilmente CC-BY/CC-BY-SA — **da verificare** sulla pagina open-data prima di pubblicare.

## Quirk

- ⚠️ **Naming dei campi NON uniforme** (trappola verificata): la popolazione esposta a frane P3+P4 è **`popfr_p3p4`** (357 per Sondrio), NON `pop_fr_p3p4` (che non esiste; esistono solo `pop_fr_p3`, `pop_fr_p4`). La % area è invece `ar_frp3p4p`. Le alluvioni usano `pop_idr_p3` (no P4 per le alluvioni) e `aridp3_p`.
- Mapping → mart: `popfr_p3p4`→pop_esposta_frane · `pop_idr_p3`→pop_esposta_alluvioni · `ar_frp3p4p`→area_pericolosita_frane_pct · `aridp3_p`→area_pericolosita_alluvioni_pct.
- **`classe` non esiste** nell'API → NULL (o derivare con regola documentata).
- **Zero ≠ null**: i comuni pianeggianti restituiscono `0` reale per le frane, non NULL. Nessun sentinel `-9999`.
- **3 comuni su 7899 danno 404** (non presenti nel set IdroGEO) → registrati come mancanti.
- Rate limit 1000/sec (generoso); ingest a chunk di 40 concorrenti, ~1 min.
- Dato statico (Mosaicatura ISPRA 2020/2021, pop. censimento 2021) → non real-time.
