// MIUR Edilizia Scolastica -> mart.scuola_edificio. 3 CSVs joined on CODICEEDIFICIO (text, 10-char).
// Booleans are 4-valued (SI/NO/IN PARTE/NON DEFINITO) -> true/false/null. Dedup to distinct edificio.
import { sql, SNAP } from './_framework/env'
import { fetchBuffer, curlText } from './_framework/download'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import { loadComuneSet, bulkUpsert } from './_framework/util'

const SRC = 'miur_edilizia_scolastica'
const BASE = 'https://dati.istruzione.it/opendata/opendata/file/'
const CATALOGO = 'https://dati.istruzione.it/opendata/opendata/catalogo/elements1/?area=Edilizia+Scolastica'
// Fallback = ultimo filename noto (snapshot pubblicazione 2025-08-06). Il token nel nome cambia a ogni
// ripubblicazione (notes/miur-edilizia.md) -> discoverFilenames() lo riscopre dal catalogo a ogni run.
const FALLBACK = {
  EDIANAGRAFESTA: 'EDIANAGRAFESTA202120242520250806.csv',
  EDICONSICUREZZASTA: 'EDICONSICUREZZASTA202120242520250806.csv',
  EDIVINCOLISTA: 'EDIVINCOLISTA202120242520250806.csv',
} as const
type Prefisso = keyof typeof FALLBACK

// Il catalogo (HTML server-side) lista tutte le versioni pubblicate come href="<PREFISSO><token>.csv";
// il token termina sempre con la data di pubblicazione YYYYMMDD -> per prefisso si prende la più recente.
function discoverFilenames(): Record<Prefisso, string> {
  const out: Record<Prefisso, string> = { ...FALLBACK }
  let html: string
  try {
    html = curlText(CATALOGO, { rejectEmpty: true })
  } catch (e) {
    console.warn(`⚠️ catalogo MIUR irraggiungibile (${e instanceof Error ? e.message : e}) — uso i filename hardcoded (snapshot 2025-08-06)`)
    return out
  }
  for (const p of Object.keys(FALLBACK) as Prefisso[]) {
    const found = [...new Set([...html.matchAll(new RegExp(`href="(${p}\\d+\\.csv)"`, 'g'))].map((m) => m[1]))]
    if (found.length === 0) { console.warn(`⚠️ catalogo MIUR: nessun ${p}*.csv nel catalogo — uso il fallback ${out[p]}`); continue }
    found.sort((a, b) => a.slice(-12, -4).localeCompare(b.slice(-12, -4)) || a.localeCompare(b)) // ultime 8 cifre = data pubblicazione
    out[p] = found[found.length - 1]
    if (out[p] !== FALLBACK[p]) console.log(`catalogo MIUR: ${p} ripubblicato -> ${out[p]} (hardcoded era ${FALLBACK[p]})`)
  }
  return out
}

function bool4(v: string | undefined): boolean | null {
  const s = (v ?? '').trim().toUpperCase()
  if (s === 'SI') return true
  if (s === 'NO') return false
  return null // IN PARTE / NON DEFINITO / blank
}

async function main() {
  await ensureBucket()
  const valid = await loadComuneSet()

  const files = discoverFilenames()

  const get = async (fn: string): Promise<string[]> => {
    const buf = await fetchBuffer(BASE + fn).catch((e) => {
      throw new Error(`download MIUR fallito per ${fn} — il token nel filename cambia a ogni ripubblicazione, verificare il catalogo ${CATALOGO} (notes/miur-edilizia.md): ${e instanceof Error ? e.message : e}`)
    })
    await landSnapshot(SRC, fn, buf, 'text/csv')
    return buf.toString('utf8').split(/\r?\n/)
  }
  const [ana, sic, vin] = await Promise.all([get(files.EDIANAGRAFESTA), get(files.EDICONSICUREZZASTA), get(files.EDIVINCOLISTA)])

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

  // dataset_id dal token del file risolto (es. 202120242520250806 -> edilizia_2021_2024_20250806)
  const token = files.EDIANAGRAFESTA.slice('EDIANAGRAFESTA'.length, -4)
  const fonteId = await recordFonte({
    source: SRC, dataset_id: token.length === 18 ? `edilizia_${token.slice(0, 4)}_${token.slice(4, 8)}_${token.slice(-8)}` : `edilizia_${token}`,
    titolo: 'MIUR — Edilizia scolastica (anagrafe + sicurezza + vincoli)',
    url: BASE + files.EDIANAGRAFESTA, snapshot_date: SNAP, formato: 'csv', license: 'IODL-2.0',
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
