// ISPRA Consumo di suolo (ed. 2025, dati al 2024) -> mart.consumo_suolo_comune.
// Single XLSX, sheet Comuni_2006_2024. anno hardcoded 2024 (stock). Join via PRO_COM -> zfill(6).
import { sql } from './_framework/env'
import { fetchBuffer } from './_framework/download'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import { toNum, loadComuneSet, bulkUpsert } from './_framework/util'
import * as XLSX from 'xlsx'

const SRC = 'ispra_consumo_suolo'
const SNAP = '2026-06-29'
const URL =
  'https://www.isprambiente.gov.it/it/attivita/suolo-e-territorio/suolo/il-consumo-di-suolo/consumo_di_suolo_estratto_dati_2025_anni_2006_2024.xlsx'
const SHEET = 'Comuni_2006_2024'
const ANNO = 2024
const C_PROCOM = 0
const C_INCR_NETTO = 34
const C_HA = 37
const C_PCT = 38

const r2 = (v: number | null) => (v != null ? Math.round(v * 100) / 100 : null)

async function main() {
  await ensureBucket()
  const valid = await loadComuneSet()
  const buf = await fetchBuffer(URL)
  const storage_path = await landSnapshot(
    SRC, '2025', 'consumo_suolo_2006_2024.xlsx', buf,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  const fonteId = await recordFonte({
    source: SRC, dataset_id: 'comuni_2006_2024',
    titolo: 'ISPRA Consumo di suolo — edizione 2025 (dati al 2024), per comune',
    url: URL, snapshot_date: SNAP, storage_path, formato: 'xlsx', license: 'CC-BY-4.0',
    latest_usable_year: 2024, granularita: 'comune', note_path: 'notes/ispra-consumo-suolo.md',
    quirks: 'anno=2024 (stock); incremento netto puo essere negativo (ripristino), non e un sentinel; join via PRO_COM zfill(6)',
  })

  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[SHEET]
  if (!ws) throw new Error(`sheet '${SHEET}' missing; have: ${wb.SheetNames.join(', ')}`)
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true })

  const rows: Record<string, unknown>[] = []
  let skipped = 0
  for (let r = 1; r < aoa.length; r++) {
    const a = aoa[r]
    if (!a || a[C_PROCOM] == null) continue
    const proCom = Number(a[C_PROCOM])
    if (!Number.isFinite(proCom)) continue
    const istat = String(proCom).padStart(6, '0')
    if (!valid.has(istat)) { skipped++; continue }
    rows.push({
      comune_istat: istat,
      anno: ANNO,
      suolo_consumato_ha: r2(toNum(a[C_HA])),
      incremento_ha: r2(toNum(a[C_INCR_NETTO])),
      suolo_consumato_pct: r2(toNum(a[C_PCT])),
      fonte_id: fonteId,
    })
  }
  const n = await bulkUpsert(
    'mart.consumo_suolo_comune', rows,
    ['comune_istat', 'anno', 'suolo_consumato_ha', 'incremento_ha', 'suolo_consumato_pct', 'fonte_id'],
    '(comune_istat, anno)',
    ['suolo_consumato_ha', 'incremento_ha', 'suolo_consumato_pct', 'fonte_id'],
  )
  console.log('consumo_suolo done. upserted:', n, '| skipped (unknown istat):', skipped)
  await sql.end()
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
