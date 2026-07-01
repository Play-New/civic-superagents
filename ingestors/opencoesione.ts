// OpenCoesione -> mart.progetto_coesione + mart.progetto_comune. Cohesion funds (NOT PNRR).
// Default: Lombardia 2021-2027. COESIONE_SCOPE=national -> tutta Italia 2021-2027. Stream CSV da disco.
import { sql, SNAP } from './_framework/env'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import { loadComuneSet, bulkUpsert, parseItNumber } from './_framework/util'
import { curlToFile } from './_framework/download'
import { parse } from 'csv-parse'
import { createReadStream, readFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SRC = 'opencoesione'
const NATIONAL = process.env.COESIONE_SCOPE === 'national'
const OVERRIDE = process.env.COESIONE_URL
const URL = OVERRIDE ||
  (NATIONAL
    ? 'https://opencoesione.gov.it/it/opendata/progetti_esteso_2021-2027.zip'
    : 'https://opencoesione.gov.it/it/opendata/regioni/progetti_esteso_LOM_2021-2027.zip')
// provenienza veritiera: con COESIONE_URL il dataset_id viene dal file davvero scaricato, non dallo scope
const DATASET = OVERRIDE
  ? (OVERRIDE.split('?')[0].split('/').pop() || 'coesione_override').replace(/\.zip$/i, '')
  : NATIONAL ? 'progetti_esteso_2021-2027' : 'progetti_esteso_LOM_2021-2027'
const SCOPE = OVERRIDE ? `override: ${DATASET}` : NATIONAL ? 'NAZIONALE' : 'Lombardia'
const TITOLO = OVERRIDE
  ? `OpenCoesione — progetti coesione (override COESIONE_URL: ${DATASET})`
  : `OpenCoesione — progetti coesione ${NATIONAL ? 'Italia' : 'Lombardia'} (ciclo 2021-2027)`

async function main() {
  await ensureBucket()
  const valid = await loadComuneSet()
  const zipPath = join(tmpdir(), 'coesione.zip')
  const dir = join(tmpdir(), 'coesione_x')
  curlToFile(URL, zipPath, { rejectEmpty: true })
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
  execFileSync('unzip', ['-o', '-j', zipPath, '*.csv', '-d', dir], { maxBuffer: 1024 * 1024 })
  const csvPath = join(dir, readdirSync(dir).find((f) => f.endsWith('.csv'))!)

  const storage_path = await landSnapshot(SRC, `${DATASET}.zip`, readFileSync(zipPath), 'application/zip')
  const fonteId = await recordFonte({
    source: SRC, dataset_id: DATASET, titolo: TITOLO,
    url: URL, snapshot_date: SNAP, storage_path, formato: 'csv-zip', license: 'CC-BY-4.0',
    granularita: 'comune', note_path: 'notes/opencoesione.md',
    quirks: 'NON PNRR (fondi coesione); grain=COD_LOCALE_PROGETTO; COD_COMUNE = 003+istat (multi-comune con :::); importi NON ripartiti tra comuni; decimale virgola',
  })

  const projects: Record<string, unknown>[] = []
  const links: Record<string, unknown>[] = []
  const seenLink = new Set<string>()
  let idx: Record<string, number> | null = null
  let multi = 0
  const parser = createReadStream(csvPath).pipe(parse({ delimiter: ';', relax_quotes: true, skip_empty_lines: true, relax_column_count: true }))
  for await (const rec of parser as AsyncIterable<string[]>) {
    if (!idx) { idx = {}; rec.forEach((h, i) => (idx![h] = i)); continue }
    const codLocale = rec[idx.COD_LOCALE_PROGETTO]?.trim()
    if (!codLocale) continue
    const istats = [...new Set((rec[idx.COD_COMUNE] ?? '').split(':::').map((c) => c.trim().slice(-6)).filter((c) => valid.has(c)))]
    if (istats.length > 1) multi++
    projects.push({
      cod_locale: codLocale, cup: rec[idx.CUP]?.trim() || null, titolo: rec[idx.OC_TITOLO_PROGETTO]?.trim() || null,
      programma: rec[idx.OC_DESCRIZIONE_PROGRAMMA]?.trim() || null, ambito: rec[idx.OC_AMBITO]?.trim() || null,
      ciclo: rec[idx.OC_DESCR_CICLO]?.trim() || null, importo_finanziato: parseItNumber(rec[idx.FINANZ_TOTALE_PUBBLICO]),
      importo_pagato: parseItNumber(rec[idx.TOT_PAGAMENTI]), stato: rec[idx.OC_STATO_PROGETTO]?.trim() || null,
      n_comuni: istats.length, fonte_id: fonteId,
    })
    for (const ist of istats) {
      const k = codLocale + '|' + ist
      if (seenLink.has(k)) continue
      seenLink.add(k)
      links.push({ cod_locale: codLocale, comune_istat: ist })
    }
  }
  rmSync(zipPath, { force: true }); rmSync(dir, { recursive: true, force: true })

  // dedup by cod_locale (il file nazionale può ripetere un progetto)
  const seenP = new Map<string, Record<string, unknown>>()
  for (const p of projects) seenP.set(p.cod_locale as string, p)
  const dedupP = [...seenP.values()]

  const np = await bulkUpsert('mart.progetto_coesione', dedupP,
    ['cod_locale', 'cup', 'titolo', 'programma', 'ambito', 'ciclo', 'importo_finanziato', 'importo_pagato', 'stato', 'n_comuni', 'fonte_id'],
    '(cod_locale)', ['cup', 'titolo', 'programma', 'ambito', 'ciclo', 'importo_finanziato', 'importo_pagato', 'stato', 'n_comuni', 'fonte_id'])
  const nl = await bulkUpsert('mart.progetto_comune', links, ['cod_locale', 'comune_istat'], '(cod_locale, comune_istat)', ['cod_locale'])
  console.log(`opencoesione (${SCOPE}) done. progetti:`, np, '| link:', nl, '| multi-comune:', multi)
  await sql.end()
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
