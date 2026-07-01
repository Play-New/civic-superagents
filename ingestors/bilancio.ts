// BDAP FET Rendiconto -> mart.bilancio_comune (spesa per comune × anno × MISSIONE armonizzata).
// Default: Lombardia 2022-24. BDAP_SCOPE=national -> tutte le regioni, 2024. URL via discovery API.
import { sql, SNAP } from './_framework/env'
import { ensureBucket, landSnapshot } from './_framework/storage'
import { recordFonte } from './_framework/provenance'
import { curlText, curlToFile } from './_framework/download'
import { parseDotNumber, loadComuneSet, bulkUpsert, normName } from './_framework/util'
import { parse } from 'csv-parse/sync'
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SRC = 'bdap_rendiconto'
const REFERER = 'https://openbdap.rgs.mef.gov.it/it/FET/Analizza'
const HOST = 'https://openbdap.rgs.mef.gov.it'

const REGIONI_NAZ = ['Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche', 'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', 'Aosta', 'Veneto']

// Env: BDAP_SCOPE=national -> tutte le regioni, anno 2024. BDAP_REGIONI='A|B' -> regioni custom, anni default.
// BDAP_YEARS='2023,2024' -> override esplicito degli anni (vince su tutto).
const NATIONAL = process.env.BDAP_SCOPE === 'national'
const REGIONI = process.env.BDAP_REGIONI ? process.env.BDAP_REGIONI.split('|') : NATIONAL ? REGIONI_NAZ : ['Lombardia']
const YEARS = process.env.BDAP_YEARS ? process.env.BDAP_YEARS.split(',').map(Number) : NATIONAL ? [2024] : [2022, 2023, 2024]

function discoverZipUrl(year: number, country: string): string | null {
  const api = `${HOST}/fet/GetDocuments?type=Rendiconto&year=${year}&country=${encodeURIComponent(country)}`
  const out = curlText(api, { headers: [['Referer', REFERER]], maxBufferMb: 4 })
  const item = (JSON.parse(out) as { Name: string; Url: string }[]).find((x) => /schemi di bilancio/i.test(x.Name))
  return item ? HOST + encodeURI(item.Url) : null
}

async function loadOne(country: string, year: number, valid: Set<string>, byName: Map<string, string>): Promise<number> {
  const url = discoverZipUrl(year, country)
  if (!url) { console.log(`  ${country} ${year}: nessuno Schemi di bilancio`); return 0 }
  const slug = country.replace(/[^A-Za-z]/g, '').toUpperCase()
  const zipPath = join(tmpdir(), `bdap_${year}_${slug}.zip`)
  curlToFile(url, zipPath, { headers: [['Referer', REFERER]], rejectEmpty: true })
  const zipBuf = readFileSync(zipPath) // ~50 MB/regione: letto una volta sola per il landing
  // raw = i byte ORIGINALI dello zip scaricato; il decode latin1 più sotto serve solo al parsing
  const storage_path = await landSnapshot(SRC, `${year}/${slug}/Schemi_di_bilancio.zip`, zipBuf, 'application/zip')
  const csvBuf = execFileSync('unzip', ['-p', zipPath, '*Spese Riepilogo Missioni_*.csv'], { maxBuffer: 256 * 1024 * 1024 })
  rmSync(zipPath, { force: true })
  const text = csvBuf.toString('latin1')
  const fonteId = await recordFonte({
    source: SRC, dataset_id: `rendiconto_${slug}_${year}`,
    titolo: `BDAP Rendiconto — spesa per missione, comuni ${country} ${year}`,
    url, snapshot_date: SNAP, storage_path, formato: 'csv-zip', license: 'MEF-RGS (verificare)',
    latest_usable_year: year, granularita: 'comune', note_path: 'notes/bdap-bilancio.md',
    quirks: "filtro 'Codice Tipologia Soggetto'='ELCOMU'; comune_istat = Codice Provincia(3)||Codice Comune(3); latin-1; decimale '.'; impegni=competenza",
  })
  const records = parse(text, { delimiter: ';', columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true }) as Record<string, string>[]
  const rows: Record<string, unknown>[] = []
  for (const r of records) {
    if ((r['Codice Tipologia Soggetto'] ?? '').trim() !== 'ELCOMU') continue
    let istat = (r['Codice Provincia'] ?? '').trim().padStart(3, '0') + (r['Codice Comune'] ?? '').trim().padStart(3, '0')
    if (!valid.has(istat)) {
      // some regions (es. Sardegna) usano codici provincia non-ISTAT -> fallback per nome+regione
      const alt = byName.get(normName(r['Descrizione Comune'] ?? '') + '|' + normName(r['Descrizione Regione'] ?? ''))
      if (!alt) continue
      istat = alt
    }
    rows.push({
      comune_istat: istat, anno: year,
      missione_cod: (r['Codice Missione'] ?? '').trim(), missione_desc: r['Descrizione Missione'] || null,
      impegni: parseDotNumber(r['Impegni']), totale_pagamenti: parseDotNumber(r['Totale Pagamenti']), fonte_id: fonteId,
    })
  }
  // dedup (comune_istat, anno, missione_cod) — il name-fallback può mappare 2 sorgenti sullo stesso comune
  const seen = new Map<string, Record<string, unknown>>()
  for (const r of rows) seen.set(`${r.comune_istat}|${r.anno}|${r.missione_cod}`, r)
  const deduped = [...seen.values()]
  const n = await bulkUpsert('mart.bilancio_comune', deduped,
    ['comune_istat', 'anno', 'missione_cod', 'missione_desc', 'impegni', 'totale_pagamenti', 'fonte_id'],
    '(comune_istat, anno, missione_cod)', ['missione_desc', 'impegni', 'totale_pagamenti', 'fonte_id'])
  console.log(`  ${country} ${year}: ${n} righe`)
  return n
}

async function main() {
  await ensureBucket()
  const valid = await loadComuneSet()
  const comuni = await sql<{ codice_istat: string; denominazione: string; denominazione_regione: string | null }[]>`select codice_istat, denominazione, denominazione_regione from geo.comuni`
  const byName = new Map<string, string>()
  for (const c of comuni) if (c.denominazione_regione) byName.set(normName(c.denominazione) + '|' + normName(c.denominazione_regione), c.codice_istat)
  console.log(`scope: ${NATIONAL ? 'NAZIONALE' : 'Lombardia'} — ${REGIONI.length} regioni × ${YEARS.length} anni`)
  let grand = 0
  for (const year of YEARS) for (const country of REGIONI) {
    try { grand += await loadOne(country, year, valid, byName) } catch (e) { console.log(`  ${country} ${year}: FALLITO — ${(e as Error).message.slice(0, 80)}`) }
  }
  console.log('bilancio done. total:', grand)
  await sql.end()
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
