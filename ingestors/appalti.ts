// ANAC -> mart.appalto: appalti aggiudicati dove la stazione appaltante è un COMUNE (2024).
// 4 dataset uniti su CIG: cig (master) + stazioni-appaltanti (CF->comune) + aggiudicazioni (importo) + aggiudicatari (vincitore).
import { sql, SNAP } from './_framework/env'
import { recordFonte } from './_framework/provenance'
import { curlToFile } from './_framework/download'
import { parseDotNumber, loadComuneSet, bulkUpsert } from './_framework/util'
import { parse } from 'csv-parse'
import { createReadStream, readdirSync, rmSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SRC = 'anac_appalti'
const ANNO = 2024
const BASE = 'https://dati.anticorruzione.it/opendata/download/dataset'

async function streamZipCsvs(url: string, name: string, onRow: (r: Record<string, string>) => void): Promise<void> {
  const zip = join(tmpdir(), `anac_${name}.zip`)
  const dir = join(tmpdir(), `anac_${name}`)
  curlToFile(url, zip, { rejectEmpty: true }) // UA browser condiviso (WAF ANAC) + retry integrato
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
  execFileSync('unzip', ['-o', '-j', zip, '*.csv', '-d', dir], { maxBuffer: 1024 * 1024 })
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.csv') || /logcsv/i.test(f)) continue
    const parser = createReadStream(join(dir, f)).pipe(parse({ delimiter: ';', columns: true, relax_quotes: true, skip_empty_lines: true, relax_column_count: true }))
    for await (const rec of parser as AsyncIterable<Record<string, string>>) onRow(rec)
  }
  rmSync(zip, { force: true }); rmSync(dir, { recursive: true, force: true })
}

