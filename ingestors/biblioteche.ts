// ICCU Anagrafe Biblioteche -> mart.biblioteca_comune (cultura wedge). CC0, ISTAT-keyed.
import { sql, SNAP } from './_framework/env'
import { fetchBuffer } from './_framework/download'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import { loadComuneSet, bulkUpsert } from './_framework/util'
import AdmZip from 'adm-zip'

const SRC = 'iccu_biblioteche'
const URL = 'https://opendata.anagrafe.iccu.sbn.it/biblioteche.zip'

interface Bib {
  'codici-identificativi'?: { isil?: string }
  denominazioni?: { ufficiale?: string }
  indirizzo?: { 'via-piazza'?: string; comune?: { istat?: string }; coordinate?: number[] }
  'tipologia-funzionale'?: string
  'tipologia-amministrativa'?: string
}

async function main() {
  await ensureBucket()
  const valid = await loadComuneSet()
  const zipBuf = await fetchBuffer(URL)
  const storage_path = await landSnapshot(SRC, 'biblioteche.zip', zipBuf, 'application/zip')
  const entry = new AdmZip(zipBuf).getEntries().find((e) => e.entryName.endsWith('.json'))
  if (!entry) throw new Error('no json in zip')
  const data = JSON.parse(entry.getData().toString('utf8')) as { biblioteche: Bib[] }

  const fonteId = await recordFonte({
    source: SRC, dataset_id: 'biblioteche', titolo: 'ICCU — Anagrafe Biblioteche Italiane',
    url: URL, snapshot_date: SNAP, storage_path, formato: 'json-zip', license: 'CC0-1.0',
    granularita: 'comune', note_path: 'notes/iccu-biblioteche.md',
    quirks: 'isil PK; indirizzo.comune.istat = codice_istat; coordinate = [lat,lng]; due assi di tipologia (funzionale + amministrativa)',
  })

  const rows: Record<string, unknown>[] = []
  for (const b of data.biblioteche) {
    const isil = b['codici-identificativi']?.isil
    if (!isil) continue
    const istatRaw = b.indirizzo?.comune?.istat
    const coord = Array.isArray(b.indirizzo?.coordinate) && b.indirizzo!.coordinate!.length === 2 ? b.indirizzo!.coordinate! : [null, null]
    rows.push({
      isil,
      comune_istat: istatRaw && valid.has(istatRaw) ? istatRaw : null,
      denominazione: b.denominazioni?.ufficiale ?? null,
      tipologia_funzionale: b['tipologia-funzionale'] ?? null,
      tipologia_amministrativa: b['tipologia-amministrativa'] ?? null,
      indirizzo: b.indirizzo?.['via-piazza'] ?? null,
      lat: coord[0], lng: coord[1], fonte_id: fonteId,
    })
  }
  const n = await bulkUpsert('mart.biblioteca_comune', rows,
    ['isil', 'comune_istat', 'denominazione', 'tipologia_funzionale', 'tipologia_amministrativa', 'indirizzo', 'lat', 'lng', 'fonte_id'],
    '(isil)',
    ['comune_istat', 'denominazione', 'tipologia_funzionale', 'tipologia_amministrativa', 'indirizzo', 'lat', 'lng', 'fonte_id'])
  console.log('biblioteche upserted:', n, '| senza match comune:', rows.filter((r) => !r.comune_istat).length)
  await sql.end()
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
