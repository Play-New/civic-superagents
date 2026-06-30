// EEA -> mart.aria_comune_anno (PM10 sintesi annuale NAZIONALE). Estende l'aria oltre il pilota Lombardia.
// Parquet per sampling-point (aggregati 2024 via _aria_parquet.py) + registro stazioni (coord) -> spatial join.
import { sql } from './_framework/env'
import { recordFonte } from './_framework/provenance'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { parse } from 'csv-parse/sync'
import AdmZip from 'adm-zip'
import { execFileSync } from 'node:child_process'
import { writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SRC = 'eea_aria'
const SNAP = '2026-06-30'
const ANNO = 2024
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'
const DL = 'https://eeadmz1-downloads-api-appservice.azurewebsites.net'
const AQV = 'https://discomap.eea.europa.eu/App/AQViewer'
const curl = (args: string[]) => execFileSync('curl', ['-sS', '--fail', '-A', UA, ...args], { maxBuffer: 256 * 1024 * 1024 })

async function main() {
  await ensureBucket()
  const dir = tmpdir()

  // 1) parquet URLs (IT, PM10, dataset 2 = E1a verificato)
  const urlsBody = JSON.stringify({ countries: ['IT'], cities: [], pollutants: ['http://dd.eionet.europa.eu/vocabulary/aq/pollutant/5'], dataset: 2, source: 'Api' })
  const urls = curl(['-X', 'POST', `${DL}/ParquetFile/urls`, '-H', 'Content-Type: application/json', '--data', urlsBody]).toString('utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l.endsWith('.parquet'))
  const urlsFile = join(dir, 'eea_urls.txt')
  writeFileSync(urlsFile, urls.join('\n'))
  console.log('parquet URLs:', urls.length)

  // 2) registry coords (Sampling Point Id -> lon/lat)
  const init = JSON.parse(curl([`${AQV}/init?fqn=Airquality_Dissem.b2g.measurements`]).toString('utf8'))
  const req = init.Request ?? init
  req.RequestFilter = { Country: { FieldName: 'Country', Values: ['Italy'] }, AirPollutant: { FieldName: 'AirPollutant', Values: ['PM10'] } }
  const bodyFile = join(dir, 'eea_body.json')
  writeFileSync(bodyFile, JSON.stringify(req))
  const regZip = curl(['-X', 'POST', `${AQV}/download?fqn=Airquality_Dissem.b2g.measurements&f=csv`, '-H', 'Content-Type: application/json', '--data', `@${bodyFile}`])
  const regCsv = new AdmZip(regZip).getEntries().find((e) => e.entryName.endsWith('.csv'))!.getData().toString('utf8')
  const reg = parse(regCsv, { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true, bom: true }) as Record<string, string>[]
  const coords = new Map<string, { lon: number; lat: number }>()
  for (const r of reg) {
    const id = (r['Sampling Point Id'] ?? '').trim()
    const lon = Number(r['Longitude']), lat = Number(r['Latitude'])
    if (id && Number.isFinite(lon) && Number.isFinite(lat)) coords.set(id, { lon, lat })
  }
  console.log('registry sampling points with coords:', coords.size)

  // 3) parquet aggregation (python/pyarrow, threaded) -> { samplingpoint: {n, media, sfor} }
  const outJson = join(dir, 'eea_agg.json')
  console.log('aggregating', urls.length, 'parquet (qualche minuto)...')
  execFileSync('python3', [join(import.meta.dirname, '_aria_parquet.py'), urlsFile, outJson], { stdio: ['ignore', 'ignore', 'inherit'] })
  const agg = JSON.parse(readFileSync(outJson, 'utf8')) as Record<string, { n: number; media: number; sfor: number }>

  // 4) join sampling point -> coords (strip 'IT/' prefix)
  const lons: number[] = [], lats: number[] = [], medie: number[] = [], sfori: number[] = []
  let matched = 0, noCoord = 0
  for (const [sp, a] of Object.entries(agg)) {
    const c = coords.get(sp.replace(/^IT\//, ''))
    if (!c) { noCoord++; continue }
    matched++
    lons.push(c.lon); lats.push(c.lat); medie.push(a.media); sfori.push(a.sfor)
  }
  console.log('stations matched to coords:', matched, '| no coord:', noCoord)

  const storage_path = await landSnapshot(SRC, SNAP, `eea_pm10_${ANNO}_agg.json`, Buffer.from(JSON.stringify(agg)), 'application/json')
  const fonteId = await recordFonte({
    source: SRC, dataset_id: `pm10_${ANNO}`, titolo: 'EEA — qualità aria PM10 (sintesi annuale nazionale)',
    url: `${DL}/ParquetFile/urls`, snapshot_date: SNAP, storage_path, formato: 'parquet', license: 'CC-BY-4.0',
    latest_usable_year: ANNO, granularita: 'stazione->comune', note_path: 'notes/eea-aria.md',
    quirks: 'parquet per sampling-point (dataset 2 E1a verificato); AggType=day, Validity>0; comune via spatial join coord stazione; copre solo i comuni con stazione',
  })

  // 5) spatial join -> per-comune -> upsert
  await sql`delete from mart.aria_comune_anno where anno=${ANNO} and inquinante='PM10'`
  const perComune = await sql<{ codice_istat: string; n: number; media: number; sfor: number }[]>`
    with st as (select unnest(${lons}::float[]) lon, unnest(${lats}::float[]) lat, unnest(${medie}::float[]) media, unnest(${sfori}::int[]) sfor),
    j as (select c.codice_istat, s.media, s.sfor from st s join geo.comuni c on c.geom is not null and ST_Contains(c.geom, ST_SetSRID(ST_MakePoint(s.lon, s.lat), 4326)))
    select codice_istat, count(*)::int n, round(avg(media)::numeric, 1) media, max(sfor)::int sfor from j group by codice_istat`
  const rows = perComune.map((r) => ({ comune_istat: r.codice_istat, anno: ANNO, inquinante: 'PM10', n_stazioni: r.n, media_annua: r.media, giorni_sforamento_max: r.sfor, fonte_id: fonteId }))
  let inserted = 0
  for (let i = 0; i < rows.length; i += 1000) {
    const c = rows.slice(i, i + 1000)
    await sql`insert into mart.aria_comune_anno ${sql(c, 'comune_istat', 'anno', 'inquinante', 'n_stazioni', 'media_annua', 'giorni_sforamento_max', 'fonte_id')}`
    inserted += c.length
  }
  rmSync(urlsFile, { force: true }); rmSync(bodyFile, { force: true }); rmSync(outJson, { force: true })
  console.log('aria_comune_anno upserted:', inserted, 'comuni con stazione PM10')
  await sql.end()
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
