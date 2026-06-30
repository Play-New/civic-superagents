// ISTAT SDMX v2 -> geo.comuni.popolazione (+ answers demografia). One wildcard call, all comuni.
import { sql } from './_framework/env'
import { recordFonte } from './_framework/provenance'
import { parse } from 'csv-parse/sync'
import { execFileSync } from 'node:child_process'

const SRC = 'istat_sdmx'
const SNAP = '2026-06-29'
// 22_389 = popolazione residente al 1° gennaio (ultimo anno). Key: FREQ.REF_AREA.DATA_TYPE.SEX.AGE.MARITAL
const URL = 'https://esploradati.istat.it/SDMXWS/rest/v2/data/dataflow/IT1/22_389/1.0/A.*.JAN.9.TOTAL.99'

async function main() {
  // NB: esploradati's WAF 500s on Node/undici fetch but serves curl fine — shell out to curl.
  let text = ''
  for (let attempt = 1; ; attempt++) {
    try {
      text = execFileSync(
        'curl',
        ['-sS', '--fail', '-A', 'Mozilla/5.0 (civic-superagents)', '-H', 'Accept: application/vnd.sdmx.data+csv;version=2.0.0', URL],
        { maxBuffer: 128 * 1024 * 1024 },
      ).toString('utf8')
      break
    } catch (e) {
      if (attempt >= 4) throw e
      console.log(`  ISTAT fetch failed, retry ${attempt}...`)
      execFileSync('sleep', ['2'])
    }
  }
  const records = parse(text, { columns: true, skip_empty_lines: true }) as Record<string, string>[]

  // keep the latest year per comune (REF_AREA = 6-digit codice_istat)
  const best = new Map<string, { pop: number; anno: number }>()
  for (const r of records) {
    const ref = r.REF_AREA
    if (!/^\d{6}$/.test(ref)) continue
    const anno = Number(r.TIME_PERIOD)
    const pop = Number(r.OBS_VALUE)
    if (!Number.isFinite(anno) || !Number.isFinite(pop)) continue
    const cur = best.get(ref)
    if (!cur || anno > cur.anno) best.set(ref, { pop, anno })
  }

  const fonteId = await recordFonte({
    source: SRC, dataset_id: '22_389_POPRES1',
    titolo: 'ISTAT — popolazione residente al 1° gennaio per comune',
    url: URL, snapshot_date: SNAP, formato: 'sdmx-csv', license: 'CC-BY (ISTAT)',
    granularita: 'comune', note_path: 'notes/istat-popolazione.md',
    quirks: "SDMX v2 wildcard A.*; REF_AREA=codice_istat; l'ultimo anno puo essere stima (OBS_STATUS=e); OR '+' rotto su esploradati, usare '*'",
  })

  const istats = [...best.keys()]
  const pops = istats.map((k) => best.get(k)!.pop)
  const annos = istats.map((k) => best.get(k)!.anno)
  const r = await sql`
    update geo.comuni c
    set popolazione = d.pop, popolazione_anno = d.anno, popolazione_fonte_id = ${fonteId}
    from (select unnest(${istats}::text[]) istat, unnest(${pops}::int[]) pop, unnest(${annos}::int[]) anno) d
    where c.codice_istat = d.istat`
  console.log('popolazione: matched comuni', istats.length, '| rows updated', r.count)
  await sql.end()
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
