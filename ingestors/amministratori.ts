// DAIT (Min. Interno) -> mart.amministratore_comune ("chi governa"). Full national refresh.
// CRITICAL: DAIT comune codes are NOT ISTAT -> join by (denominazione_comune, sigla_provincia).
import { sql, SNAP } from './_framework/env'
import { fetchBuffer } from './_framework/download'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import { normName, bulkInsert } from './_framework/util'
import { parse } from 'csv-parse/sync'
import type { Sql } from 'postgres'

const SRC = 'dait_amministratori'
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
  const storage_path = await landSnapshot(SRC, 'ammcom.csv', buf, 'text/csv')
  const fonteId = await recordFonte({
    source: SRC, dataset_id: 'ammcom',
    titolo: 'Min. Interno DAIT — amministratori comunali in carica',
    url: URL, snapshot_date: SNAP, storage_path, formato: 'csv',
    license: 'non dichiarata — verificare prima di citare', // ground truth manifest.yaml/notes: NON assumere IODL/CC-BY
    granularita: 'comune', note_path: 'notes/dait-amministratori.md',
    quirks: 'header a riga 3 (2 righe meta); join per (denominazione_comune, sigla_provincia) — codici DAIT ≠ ISTAT; nomi UPPERCASE',
  })

  const records = parse(buf, {
    delimiter: ';', columns: true, from_line: 3, skip_empty_lines: true, relax_quotes: true, relax_column_count: true,
  }) as Record<string, string>[]

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
  if (rows.length === 0) throw new Error('0 righe dal parse DAIT — abort, mart.amministratore_comune non toccato')
  // guard anti-drop parziale: una ripubblicazione DAIT dimezzata non deve sostituire silenziosamente il mart
  const [{ esistenti }] = await sql<{ esistenti: number }[]>`select count(*)::int as esistenti from mart.amministratore_comune`
  if (esistenti > 0 && rows.length < esistenti * 0.5)
    throw new Error(`parse parziale sospetto: ${rows.length} righe nuove vs ${esistenti} esistenti (< 50%) — abort, mart.amministratore_comune non toccato`)
  // full refresh atomico: delete+insert in transazione, un crash a metà non svuota il mart
  const n = await sql.begin(async (sql) => {
    await sql`delete from mart.amministratore_comune`
    // cast: nei typings di postgres 3.4 TransactionSql non è assegnabile a Sql (entrambi estendono ISql); a runtime è lo stesso handle
    return bulkInsert(sql as unknown as Sql, 'mart.amministratore_comune', rows,
      ['comune_istat', 'cognome', 'nome', 'carica', 'incarico', 'sesso', 'data_nascita', 'lista', 'data_elezione', 'fonte_id'], 2000)
  })
  console.log('amministratori inserted:', n, '| unmatched comuni:', unmatched, '| source rows:', records.length)
  await sql.end()
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
