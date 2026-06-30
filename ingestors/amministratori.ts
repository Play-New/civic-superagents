// DAIT (Min. Interno) -> mart.amministratore_comune ("chi governa"). Full national refresh.
// CRITICAL: DAIT comune codes are NOT ISTAT -> join by (denominazione_comune, sigla_provincia).
import { sql } from './_framework/env'
import { fetchBuffer } from './_framework/download'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import { normName } from './_framework/util'
import { parse } from 'csv-parse/sync'

const SRC = 'dait_amministratori'
const SNAP = '2026-06-29'
const URL = 'https://dait.interno.gov.it/documenti/ammcom.csv'

const itDate = (s: string | undefined): string | null => {
  const m = (s ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

async function main() {
  await ensureBucket()
  const comuni = await sql<{ codice_istat: string; denominazione: string; sigla_provincia: string | null }[]>`
    select codice_istat, denominazione, sigla_provincia from geo.comuni`
  // bilingual names (Bolzano/Bozen) -> index both halves; '/' split covers Alto Adige.
  const aliases = (name: string) => [...new Set([normName(name), ...name.split('/').map((p) => normName(p))])].filter(Boolean)
  const bySigla = new Map<string, string>() // "alias|SIGLA" -> istat
  const byNameAll = new Map<string, Set<string>>() // alias -> {istat}, to detect nationally-unique names
  for (const c of comuni) {
    for (const al of aliases(c.denominazione)) {
      if (c.sigla_provincia) bySigla.set(al + '|' + c.sigla_provincia.toUpperCase().trim(), c.codice_istat)
      ;(byNameAll.get(al) ?? byNameAll.set(al, new Set()).get(al)!).add(c.codice_istat)
    }
  }
  const byUniqueName = new Map<string, string>() // alias -> istat (only where nationally unique)
  for (const [al, set] of byNameAll) if (set.size === 1) byUniqueName.set(al, [...set][0])
  // primary: (name, sigla); fallback: nationally-unique name (handles abolished Sardinian provinces OT/VS/CI/OG)
  const resolve = (name: string, sigla: string): string | undefined => {
    const al = normName(name)
    return bySigla.get(al + '|' + (sigla || '').toUpperCase().trim()) ?? byUniqueName.get(al)
  }

  const buf = await fetchBuffer(URL)
  const storage_path = await landSnapshot(SRC, SNAP, 'ammcom.csv', buf, 'text/csv')
  const fonteId = await recordFonte({
    source: SRC, dataset_id: 'ammcom',
    titolo: 'Min. Interno DAIT — amministratori comunali in carica',
    url: URL, snapshot_date: SNAP, storage_path, formato: 'csv',
    license: 'CC-BY-4.0',
    granularita: 'comune', note_path: 'notes/dait-amministratori.md',
    quirks: 'header a riga 3 (2 righe meta); join per (denominazione_comune, sigla_provincia) — codici DAIT ≠ ISTAT; nomi UPPERCASE',
  })

  const records = parse(buf, {
    delimiter: ';', columns: true, from_line: 3, skip_empty_lines: true, relax_quotes: true, relax_column_count: true,
  }) as Record<string, string>[]

  await sql`delete from mart.amministratore_comune` // full refresh
  const rows: Record<string, unknown>[] = []
  let unmatched = 0
  for (const r of records) {
    const istat = resolve(r.denominazione_comune ?? '', r.sigla_provincia ?? '')
    if (!istat) { unmatched++; continue }
    rows.push({
      comune_istat: istat,
      cognome: r.cognome || null, nome: r.nome || null,
      carica: r.descrizione_carica || null, incarico: r.incarico || null,
      sesso: r.sesso || null, data_nascita: itDate(r.data_nascita),
      lista: r['lista_appartenenza/collegamento'] || null, data_elezione: itDate(r.data_elezione),
      fonte_id: fonteId,
    })
  }
  let n = 0
  const CH = 2000
  for (let i = 0; i < rows.length; i += CH) {
    const c = rows.slice(i, i + CH)
    await sql`insert into mart.amministratore_comune ${sql(c, 'comune_istat', 'cognome', 'nome', 'carica', 'incarico', 'sesso', 'data_nascita', 'lista', 'data_elezione', 'fonte_id')}`
    n += c.length
  }
  console.log('amministratori inserted:', n, '| unmatched comuni:', unmatched, '| source rows:', records.length)
  await sql.end()
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
