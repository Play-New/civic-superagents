// Semina meta.test_question (da tests/questions.jsonl) e meta.source_license_review (da meta.fonti).
// Idempotente: aggiorna solo le righe con stato 'auto'/'da_verificare'; le righe già firmate
// (verificato/corretto/scartato — vedi mcp/review.ts) restano intatte.
// Licenze: il seeder non marca MAI 'verificata' — ogni coppia (source, licenza) nasce 'da_verificare'
// e solo la firma umana (verificaLicenza in mcp/review.ts) la promuove; se la licenza dichiarata cambia,
// la fonte torna in coda.
import 'dotenv/config'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sql = postgres(process.env.SUPABASE_DB_URL!, { prepare: false }) // admin: lo script semina (write)

async function main() {
  const lines = readFileSync(join(root, 'tests/questions.jsonl'), 'utf8').split('\n').filter((l) => l.trim())
  let scritte = 0
  for (const l of lines) {
    const q = JSON.parse(l)
    const r = await sql`insert into meta.test_question (id, tema, domanda, comune, codice_istat, risposta, fonti, stato, verificatore, data_verifica)
      values (${q.id}, ${q.tema ?? null}, ${q.domanda ?? null}, ${q.comune ?? null}, ${q.codice_istat ?? null}, ${q.risposta ?? null}, ${sql.json(q.fonti ?? [])}, ${q.stato ?? 'auto'}, ${q.verificatore ?? null}, ${q.data_verifica ?? null})
      on conflict (id) do update set tema=excluded.tema, domanda=excluded.domanda, comune=excluded.comune, codice_istat=excluded.codice_istat, risposta=excluded.risposta, fonti=excluded.fonti
      where test_question.stato in ('auto', 'da_verificare')`
    scritte += r.count
  }

  const fonti = await sql<{ source: string; license: string | null }[]>`select source, mode() within group (order by license) license from meta.fonti group by source`
  for (const f of fonti) {
    // nessuno sniffing sulla stringa: resta 'verificata' SOLO la coppia (source, licenza) già firmata identica
    await sql`insert into meta.source_license_review (source, license_dichiarata, stato)
      values (${f.source}, ${f.license}, 'da_verificare')
      on conflict (source) do update set
        license_dichiarata = excluded.license_dichiarata,
        stato = case when source_license_review.stato = 'verificata'
                      and source_license_review.license_dichiarata is not distinct from excluded.license_dichiarata
                     then 'verificata' else 'da_verificare' end`
  }
  console.log('seed: test_question', scritte, 'scritte,', lines.length - scritte, 'saltate (già firmate)', '| source_license_review', fonti.length)
  await sql.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
