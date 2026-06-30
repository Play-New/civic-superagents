// ISPRA IdroGEO -> mart.idrogeo_comune (landslide/flood risk per comune).
// API: one GET per comune keyed by pro_com. Frane P3+P4 and flood P3 (elevata) are the headline indicators.
import { sql } from './_framework/env'
import { fetchJson } from './_framework/download'
import { recordFonte } from './_framework/provenance'
import { loadComuniByProCom, toNum, bulkUpsert } from './_framework/util'

const SRC = 'ispra_idrogeo'
const SNAP = '2026-06-29'
const API = 'https://idrogeo.isprambiente.it/api/pir/comuni'
const CHUNK = 40

interface Pir {
  popfr_p3p4?: number // pop esposta frane P3+P4 (NB: 'popfr_', non 'pop_fr_')
  pop_idr_p3?: number // pop esposta alluvioni P3 (elevata)
  ar_frp3p4p?: number // % area frane P3+P4
  aridp3_p?: number // % area alluvioni P3
}

async function main() {
  const byProCom = await loadComuniByProCom()
  const fonteId = await recordFonte({
    source: SRC,
    dataset_id: 'pir_comuni',
    titolo: 'ISPRA IdroGEO — pericolosità e indicatori di rischio per comune (PIR)',
    url: `${API}/{pro_com}`,
    snapshot_date: SNAP,
    formato: 'json',
    license: 'CC-BY-4.0',
    granularita: 'comune',
    note_path: 'notes/ispra-idrogeo.md',
    quirks: 'popfr_p3p4=pop frane P3+P4; pop_idr_p3=pop alluvioni P3 elevata; ar_frp3p4p/aridp3_p = % area; classe non in API; join via pro_com',
  })

  const entries = [...byProCom.entries()]
  const rows: Record<string, unknown>[] = []
  let processed = 0
  let missing = 0
  for (let i = 0; i < entries.length; i += CHUNK) {
    const batch = entries.slice(i, i + CHUNK)
    await Promise.all(
      batch.map(async ([proCom, istat]) => {
        let d: Pir
        try {
          d = await fetchJson<Pir>(`${API}/${proCom}`)
        } catch {
          missing++
          return
        }
        rows.push({
          comune_istat: istat,
          pop_esposta_frane: toNum(d.popfr_p3p4),
          pop_esposta_alluvioni: toNum(d.pop_idr_p3),
          area_pericolosita_frane_pct: toNum(d.ar_frp3p4p),
          area_pericolosita_alluvioni_pct: toNum(d.aridp3_p),
          classe: null,
          fonte_id: fonteId,
        })
      }),
    )
    processed += batch.length
    if (processed % 800 < CHUNK) console.log('  fetched', processed, '/', entries.length, '| 404:', missing)
  }

  const n = await bulkUpsert(
    'mart.idrogeo_comune',
    rows,
    ['comune_istat', 'pop_esposta_frane', 'pop_esposta_alluvioni', 'area_pericolosita_frane_pct', 'area_pericolosita_alluvioni_pct', 'classe', 'fonte_id'],
    '(comune_istat)',
    ['pop_esposta_frane', 'pop_esposta_alluvioni', 'area_pericolosita_frane_pct', 'area_pericolosita_alluvioni_pct', 'fonte_id'],
  )
  console.log('idrogeo done. upserted:', n, '| 404 (no IdroGEO record):', missing)
  await sql.end()
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
