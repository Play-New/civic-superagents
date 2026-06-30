# ISPRA Consumo di suolo — nota fonte

**Tema**: consumo di suolo per comune. → `mart.consumo_suolo_comune`. Ingestor: `ingestors/consumo_suolo.ts`.
**URL XLSX**: `https://www.isprambiente.gov.it/it/attivita/suolo-e-territorio/suolo/il-consumo-di-suolo/consumo_di_suolo_estratto_dati_2025_anni_2006_2024.xlsx` (~1,7 MB). Ed. 2025, dati al 2024. Verificato 2026-06-29.
**Licenza**: CC-BY 4.0 (Munafò M. a cura di, 2025, Report SNPA 46/2025).
**Join**: `PRO_COM` (int) → `comune_istat = str(PRO_COM).zfill(6)`.

## Quirk

- **Sheet da leggere**: `Comuni_2006_2024` (le altre: Descrizione_campi, Province_, Regioni_).
- **Celle numeriche native** (no problemi di decimale); attenzione al rumore float (`0.4799999…`) → arrotondare a 2 decimali.
- Colonne (0-indexed): PRO_COM[0], Incremento netto 2023-2024 [ettari][34], Suolo consumato 2024 [ettari][37], Suolo consumato 2024 [%][38].
- ⚠️ **`anno` non è una colonna**: lo stock è fisso al 2024 → hardcode `anno=2024`. Per una serie storica servirebbe l'unpivot delle colonne incremento per periodo.
- ⚠️ **Incremento netto può essere NEGATIVO** (224 comuni) quando il ripristino supera la nuova impermeabilizzazione — **è reale, non un sentinel**. (L'incremento *lordo* è sempre ≥ 0.)
- Il defined-name `_FilterDatabase` dichiara `A1:AK7897` ma i dati arrivano a colonna AM(39): leggere per **nome colonna**, non per il range del filtro.
- **Mai join sui nomi** (title-case con quirk tipo "Albiano D'Ivrea"): solo PRO_COM.
- URL stabile ma Varnish-cached: ISPRA può rinominare il file alla prossima edizione → riverificare.