async function main() {
  const valid = await loadComuneSet()

  // 1) stazioni appaltanti = comuni: CF -> comune_istat
  const cfToComune = new Map<string, { istat: string; denom: string }>()
  await streamZipCsvs(`${BASE}/stazioni-appaltanti/filesystem/stazioni-appaltanti_csv.zip`, 'sa', (r) => {
    const denom = (r.denominazione ?? '').trim()
    // Governo comunale = denominazione "COMUNE ..." + il caso speciale "ROMA CAPITALE" (Roma non si
    // chiama "Comune di Roma", L. 42/2009). Match ESATTO su ROMA CAPITALE per non catturare i decoy
    // dello stesso dataset (SUA Città Metropolitana, Azienda Mobilità, Commissario … di Roma Capitale).
    const isComune = /^COMUNE\b/i.test(denom) || /^ROMA CAPITALE$/i.test(denom)
    if (!isComune) return
    const istat = (r.citta_codice ?? '').trim()
    const cf = (r.codice_fiscale ?? '').trim()
    if (cf && valid.has(istat)) cfToComune.set(cf, { istat, denom })
  })
  console.log('comuni stazioni appaltanti:', cfToComune.size)

  // 2) cig master 2024 -> solo gare bandite da un comune
  const cigMaster = new Map<string, Record<string, unknown>>()
  const cancellati = new Set<string>()
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0')
    // un mese perso in silenzio = gare comunali che spariscono: curlToFile ritenta 3 volte, poi il throw abortisce il run
    await streamZipCsvs(`${BASE}/cig-${ANNO}/filesystem/cig_csv_${ANNO}_${mm}.zip`, `cig_${mm}`, (r) => {
      const cf = (r.cf_amministrazione_appaltante ?? '').trim()
      const c = cfToComune.get(cf)
      if (!c) return
      const cig = (r.cig ?? '').trim()
      if (!cig) return
      // CIG revocati/cancellati restano in elenco (stato=CANCELLATO + motivo/data cancellazione) -> scartati
      if ((r.stato ?? '').trim().toUpperCase() === 'CANCELLATO' || (r.DATA_CANCELLAZIONE ?? '').trim() || (r.MOTIVO_CANCELLAZIONE ?? '').trim()) {
        cancellati.add(cig); cigMaster.delete(cig); return
      }
      if (cigMaster.has(cig)) return
      cigMaster.set(cig, {
        cig, comune_istat: c.istat, stazione_appaltante: r.denominazione_amministrazione_appaltante || c.denom, cf_stazione: cf,
        importo_base: parseDotNumber(r.importo_complessivo_gara), oggetto: r.oggetto_gara || r.oggetto_lotto || null, anno: ANNO,
      })
    })
    if (m % 3 === 0) console.log(`  cig fino a ${mm}: ${cigMaster.size} gare comunali`)
  }
  const cigSet = new Set(cigMaster.keys())
  console.log('CIG comunali 2024:', cigSet.size, '| cancellati/revocati scartati:', cancellati.size)

  // 3) aggiudicazioni -> importo + esito (per i CIG raccolti). Un CIG può avere più eventi di
  // aggiudicazione (id_aggiudicazione): teniamo il più recente (id più alto; -1 = legacy/non assegnato)
  const idAgg = (r: Record<string, string>) => { const n = Number.parseInt((r.id_aggiudicazione ?? '').trim(), 10); return Number.isNaN(n) ? -1 : n }
  const agg = new Map<string, { id: number; importo: number | null; esito: string | null }>()
  await streamZipCsvs(`${BASE}/aggiudicazioni/filesystem/aggiudicazioni_csv.zip`, 'aggz', (r) => {
    const cig = (r.cig ?? '').trim()
    if (!cigSet.has(cig)) return
    const id = idAgg(r)
    const prev = agg.get(cig)
    if (prev && prev.id >= id) return
    agg.set(cig, { id, importo: parseDotNumber(r.importo_aggiudicazione), esito: r.esito || null })
  })
  console.log('aggiudicazioni trovate:', agg.size)

  // 4) aggiudicatari -> vincitore (preferenza MANDATARIA) dello STESSO evento tenuto in agg
  const win = new Map<string, { id: number; denom: string | null; cf: string | null }>()
  await streamZipCsvs(`${BASE}/aggiudicatari/filesystem/aggiudicatari_csv.zip`, 'aggr', (r) => {
    const cig = (r.cig ?? '').trim()
    if (!cigSet.has(cig)) return
    const id = idAgg(r)
    const a = agg.get(cig)
    if (a && id !== a.id) return // vincitore e importo/esito devono venire dallo stesso evento
    const prev = win.get(cig)
    // senza aggiudicazione: vince l'evento più recente; a parità di evento prima riga, salvo MANDATARIA
    if (prev && (id < prev.id || (id === prev.id && (r.ruolo ?? '').toUpperCase() !== 'MANDATARIA'))) return
    // denominazione vuota -> null (non ''), altrimenti passa i filtri `aggiudicatario is not null` a valle
    win.set(cig, { id, denom: (r.denominazione ?? '').trim() || null, cf: (r.codice_fiscale ?? '').trim() || null })
  })
  console.log('aggiudicatari trovati:', win.size)

  const fonteId = await recordFonte({
    source: SRC, dataset_id: `appalti_comuni_${ANNO}`, titolo: 'ANAC — appalti aggiudicati con stazione appaltante comunale',
    url: `${BASE}/cig-${ANNO}`, snapshot_date: SNAP, formato: 'csv-zip', license: 'CC-BY-4.0',
    latest_usable_year: ANNO, granularita: 'comune', note_path: 'notes/anac-appalti.md',
    quirks: 'SA=comune (denominazione LIKE COMUNE%); join CIG su 4 dataset; soglia ~€40k (sotto-soglia SmartCIG escluso); importo=aggiudicazione, importo_base=base gara; vincitore preferito MANDATARIA; CIG cancellati/revocati esclusi; vincitore+importo dallo stesso evento (id_aggiudicazione max); nessuno storage_path: raw zip NON snapshottati per dimensioni (151 MB-GB) — ANAC ripubblica gli stessi zip mensili a URL stabili, riscaricare da lì per riprodurre',
  })

  const rows: Record<string, unknown>[] = []
  for (const [cig, m] of cigMaster) {
    const a = agg.get(cig); const w = win.get(cig)
    if (!a && !w) continue // solo gare con esito/aggiudicatario
    rows.push({ ...m, importo: a?.importo ?? null, esito: a?.esito ?? null, aggiudicatario: w?.denom ?? null, cf_aggiudicatario: w?.cf ?? null, fonte_id: fonteId })
  }
  const n = await bulkUpsert('mart.appalto', rows,
    ['cig', 'comune_istat', 'stazione_appaltante', 'cf_stazione', 'aggiudicatario', 'cf_aggiudicatario', 'importo', 'importo_base', 'oggetto', 'anno', 'esito', 'fonte_id'],
    '(cig)', ['comune_istat', 'stazione_appaltante', 'cf_stazione', 'aggiudicatario', 'cf_aggiudicatario', 'importo', 'importo_base', 'oggetto', 'anno', 'esito', 'fonte_id'])
  console.log('appalti upserted:', n, '| con aggiudicatario:', rows.filter((r) => r.aggiudicatario).length)
  await sql.end()
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1) })
