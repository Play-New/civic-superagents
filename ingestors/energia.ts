// GSE -> mart.cer_comune (comunità energetiche rinnovabili per comune). comune via SPATIAL join (lat/lng).
import { sql } from './_framework/env'
import { fetchBuffer } from './_framework/download'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import * as XLSX from 'xlsx'

const SRC = 'gse_cer'
const SNAP = '2026-06-29'
const URL = 'https://www.gse.it/servizi-per-te_site/autoconsumo_site/Documents/Elenco%20Comunit%C3%A0%20Energetiche%20Rinnovabili.xlsx'

const itf = (v: unknown): number | null => {
  const t = String(v ?? '').trim().replace(/\./g, '').replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

async function main() {
  await ensureBucket()
  const buf = await fetchBuffer(URL)
  const storage_path = await landSnapshot(SRC, SNAP, 'Elenco_CER.xlsx', buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  const fonteId = await recordFonte({
    source: SRC, dataset_id: 'cer', titolo: 'GSE — Elenco Comunità Energetiche Rinnovabili',
    url: URL, snapshot_date: SNAP, storage_path, formato: 'xlsx', license: 'CC-BY-SA-3.0-IT',
    granularita: 'comune', note_path: 'notes/gse-energia.md',
    quirks: 'comune per nome (no ISTAT) -> spatial join via lat/lng (decimale virgola); impianti-tutti per comune NON disponibili (Atlaimpianti SPA offline)',
  })

  const wb = XLSX.read(buf, { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])
  const lngs: number[] = [], lats: number[] = [], imps: number[] = [], pots: number[] = []
  let noCoord = 0
  for (const r of rows) {
    const lat = itf(r['Latitudine']), lng = itf(r['Longitudine'])
    if (lat == null || lng == null) { noCoord++; continue }
    lats.push(lat); lngs.push(lng)
    imps.push(itf(r['Numero impianti']) ?? 0)
    pots.push(itf(r['Potenza totale (kW)']) ?? 0)
  }

  // resolve all CER points to comuni via PostGIS point-in-polygon, aggregate per comune
  const agg = await sql<{ codice_istat: string; n: number; imp: number; pot: number }[]>`
    select c.codice_istat, count(*)::int n, sum(p.imp)::int imp, sum(p.pot)::numeric pot
    from (select unnest(${lngs}::float[]) lng, unnest(${lats}::float[]) lat, unnest(${imps}::float[]) imp, unnest(${pots}::float[]) pot) p
    join geo.comuni c on ST_Contains(c.geom, ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326))
    group by c.codice_istat`

  await sql`delete from mart.cer_comune`
  let n = 0
  const CH = 1000
  const recs = agg.map((a) => ({ comune_istat: a.codice_istat, n_configurazioni: a.n, n_impianti: a.imp, potenza_kw: a.pot, fonte_id: fonteId }))
  for (let i = 0; i < recs.length; i += CH) {
    const c = recs.slice(i, i + CH)
    await sql`insert into mart.cer_comune ${sql(c, 'comune_istat', 'n_configurazioni', 'n_impianti', 'potenza_kw', 'fonte_id')}`
    n += c.length
  }
  console.log('cer_comune upserted:', n, 'comuni |', lats.length, 'CER georeferenziate |', noCoord, 'senza coord')
  await sql.end()
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
