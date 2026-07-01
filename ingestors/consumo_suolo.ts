// ISPRA Consumo di suolo (ed. 2025, dati al 2024) -> mart.consumo_suolo_comune.
// Single XLSX, sheet Comuni_2006_2024. anno hardcoded 2024 (stock). Join via PRO_COM -> zfill(6).
// Colonne risolte per NOME header a runtime (nota: ISPRA rimodella il file a ogni edizione).
import { sql, SNAP } from './_framework/env'
import { fetchBuffer } from './_framework/download'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import { toNum, loadComuneSet, bulkUpsert } from './_framework/util'
import * as XLSX from 'xlsx'

const SRC = 'ispra_consumo_suolo'
const URL =
  'https://www.isprambiente.gov.it/it/attivita/suolo-e-territorio/suolo/il-consumo-di-suolo/consumo_di_suolo_estratto_dati_2025_anni_2006_2024.xlsx'
const SHEET = 'Comuni_2006_2024'
const ANNO = 2024
// Etichette header attese (vedi notes/ispra-consumo-suolo.md): leggere per nome colonna, non per indice.
const H_PROCOM = 'PRO_COM'
const H_INCR_NETTO = `Incremento netto ${ANNO - 1}-${ANNO} [ettari]`
const H_HA = `Suolo consumato ${ANNO} [ettari]`
const H_PCT = `Suolo consumato ${ANNO} [%]`

const r2 = (v: number | null) => (v != null ? Math.round(v * 100) / 100 : null)
// Match case/whitespace-insensitive, tollerante su punteggiatura minore ([]().,-_ ecc.); '%' resta distintivo.
const normHdr = (v: unknown) =>
  String(v ?? '').toLowerCase().replace(/[[\]().,;:'"_\-–—]/g, ' ').replace(/\s+/g, ' ').trim()
const findCol = (header: unknown[], label: string): number => {
  const want = normHdr(label)
  const i = header.findIndex((h) => normHdr(h) === want)
  if (i < 0)
    throw new Error(
      `colonna '${label}' non trovata nell'header dello sheet '${SHEET}' — ISPRA ha rimodellato il file? Header attuale: ${header.map((h) => String(h ?? '')).join(' | ')}`,
    )
  return i
}

async function main() {
  await ensureBucket()
  const valid = await loadComuneSet()
  const buf = await fetchBuffer(URL)
  const storage_path = await landSnapshot(
    SRC, 'edizione2025/consumo_suolo_2006_2024.xlsx', buf,
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
  const header = aoa[0]
  if (!header?.length) throw new Error(`header mancante nello sheet '${SHEET}'`)
  const C_PROCOM = findCol(header, H_PROCOM)
  const C_INCR_NETTO = findCol(header, H_INCR_NETTO)
  const C_HA = findCol(header, H_HA)
  const C_PCT = findCol(header, H_PCT)

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
