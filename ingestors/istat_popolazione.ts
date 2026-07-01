// ISTAT SDMX v2 -> geo.comuni.popolazione (+ answers demografia). One wildcard call, all comuni.
import { sql, SNAP } from './_framework/env'
import { curlText } from './_framework/download'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import { parse } from 'csv-parse/sync'

const SRC = 'istat_sdmx'
// 22_389 = popolazione residente al 1° gennaio (ultimo anno). Key: FREQ.REF_AREA.DATA_TYPE.SEX.AGE.MARITAL
const URL = 'https://esploradati.istat.it/SDMXWS/rest/v2/data/dataflow/IT1/22_389/1.0/A.*.JAN.9.TOTAL.99'

async function main() {
  await ensureBucket()
  // NB: la WAF di esploradati 500a su fetch Node/undici ma serve curl -> curlText; rejectEmpty copre il quirk "200 con 0 byte" (notes/istat-welfare.md)
  const text = curlText(URL, { headers: [['Accept', 'application/vnd.sdmx.data+csv;version=2.0.0']], rejectEmpty: true, maxBufferMb: 128 })
  const storage_path = await landSnapshot(SRC, '22_389_POPRES1.csv', Buffer.from(text, 'utf8'), 'text/csv')
  const records = parse(text, { columns: true, skip_empty_lines: true }) as Record<string, string>[]
  if (records.length === 0) throw new Error('0 record dal dataflow 22_389: possibile regressione lato esploradati (quirk "200 con 0 byte", notes/istat-welfare.md)')

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
    url: URL, snapshot_date: SNAP, storage_path, formato: 'sdmx-csv', license: 'CC-BY (ISTAT)',
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
