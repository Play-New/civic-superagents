// EEA/WISE Bathing Water (via EMODnet) -> mart.balneazione_sito. CSV (stato per anno) + shapefile (nome/coord).
// comune via PostGIS spatial join (ground truth), fallback al codice ISTAT incorporato nel sito_id.
import { sql } from './_framework/env'
import { fetchBuffer } from './_framework/download'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import { loadComuneSet, bulkUpsert } from './_framework/util'
import { parse } from 'csv-parse/sync'
import AdmZip from 'adm-zip'
import * as shapefile from 'shapefile'
import { writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SRC = 'eea_balneazione'
const SNAP = '2026-06-29'
const URL =
  'https://ows.emodnet-humanactivities.eu/geonetwork/srv/api/records/8d85660c-7930-40dc-8733-96abdcf4bca7/attachments/EMODnet_HA_Environment_StatusBathingWater_20260116.zip'

async function main() {
  await ensureBucket()
  const valid = await loadComuneSet()
  const zipBuf = await fetchBuffer(URL)
  const storage_path = await landSnapshot(SRC, SNAP, 'EMODnet_StatusBathingWater.zip', zipBuf, 'application/zip')
  const zip = new AdmZip(zipBuf)
  const csvEntry = zip.getEntries().find((e) => /BathingWaterStatus_\d+\.csv$/.test(e.entryName))
  const shpEntry = zip.getEntries().find((e) => /BathingWaterSites_\d+\.shp$/.test(e.entryName))
  const dbfEntry = zip.getEntries().find((e) => /BathingWaterSites_\d+\.dbf$/.test(e.entryName))
  if (!csvEntry || !shpEntry || !dbfEntry) throw new Error('missing zip members')

  // shapefile (.shp+.dbf, WGS84) -> site metadata (nome, lat, lng)
  const shpPath = join(tmpdir(), 'bw.shp'), dbfPath = join(tmpdir(), 'bw.dbf')
  writeFileSync(shpPath, shpEntry.getData())
  writeFileSync(dbfPath, dbfEntry.getData())
  const meta = new Map<string, { nome: string | null; lat: number | null; lng: number | null }>()
  const fc = await shapefile.read(shpPath, dbfPath)
  for (const f of fc.features) {
    const p = f.properties as Record<string, unknown>
    const id = String(p.bathingWat ?? p.bathingWaterIdentifier ?? '').trim()
    if (!id) continue
    let lng: number | null = null, lat: number | null = null
    if (f.geometry && f.geometry.type === 'Point') { lng = f.geometry.coordinates[0]; lat = f.geometry.coordinates[1] }
    else { lat = (p.lat as number) ?? null; lng = (p.lon as number) ?? null }
    meta.set(id, { nome: (p.name as string) ?? null, lat, lng })
  }
  rmSync(shpPath, { force: true }); rmSync(dbfPath, { force: true })

  // spatial resolve comune from coords (ground truth) for all sites at once
  const ids = [...meta.keys()]
  const lats = ids.map((i) => meta.get(i)!.lat)
  const lngs = ids.map((i) => meta.get(i)!.lng)
  const spatial = new Map<string, string>()
  const res = await sql<{ id: string; codice_istat: string }[]>`
    select t.id, c.codice_istat
    from (select unnest(${ids}::text[]) id, unnest(${lats}::float[]) lat, unnest(${lngs}::float[]) lng) t
    join geo.comuni c on c.geom is not null and ST_Contains(c.geom, ST_SetSRID(ST_MakePoint(t.lng, t.lat), 4326))
    where t.lat is not null and t.lng is not null`
  for (const r of res) spatial.set(r.id, r.codice_istat)

  const fonteId = await recordFonte({
    source: SRC, dataset_id: 'bathing_water_status',
    titolo: 'EEA/WISE — stato acque di balneazione (via EMODnet)',
    url: URL, snapshot_date: SNAP, storage_path, formato: 'csv-zip+shp', license: 'CC-BY-4.0',
    latest_usable_year: 2024, granularita: 'sito->comune', note_path: 'notes/eea-balneazione.md',
    quirks: 'comune via spatial join (ST_Contains su lat/lng WGS84); fallback codice ISTAT incorporato substr(6,6); nome/coord dallo shapefile; ultimo anno=2024',
  })

  const records = parse(csvEntry.getData().toString('utf8'), { delimiter: ';', columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true }) as Record<string, string>[]
  const rows: Record<string, unknown>[] = []
  for (const r of records) {
    const id = (r.BATHINGWATERIDENTIFIER ?? '').trim()
    if (!id.startsWith('IT')) continue
    const anno = Number((r.YEAR ?? '').trim())
    if (!Number.isFinite(anno)) continue
    const embedded = id.substring(5, 11)
    const comune = spatial.get(id) ?? (valid.has(embedded) ? embedded : null)
    const m = meta.get(id)
    rows.push({ sito_id: id, anno, comune_istat: comune, classe_qualita: r.STATUS || null, nome: m?.nome ?? null, lat: m?.lat ?? null, lng: m?.lng ?? null, fonte_id: fonteId })
  }
  const n = await bulkUpsert('mart.balneazione_sito', rows,
    ['sito_id', 'anno', 'comune_istat', 'classe_qualita', 'nome', 'lat', 'lng', 'fonte_id'],
    '(sito_id, anno)', ['comune_istat', 'classe_qualita', 'nome', 'lat', 'lng', 'fonte_id'])
  console.log('balneazione upserted:', n, '| con nome:', rows.filter((r) => r.nome).length, '| comune via spatial:', spatial.size)
  await sql.end()
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
