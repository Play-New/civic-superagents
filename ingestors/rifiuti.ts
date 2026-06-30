// ISPRA Catasto Rifiuti -> mart.rifiuti_comune_anno (municipal waste per comune per year).
// CSV: ';' separated, decimal=',' thousands='.', leading tabs, '-'/empty=null. procapite is COMPUTED.
import { sql } from './_framework/env'
import { fetchBuffer } from './_framework/download'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import { parseItNumber, loadComuneSet, bulkUpsert } from './_framework/util'

const SRC = 'ispra_catasto_rifiuti'
const SNAP = '2026-06-29'
const YEARS = [2020, 2021, 2022, 2023, 2024]
const urlFor = (y: number) => `https://www.catasto-rifiuti.isprambiente.it/get/getDettaglioComunale.csv.php?&aa=${y}`

// 0-indexed columns of interest
const C_ISTAT = 0
const C_POP = 4
const C_DATO_RIF = 5
const C_TOT_RU = 23
const C_RD_PCT = 24

async function main() {
  await ensureBucket()
  const valid = await loadComuneSet()
  let grandTotal = 0

  for (const year of YEARS) {
    const url = urlFor(year)
    const buf = await fetchBuffer(url)
    const storage_path = await landSnapshot(SRC, String(year), `RUComunali_${year}.csv`, buf, 'text/csv')
    const fonteId = await recordFonte({
      source: SRC,
      dataset_id: `RUComunali_${year}`,
      titolo: `ISPRA Catasto Rifiuti — RU comunali ${year}`,
      url,
      snapshot_date: SNAP,
      storage_path,
      formato: 'csv',
      license: 'CC-BY-4.0',
      latest_usable_year: year,
      granularita: 'comune',
      note_path: 'notes/ispra-rifiuti.md',
      quirks: "sep=';', dec=',', migliaia='.', '-'/'' = null, tab iniziali, filtro 'Dato riferito a'='Comune'",
    })

    const lines = buf.toString('utf8').split(/\r?\n/)
    const rows: Record<string, unknown>[] = []
    let skipped = 0
    for (let li = 2; li < lines.length; li++) {
      const line = lines[li]
      if (!line || line.startsWith('Note:')) continue
      const f = line.replace(/^\t+/, '').split(';')
      if (f.length < 25) continue
      const istatFull = f[C_ISTAT].trim()
      if (!/^\d{8}$/.test(istatFull)) continue
      if (f[C_DATO_RIF].trim() !== 'Comune') { skipped++; continue } // skip Aggregazione / Vedi aggregazione
      const istat = istatFull.slice(-6)
      if (!valid.has(istat)) { skipped++; continue }
      const pop = parseItNumber(f[C_POP])
      const totRU = parseItNumber(f[C_TOT_RU])
      const rdPct = parseItNumber(f[C_RD_PCT])
      const procapite = totRU != null && pop && pop > 0 ? Math.round(((totRU * 1000) / pop) * 100) / 100 : null
      rows.push({
        comune_istat: istat,
        anno: year,
        rifiuti_tot_t: totRU,
        procapite_kg: procapite,
        rd_pct: rdPct,
        fonte_id: fonteId,
      })
    }
    const n = await bulkUpsert(
      'mart.rifiuti_comune_anno',
      rows,
      ['comune_istat', 'anno', 'rifiuti_tot_t', 'procapite_kg', 'rd_pct', 'fonte_id'],
      '(comune_istat, anno)',
      ['rifiuti_tot_t', 'procapite_kg', 'rd_pct', 'fonte_id'],
    )
    grandTotal += n
    console.log(`  ${year}: upserted ${n} comuni (skipped ${skipped} non-Comune/unknown)`)
  }
  console.log('rifiuti done. total rows:', grandTotal)
  await sql.end()
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
