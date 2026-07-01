// ISTAT SDMX v2 -> mart.welfare_comune (servizi educativi prima infanzia / asili nido per comune).
import { sql, SNAP } from './_framework/env'
import { curlText } from './_framework/download'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import { loadComuneSet, bulkUpsert } from './_framework/util'
import { parse } from 'csv-parse/sync'

const SRC = 'istat_sdmx'
const ANNO = 2023
// dataflow 47_850_DF_DCIS_SERVSOCEDU1_3 ; key FREQ.REF_AREA.DATA_TYPE.SERVICE.MGMT.SECTOR
// NB: the '+' OR-list returns empty on esploradati -> one query per indicator.
const INDICATORI = [
  { code: 'P_100CH_Y0_2', label: 'posti_nido_per_100_bambini_0_2' },
  { code: 'AUTP', label: 'posti_nido_autorizzati' },
  { code: 'EXPMUN', label: 'spesa_comuni_prima_infanzia_euro' },
]
const urlFor = (code: string) =>
  `https://esploradati.istat.it/SDMXWS/rest/v2/data/dataflow/IT1/47_850_DF_DCIS_SERVSOCEDU1_3/1.0/A.*.${code}.DNUR.ALL.9?c[TIME_PERIOD]=${ANNO}`

// curlText: WAF esploradati serve solo curl; rejectEmpty copre il quirk "200 con 0 byte" (notes/istat-welfare.md)
const curlCsv = (url: string) =>
  curlText(url, { headers: [['Accept', 'application/vnd.sdmx.data+csv;version=2.0.0']], rejectEmpty: true, maxBufferMb: 64 })

async function main() {
  await ensureBucket()
  const valid = await loadComuneSet()

  // un CSV per indicatore, atterrati nella stessa cartella snapshot: il primo è lo storage_path citato in meta.fonti
  const csvs: { ind: (typeof INDICATORI)[number]; text: string }[] = []
  const paths: string[] = []
  for (const ind of INDICATORI) {
    const text = curlCsv(urlFor(ind.code))
    paths.push(await landSnapshot(SRC, `servsocedu1_3_${ANNO}/${ind.code}.csv`, Buffer.from(text, 'utf8'), 'text/csv'))
    csvs.push({ ind, text })
  }

  const fonteId = await recordFonte({
    source: SRC, dataset_id: `servsocedu1_3_${ANNO}`,
    titolo: 'ISTAT — servizi educativi prima infanzia offerti dai comuni',
    url: urlFor('P_100CH_Y0_2'), snapshot_date: SNAP, storage_path: paths[0], formato: 'sdmx-csv', license: 'CC-BY (ISTAT)',
    latest_usable_year: ANNO, granularita: 'comune', note_path: 'notes/istat-welfare.md',
    quirks: `SDMX v2 (curl -g); REF_AREA=codice_istat; indicatore=DATA_TYPE; OR-list '+' rotto -> una query per indicatore; P_100CH puo superare 100; CL_ITTER107 contiene comuni soppressi; storage_path = primo indicatore, gli altri CSV nella stessa cartella: ${INDICATORI.map((i) => i.code + '.csv').join(', ')}`,
  })

  const rows: Record<string, unknown>[] = []
  for (const { ind, text } of csvs) {
    const records = parse(text, { columns: true, skip_empty_lines: true }) as Record<string, string>[]
    if (records.length === 0) throw new Error(`0 record per indicatore ${ind.code}: possibile regressione lato esploradati (quirk "200 con 0 byte", notes/istat-welfare.md)`)
    for (const r of records) {
      const ref = r.REF_AREA
      if (!/^\d{6}$/.test(ref) || !valid.has(ref)) continue
      const val = Number(r.OBS_VALUE)
      if (!Number.isFinite(val)) continue
      rows.push({ comune_istat: ref, anno: Number(r.TIME_PERIOD), indicatore: ind.label, valore: val, fonte_id: fonteId })
    }
  }
  const n = await bulkUpsert('mart.welfare_comune', rows,
    ['comune_istat', 'anno', 'indicatore', 'valore', 'fonte_id'],
    '(comune_istat, anno, indicatore)', ['valore', 'fonte_id'])
  console.log('welfare_comune upserted:', n, 'righe |', new Set(rows.map((r) => r.comune_istat)).size, 'comuni')
  await sql.end()
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
