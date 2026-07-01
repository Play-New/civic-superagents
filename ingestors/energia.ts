// GSE -> mart.cer_comune (comunità energetiche rinnovabili per comune). comune via SPATIAL join (lat/lng).
import type { Sql } from 'postgres'
import { sql, SNAP } from './_framework/env'
import { fetchBuffer } from './_framework/download'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import { parseItNumber, bulkInsert } from './_framework/util'
import * as XLSX from 'xlsx'

const SRC = 'gse_cer'
const URL = 'https://www.gse.it/servizi-per-te_site/autoconsumo_site/Documents/Elenco%20Comunit%C3%A0%20Energetiche%20Rinnovabili.xlsx'

// Celle verificate sul file reale 2026-07-01 (904 righe): sempre stringhe decimale-virgola ("36,98353105", "396,76"), mai '.' (né migliaia né decimale).
// Coordinate: virgola->punto SENZA strip dei punti (un eventuale "9.19" non deve diventare 919); numeri raw da sheet_to_json passano invariati.
const coord = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const t = String(v ?? '').trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
// Potenza/impianti: formato italiano confermato -> parseItNumber; numeri raw passano invariati.
const itNum = (v: unknown): number | null =>
  typeof v === 'number' ? (Number.isFinite(v) ? v : null) : parseItNumber(v == null ? null : String(v))

async function main() {
  await ensureBucket()
  const buf = await fetchBuffer(URL)
  const storage_path = await landSnapshot(SRC, 'Elenco_CER.xlsx', buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  const fonteId = await recordFonte({
    source: SRC, dataset_id: 'cer', titolo: 'GSE — Elenco Comunità Energetiche Rinnovabili',
    url: URL, snapshot_date: SNAP, storage_path, formato: 'xlsx', license: 'GSE (verificare)', // come da manifest.yaml (gse_atlaimpianti_cer)
    granularita: 'comune', note_path: 'notes/gse-energia.md',
    quirks: 'comune per nome (no ISTAT) -> spatial join via lat/lng (decimale virgola); impianti-tutti per comune NON disponibili (Atlaimpianti SPA offline)',
  })

  const wb = XLSX.read(buf, { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])
  const lngs: number[] = [], lats: number[] = [], imps: number[] = [], pots: number[] = []
  let noCoord = 0
  for (const r of rows) {
    const lat = coord(r['Latitudine']), lng = coord(r['Longitudine'])
    if (lat == null || lng == null) { noCoord++; continue }
    lats.push(lat); lngs.push(lng)
    imps.push(itNum(r['Numero impianti']) ?? 0)
    pots.push(itNum(r['Potenza totale (kW)']) ?? 0)
  }

  // resolve all CER points to comuni via PostGIS point-in-polygon, aggregate per comune
  const agg = await sql<{ codice_istat: string; n: number; imp: number; pot: number }[]>`
    select c.codice_istat, count(*)::int n, sum(p.imp)::int imp, sum(p.pot)::numeric pot
    from (select unnest(${lngs}::float[]) lng, unnest(${lats}::float[]) lat, unnest(${imps}::float[]) imp, unnest(${pots}::float[]) pot) p
    join geo.comuni c on ST_Contains(c.geom, ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326))
    group by c.codice_istat`

  if (agg.length === 0) throw new Error('0 comuni dal parse XLSX GSE (drift formato?) — abort, mart.cer_comune non toccato')
  let n = 0
  const recs = agg.map((a) => ({ comune_istat: a.codice_istat, n_configurazioni: a.n, n_impianti: a.imp, potenza_kw: a.pot, fonte_id: fonteId }))
  // full refresh atomico: delete+insert in transazione
  await sql.begin(async (sql) => {
    await sql`delete from mart.cer_comune`
    // cast: nei typings di postgres 3.4 TransactionSql non è assegnabile a Sql (entrambi estendono ISql); a runtime è lo stesso handle
    n = await bulkInsert(sql as unknown as Sql, 'mart.cer_comune', recs, ['comune_istat', 'n_configurazioni', 'n_impianti', 'potenza_kw', 'fonte_id'])
  })
  console.log('cer_comune upserted:', n, 'comuni |', lats.length, 'CER georeferenziate |', noCoord, 'senza coord')
  await sql.end()
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
