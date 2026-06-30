# ISPRA Catasto Rifiuti — nota fonte

**Tema**: rifiuti urbani e % differenziata per comune/anno. → `mart.rifiuti_comune_anno`. Ingestor: `ingestors/rifiuti.ts`.
**URL CSV**: `https://www.catasto-rifiuti.isprambiente.it/get/getDettaglioComunale.csv.php?&aa=YYYY` (nota il `/get/` e la `&` iniziale). Verificato 2026-06-29. Anni ingeriti: 2020–2024.
**Join**: `IstatComune` (8 cifre = RR-region + 6 ISTAT) → `comune_istat = right(IstatComune,6)`. Mai assumere region='03'.

## Quirk

- ⚠️ **Endpoint trap**: solo `/get/getDettaglioComunale.csv.php` dà il CSV. La variante `index.php?pg=...` restituisce la shell HTML del sito.
- **Separatore `;`**; **decimale `,`**, **migliaia `.`** (es. `657.674,492` = 657674.492); `-`/vuoto = NULL; `%` come suffisso su Percentuale RD.
- **Tab iniziali** su ogni riga dati prima di `IstatComune` → strippare.
- ⚠️ **Niente colonna procapite** → calcolato: `Totale RU (t) * 1000 / Popolazione`. (Milano 2024 ≈ 481 kg/ab.)
- ⚠️ **Righe di aggregazione** (`Dato riferito a` ≠ `Comune`): `Aggregazione:` somma più comuni (gonfia), `Vedi aggregazione:` ha valori vuoti. → **ingerire solo `Dato riferito a = Comune`**.
- **2024 = ultimo anno utile** (2025 vuoto ~535 B). Riverificare la dimensione di 2025 prima di aggiungerlo.
- Colonne (0-indexed): IstatComune[0], Popolazione[4], Dato riferito a[5], Totale RU[23], Percentuale RD[24].
