// MIUR Edilizia Scolastica -> mart.scuola_edificio. 3 CSVs joined on CODICEEDIFICIO (text, 10-char).
// Booleans are 4-valued (SI/NO/IN PARTE/NON DEFINITO) -> true/false/null. Dedup to distinct edificio.
import { sql } from './_framework/env'
import { fetchBuffer } from './_framework/download'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import { loadComuneSet, bulkUpsert } from './_framework/util'

const SRC = 'miur_edilizia_scolastica'
const SNAP = '2026-06-29'
const BASE = 'https://dati.istruzione.it/opendata/opendata/file/'
const F_ANA = 'EDIANAGRAFESTA202120242520250806.csv'
const F_SIC = 'EDICONSICUREZZASTA202120242520250806.csv'
const F_VIN = 'EDIVINCOLISTA202120242520250806.csv'

function bool4(v: string | undefined): boolean | null {
  const s = (v ?? '').trim().toUpperCase()
  if (s === 'SI') return true
  if (s === 'NO') return false
  return null // IN PARTE / NON DEFINITO / blank
}

async function main() {
  await ensureBucket()
  const valid = await loadComuneSet()

  const get = async (fn: string): Promise<string[]> => {
    const buf = await fetchBuffer(BASE + fn)
    await landSnapshot(SRC, SNAP, fn, buf, 'text/csv')
    return buf.toString('utf8').split(/\r?\n/)
  }
  const [ana, sic, vin] = [await get(F_ANA), await get(F_SIC), await get(F_VIN)]

  // EDIANAGRAFE: ANNOSCOLASTICO,CODICESCUOLA,CODICEEDIFICIO,CODICECOMUNE,DESCRIZIONECOMUNE,...
  const anaMap = new Map<string, { comune: string }>()
  for (let i = 1; i < ana.length; i++) {
    const f = ana[i].split(',')
    if (f.length < 5) continue
    const ed = f[2]?.trim()
    if (!ed || anaMap.has(ed)) continue
    anaMap.set(ed, { comune: f[3].trim() })
  }
  // EDICONSICUREZZA: ...,CODICEEDIFICIO(2),CERTIFICATOSEGNALAZIONEAGIBILITA(3),...,CERTIFICATOPREVENZIONEINCENDI(5)
  const sicMap = new Map<string, { agib: boolean | null; anti: boolean | null }>()
  for (let i = 1; i < sic.length; i++) {
    const f = sic[i].split(',')
    if (f.length < 6) continue
    const ed = f[2]?.trim()
    if (!ed || sicMap.has(ed)) continue
    sicMap.set(ed, { agib: bool4(f[3]), anti: bool4(f[5]) })
  }
  // EDIVINCOLI: ...,CODICEEDIFICIO(2),...,CLASSIFICAZIONESISMICANAZIONALE(7)
  const vinMap = new Map<string, string | null>()
  for (let i = 1; i < vin.length; i++) {
    const f = vin[i].split(',')
    if (f.length < 8) continue
    const ed = f[2]?.trim()
    if (!ed || vinMap.has(ed)) continue
    vinMap.set(ed, (f[7] ?? '').trim() || null)
  }

  const fonteId = await recordFonte({
    source: SRC, dataset_id: 'edilizia_2021_2024_20250806',
    titolo: 'MIUR — Edilizia scolastica (anagrafe + sicurezza + vincoli)',
    url: BASE + F_ANA, snapshot_date: SNAP, formato: 'csv', license: 'IODL-2.0',
    granularita: 'edificio', note_path: 'notes/miur-edilizia.md',
    quirks: 'join 3 file su CODICEEDIFICIO (text 10); bool 4-valori -> true/false/null; CODICECOMUNE=codice_istat; dedup per edificio',
  })

  const rows: Record<string, unknown>[] = []
  let skipped = 0
  for (const [ed, a] of anaMap) {
    if (!valid.has(a.comune)) { skipped++; continue }
    const s = sicMap.get(ed)
    rows.push({
      codice_edificio: ed,
      comune_istat: a.comune,
      denominazione: null, // MIUR ha solo nome comune/indirizzo, non un nome edificio
      agibilita: s?.agib ?? null,
      certificato_antincendio: s?.anti ?? null,
      zona_sismica: vinMap.get(ed) ?? null,
      fonte_id: fonteId,
    })
  }
  const n = await bulkUpsert('mart.scuola_edificio', rows,
    ['codice_edificio', 'comune_istat', 'denominazione', 'agibilita', 'certificato_antincendio', 'zona_sismica', 'fonte_id'],
    '(codice_edificio)',
    ['comune_istat', 'agibilita', 'certificato_antincendio', 'zona_sismica', 'fonte_id'])
  console.log('scuola_edificio upserted:', n, '| distinct edifici:', anaMap.size, '| skipped (unknown comune):', skipped)
  await sql.end()
}

main().catch((e) => {
  console.error('FAILED:', e)
  process.exit(1)
})
