// dati.lombardia (Socrata) air quality (PILOT region) -> glossary.sensore_comune + mart.aria_misure (PM10).
// Measurements have only idsensore; comune/inquinante/unit come from the station registry (join by NAME).
import { sql } from './_framework/env'
import { fetchJson } from './_framework/download'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import { normName, loadComuniByName, toNum, bulkUpsert } from './_framework/util'

const SRC = 'dati_lombardia_aria'
const SNAP = '2026-06-29'
const REG_ID = 'ib47-atvt' // station/sensor registry
const HIST_ID = 'g2hp-ar79' // measurements 2018 ->
const NRT_ID = 'nicp-bhqi' // measurements current year
const PM10 = 'PM10 (SM2005)'

async function soda(id: string, params: Record<string, string>): Promise<Record<string, unknown>[]> {
  const base = `https://www.dati.lombardia.it/resource/${id}.json`
  const out: Record<string, unknown>[] = []
  const limit = 50000
  let offset = 0
  for (;;) {
    const qp = new URLSearchParams({ ...params, $limit: String(limit), $offset: String(offset) })
    const page = await fetchJson<Record<string, unknown>[]>(`${base}?${qp.toString()}`)
    out.push(...page)
    if (page.length < limit) break
    offset += limit
  }
  return out
}

async function main() {
  await ensureBucket()
  const nameMap = await loadComuniByName('Lombardia')

  // 1) registry -> glossary.sensore_comune (the join hub)
  const reg = await soda(REG_ID, {})
  await landSnapshot(SRC, SNAP, 'stazioni_ib47-atvt.json', Buffer.from(JSON.stringify(reg)), 'application/json')
  await recordFonte({
    source: SRC, dataset_id: REG_ID, titolo: 'dati.lombardia — stazioni qualita aria (registry)',
    url: `https://www.dati.lombardia.it/resource/${REG_ID}.json`, snapshot_date: SNAP, formato: 'socrata-json',
    license: 'CC0-1.0', granularita: 'stazione->comune', note_path: 'notes/aria-lombardia.md',
    quirks: 'join comune by NAME (no ISTAT); idsensore text; storico N=attivo/S=storico',
  })

  const sensorRows: Record<string, unknown>[] = []
  const sensorMeta = new Map<string, { istat: string; unita: string | null; inq: string }>()
  let unmatched = 0
  for (const s of reg) {
    const istat = nameMap.get(normName(String(s.comune ?? '')))
    if (!istat) { unmatched++; continue }
    const id = String(s.idsensore)
    sensorRows.push({ id_sensore: id, comune_istat: istat, inquinante: s.nometiposensore ?? null, nomestazione: s.nomestazione ?? null })
    sensorMeta.set(id, { istat, unita: (s.unitamisura as string) ?? null, inq: String(s.nometiposensore ?? '') })
  }
  const ns = await bulkUpsert('glossary.sensore_comune', sensorRows,
    ['id_sensore', 'comune_istat', 'inquinante', 'nomestazione'], '(id_sensore)',
    ['comune_istat', 'inquinante', 'nomestazione'])
  console.log('sensore_comune upserted:', ns, '| unmatched comuni:', unmatched)

  // 2) PM10 measurements (2024 historical + current year) -> mart.aria_misure
  const pm10Ids = [...sensorMeta.entries()].filter(([, v]) => v.inq === PM10).map(([id]) => id)
  console.log('PM10 sensors:', pm10Ids.length)
  if (pm10Ids.length === 0) { console.log('no PM10 sensors, stopping'); await sql.end(); return }

  await sql`delete from mart.aria_misure where inquinante='PM10' and id_sensore = any(${pm10Ids})`
  const inList = pm10Ids.map((id) => `'${id}'`).join(',')
  const fetchPm10 = (dsId: string, where: string) =>
    soda(dsId, { $select: 'idsensore,data,valore,stato', $where: `idsensore in(${inList}) and stato='VA' and ${where}` })

  const m2024 = await fetchPm10(HIST_ID, "data >= '2024-01-01T00:00:00' and data < '2025-01-01T00:00:00'")
  const mNow = await fetchPm10(NRT_ID, "data >= '2026-01-01T00:00:00'")

  const fonteMeas = await recordFonte({
    source: SRC, dataset_id: `${HIST_ID}+${NRT_ID}_PM10`, titolo: 'dati.lombardia — misure PM10 (2024 + corrente)',
    url: `https://www.dati.lombardia.it/resource/${HIST_ID}.json`, snapshot_date: SNAP, formato: 'socrata-json',
    license: 'CC0-1.0', latest_usable_year: 2026, granularita: 'stazione->comune', note_path: 'notes/aria-lombardia.md',
    quirks: "stato='VA' esclude -9999; nicp-bhqi=anno corrente, g2hp-ar79=storico 2018+; valori operativi, NON certificati ARPA",
  })

  const seen = new Set<string>()
  const rows: Record<string, unknown>[] = []
  for (const m of [...m2024, ...mNow]) {
    const sc = sensorMeta.get(String(m.idsensore))
    if (!sc) continue
    const val = toNum(m.valore)
    if (val == null || val === -9999) continue
    const data = String(m.data).slice(0, 10)
    const key = m.idsensore + '|' + data
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ comune_istat: sc.istat, id_sensore: String(m.idsensore), inquinante: 'PM10', data, valore: val, unita: sc.unita, fonte_id: fonteMeas })
  }
  let inserted = 0
  const CH = 2000
  for (let i = 0; i < rows.length; i += CH) {
    const c = rows.slice(i, i + CH)
    await sql`insert into mart.aria_misure ${sql(c, 'comune_istat', 'id_sensore', 'inquinante', 'data', 'valore', 'unita', 'fonte_id')}`
    inserted += c.length
  }
  console.log('aria_misure PM10 inserted:', inserted, '| 2024 rows:', m2024.length, '| current rows:', mNow.length)
  await sql.end()
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
