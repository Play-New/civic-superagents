// Spine ingestor: geo.comuni from Openpolis geojson-italy. Run first — everything joins to this.
import { sql, SNAP } from './_framework/env'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { fetchBuffer } from './_framework/download'
import { recordFonte } from './_framework/provenance'

const SRC = 'geojson_italy'
const URL =
  'https://raw.githubusercontent.com/openpolis/geojson-italy/master/geojson/limits_IT_municipalities.geojson'

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

function toRow(f: { properties: Props; geometry: unknown }) {
  const p = f.properties
  const istat = String(p.com_istat_code ?? '').padStart(6, '0')
  if (!/^\d{6}$/.test(istat)) throw new Error('unexpected props: ' + Object.keys(p).join(','))
  return {
    codice_istat: istat,
    pro_com: p.com_istat_code_num ?? null,
    codice_catastale: p.com_catasto_code ?? null,
    denominazione: p.name,
    sigla_provincia: p.prov_acr ?? null,
    cod_provincia: p.prov_istat_code ?? null,
    denominazione_provincia: p.prov_name ?? null,
    cod_regione: p.reg_istat_code ?? null,
    denominazione_regione: p.reg_name ?? null,
    geometry: f.geometry,
  }
}

// Upsert multi-riga via jsonb_array_elements: bulkUpsert non regge la colonna geom
// (serve l'espressione ST_GeomFromGeoJSON, non un parametro passabile con sql(rows, ...cols)).
async function upsertChunk(rows: ReturnType<typeof toRow>[], fonteId: number): Promise<void> {
  await sql`
    insert into geo.comuni
      (codice_istat, pro_com, codice_catastale, denominazione, sigla_provincia, cod_provincia,
       denominazione_provincia, cod_regione, denominazione_regione, geom, fonte_id)
    select
      r->>'codice_istat', (r->>'pro_com')::integer, r->>'codice_catastale', r->>'denominazione',
      r->>'sigla_provincia', r->>'cod_provincia', r->>'denominazione_provincia',
      r->>'cod_regione', r->>'denominazione_regione',
      ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(r->>'geometry'), 4326)), ${fonteId}
    from jsonb_array_elements(${JSON.stringify(rows)}::jsonb) r
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
  const storage_path = await landSnapshot(SRC, 'limits_IT_municipalities.geojson', buf, 'application/geo+json')
  console.log('landed:', storage_path)

  const fonteId = await recordFonte({
    source: SRC,
    dataset_id: 'limits_IT_municipalities',
    titolo: 'Confini comunali (Openpolis geojson-italy)',
    url: URL,
    snapshot_date: SNAP,
    storage_path,
    formato: 'geojson',
    license: 'vedi repo openpolis/geojson-italy — da verificare',
    granularita: 'comune',
    note_path: 'notes/geojson-italy.md',
  })

  const fc = JSON.parse(buf.toString('utf8')) as { features: { properties: Props; geometry: unknown }[] }
  console.log('features:', fc.features.length)

  let n = 0
  const CHUNK = 500 // ~2.5 MB di geometrie per statement
  for (let i = 0; i < fc.features.length; i += CHUNK) {
    const chunk = fc.features.slice(i, i + CHUNK).map(toRow)
    await upsertChunk(chunk, fonteId)
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
