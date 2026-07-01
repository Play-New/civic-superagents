// OpenPNRR -> mart.pnrr_progetto + mart.pnrr_progetto_comune (real PNRR per comune, CUP-level).
import { sql, SNAP } from './_framework/env'
import { curlToFile } from './_framework/download'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import { parseDotNumber, loadComuneSet, bulkUpsert } from './_framework/util'
import { parse } from 'csv-parse'
import { createReadStream, readFileSync, rmSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SRC = 'openpnrr'
const PROGETTI = 'https://openpnrr.s3.amazonaws.com/media/progetti.csv'
const TERRITORI = 'https://openpnrr.s3.amazonaws.com/media/progetti_territori.csv'

function misComp(codice: string | undefined): { mis: string | null; comp: string | null } {
  const m = (codice ?? '').trim().match(/^(M\d+)(C\d+)?/)
  return { mis: m ? m[1] : null, comp: m && m[2] ? m[1] + m[2] : null }
}

async function streamCsv(path: string, onRow: (r: Record<string, string>) => void): Promise<void> {
  const parser = createReadStream(path).pipe(parse({ columns: true, relax_quotes: true, skip_empty_lines: true }))
  for await (const r of parser as AsyncIterable<Record<string, string>>) onRow(r)
}

async function main() {
  await ensureBucket()
  const valid = await loadComuneSet()
  const pTerr = join(tmpdir(), 'openpnrr_territori.csv')
  const pProg = join(tmpdir(), 'openpnrr_progetti.csv')
  curlToFile(TERRITORI, pTerr, { rejectEmpty: true })
  curlToFile(PROGETTI, pProg, { rejectEmpty: true })

  // Snapshot raw di ENTRAMBI i CSV. progetti.csv (~117 MB: importi, titoli, misure) gzippato
  // byte-fedele (gunzip restituisce i byte scaricati) per stare nei limiti di storage.
  const pathTerr = await landSnapshot(SRC, 'progetti_territori.csv', readFileSync(pTerr), 'text/csv')
  const storage_path = await landSnapshot(SRC, 'progetti.csv.gz', gzipSync(readFileSync(pProg)), 'application/gzip')
  const fonteId = await recordFonte({
    source: SRC, dataset_id: 'progetti_2025-09',
    titolo: 'OpenPNRR — progetti PNRR e localizzazioni per comune',
    url: PROGETTI, snapshot_date: SNAP, storage_path, formato: 'csv', license: 'ODbL-1.0',
    granularita: 'comune', note_path: 'notes/openpnrr.md',
    quirks: `CUP×comune; istat_id (tipologia=C)=codice_istat; importo NON ripartito tra comuni; stato per-progetto NON disponibile (ReGiS chiuso); S3 datati 2025-09; snapshot progetti gzippato byte-fedele; secondo snapshot (territori): ${pathTerr}`,
  })

  // 1) localizations -> junction + wanted progetto_ids
  const links: Record<string, unknown>[] = []
  const seen = new Set<string>()
  const wanted = new Set<string>()
  await streamCsv(pTerr, (r) => {
    if ((r.tipologia ?? '').trim() !== 'C') return
    const istat = (r.istat_id ?? '').trim()
    if (!valid.has(istat)) return
    const pid = (r.progetto_id ?? '').trim()
    wanted.add(pid)
    const k = pid + '|' + istat
    if (seen.has(k)) return
    seen.add(k)
    links.push({ progetto_id: pid, comune_istat: istat })
  })

  // 2) projects (only comune-localized)
  const projects: Record<string, unknown>[] = []
  const loaded = new Set<string>()
  await streamCsv(pProg, (r) => {
    const pid = (r.progetto_id ?? '').trim()
    if (!wanted.has(pid) || loaded.has(pid)) return
    loaded.add(pid)
    const { mis, comp } = misComp(r.codice_misura)
    projects.push({
      progetto_id: pid, cup: r.cup || null, titolo: r.titolo || null,
      codice_misura: r.codice_misura || null, missione: mis, componente: comp,
      descrizione_misura: r.descrizione || null,
      importo_pnrr: parseDotNumber(r.finanziamento_pnrr), importo_totale: parseDotNumber(r.finanziamento_totale),
      is_in_regis: ['true', 't', '1'].includes((r.is_in_regis ?? '').trim().toLowerCase()),
      soggetto_attuatore: r.soggetto_attuatore_denominazione || null, fonte_id: fonteId,
    })
  })
  rmSync(pTerr, { force: true })
  rmSync(pProg, { force: true })

  const np = await bulkUpsert('mart.pnrr_progetto', projects,
    ['progetto_id', 'cup', 'titolo', 'codice_misura', 'missione', 'componente', 'descrizione_misura', 'importo_pnrr', 'importo_totale', 'is_in_regis', 'soggetto_attuatore', 'fonte_id'],
    '(progetto_id)',
    ['cup', 'titolo', 'codice_misura', 'missione', 'componente', 'descrizione_misura', 'importo_pnrr', 'importo_totale', 'is_in_regis', 'soggetto_attuatore', 'fonte_id'])
  const linksOk = links.filter((l) => loaded.has(l.progetto_id as string))
  const nl = await bulkUpsert('mart.pnrr_progetto_comune', linksOk, ['progetto_id', 'comune_istat'], '(progetto_id, comune_istat)', ['progetto_id'])
  console.log('openpnrr done. progetti:', np, '| link progetto-comune:', nl, '(of', links.length, 'comune-loc)')
  await sql.end()
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
