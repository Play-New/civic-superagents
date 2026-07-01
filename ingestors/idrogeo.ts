// ISPRA IdroGEO -> mart.idrogeo_comune (landslide/flood risk per comune).
// API: one GET per comune keyed by pro_com. Frane P3+P4 and flood P3 (elevata) are the headline indicators.
import { sql, SNAP } from './_framework/env'
import { recordFonte } from './_framework/provenance'
import { loadComuniByProCom, toNum, bulkUpsert } from './_framework/util'

const SRC = 'ispra_idrogeo'
const API = 'https://idrogeo.isprambiente.it/api/pir/comuni'
const CHUNK = 40
const UA = 'Mozilla/5.0 (civic-superagents data ingestor)'
const RETRY = 3
const TIMEOUT_MS = 15_000

interface Pir {
  popfr_p3p4?: number // pop esposta frane P3+P4 (NB: 'popfr_', non 'pop_fr_')
  pop_idr_p3?: number // pop esposta alluvioni P3 (elevata)
  ar_frp3p4p?: number // % area frane P3+P4
  aridp3_p?: number // % area alluvioni P3
}

// Fetch con status esplicito: solo un vero 404 = comune assente da IdroGEO (attesi 3 su ~7900,
// vedi notes/ispra-idrogeo.md). Tutto il resto (timeout, DNS, 5xx, 429) si ritenta con backoff.
async function fetchPir(proCom: number): Promise<Pir | null> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= RETRY; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt))
    try {
      const r = await fetch(`${API}/${proCom}`, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (r.status === 404) return null
      if (!r.ok) throw new Error(`GET ${API}/${proCom} -> ${r.status} ${r.statusText}`)
      return (await r.json()) as Pir
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
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
    license: 'CC-BY-4.0 (frane) / CC-BY-SA-4.0 (alluvioni) — da verificare (vedi notes/ispra-idrogeo.md)',
    granularita: 'comune',
    note_path: 'notes/ispra-idrogeo.md',
    quirks: 'popfr_p3p4=pop frane P3+P4; pop_idr_p3=pop alluvioni P3 elevata; ar_frp3p4p/aridp3_p = % area; classe non in API; join via pro_com',
  })

  const entries = [...byProCom.entries()]
  const rows: Record<string, unknown>[] = []
  let processed = 0
  let missing = 0
  const failed: number[] = []
  for (let i = 0; i < entries.length; i += CHUNK) {
    const batch = entries.slice(i, i + CHUNK)
    await Promise.all(
      batch.map(async ([proCom, istat]) => {
        let d: Pir | null
        try {
          d = await fetchPir(proCom)
        } catch {
          failed.push(proCom)
          return
        }
        if (d === null) {
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
    if (processed % 800 < CHUNK) console.log('  fetched', processed, '/', entries.length, '| 404:', missing, '| falliti:', failed.length)
  }

  if (failed.length > 0) {
    console.error(`idrogeo: ${failed.length} comuni falliti dopo ${RETRY} retry (es. ${failed.slice(0, 5).join(', ')})`)
    throw new Error(`ingest incompleto: ${failed.length} comuni non scaricati — niente upsert parziale`)
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
