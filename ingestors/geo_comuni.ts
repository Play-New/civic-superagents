// Spine ingestor: geo.comuni from Openpolis geojson-italy. Run first — everything joins to this.
import { sql } from './_framework/env'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { fetchBuffer } from './_framework/download'
import { recordFonte } from './_framework/provenance'

const SRC = 'geojson_italy'
const URL =
  'https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_municipalities.geojson'
const SNAP = '2026-06-29'

interface Props {
  name: string
  com_istat_code?: string
  com_istat_code_num?: number
  com_catasto_code?: string
  prov_acr?: string
  prov_istat_code?: string
  prov_name?: string
  reg_istat_code?: string
  reg_name?: string
}

async function upsertComune(f: { properties: Props; geometry: unknown }, fonteId: number): Promise<void> {
  const p = f.properties
  const istat = String(p.com_istat_code ?? '').padStart(6, '0')
  if (!/^\d{6}$/.test(istat)) throw new Error('unexpected props: ' + Object.keys(p).join(','))
  const geom = JSON.stringify(f.geometry)
  await sql`
    insert into geo.comuni
      (codice_istat, pro_com, codice_catastale, denominazione, sigla_provincia, cod_provincia,
       denominazione_provincia, cod_regione, denominazione_regione, geom, fonte_id)
    values
      (${istat}, ${p.com_istat_code_num ?? null}, ${p.com_catasto_code ?? null}, ${p.name},
       ${p.prov_acr ?? null}, ${p.prov_istat_code ?? null}, ${p.prov_name ?? null},
       ${p.reg_istat_code ?? null}, ${p.reg_name ?? null},
       ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${geom}), 4326)), ${fonteId})
    on conflict (codice_istat) do update set
      pro_com = excluded.pro_com, codice_catastale = excluded.codice_catastale,
      denominazione = excluded.denominazione, sigla_provincia = excluded.sigla_provincia,
      cod_provincia = excluded.cod_provincia, denominazione_provincia = excluded.denominazione_provincia,
      cod_regione = excluded.cod_regione, denominazione_regione = excluded.denominazione_regione,
      geom = excluded.geom, fonte_id = excluded.fonte_id`
}

async function main() {
  console.log('ensure raw bucket...')
  await ensureBucket()

  console.log('download comuni geojson (~38 MB)...')
  const buf = await fetchBuffer(URL)
  const storage_path = await landSnapshot(SRC, SNAP, 'limits_IT_municipalities.geojson', buf, 'application/geo+json')
  console.log('landed:', storage_path)

  const fonteId = await recordFonte({
    source: SRC,
    dataset_id: 'limits_IT_municipalities',
    titolo: 'Confini comunali (Openpolis geojson-italy)',
    url: URL,
    snapshot_date: SNAP,
    storage_path,
    formato: 'geojson',
    license: 'CC-BY-4.0',
    granularita: 'comune',
    note_path: 'notes/geojson-italy.md',
  })

  const fc = JSON.parse(buf.toString('utf8')) as { features: { properties: Props; geometry: unknown }[] }
  console.log('features:', fc.features.length)

  let n = 0
  const CHUNK = 100
  for (let i = 0; i < fc.features.length; i += CHUNK) {
    const chunk = fc.features.slice(i, i + CHUNK)
    await Promise.all(chunk.map((f) => upsertComune(f, fonteId)))
    n += chunk.length
    if (n % 1000 < CHUNK) console.log('  upserted ~', Math.min(n, fc.features.length))
  }
  console.log('geo.comuni upserted:', n)
  await sql.end()
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
