// Semina meta.test_question (da tests/questions.jsonl) e meta.source_license_review (da meta.fonti).
// Idempotente: NON sovrascrive le firme umane (stato/verificatore) già presenti.
import 'dotenv/config'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sql = postgres(process.env.SUPABASE_DB_URL!, { prepare: false }) // admin: lo script semina (write)

async function main() {
  const lines = readFileSync(join(root, 'tests/questions.jsonl'), 'utf8').split('\n').filter((l) => l.trim())
  for (const l of lines) {
    const q = JSON.parse(l)
    await sql`insert into meta.test_question (id, tema, domanda, comune, codice_istat, risposta, fonti, stato, verificatore, data_verifica)
      values (${q.id}, ${q.tema ?? null}, ${q.domanda ?? null}, ${q.comune ?? null}, ${q.codice_istat ?? null}, ${q.risposta ?? null}, ${sql.json(q.fonti ?? [])}, ${q.stato ?? 'auto'}, ${q.verificatore ?? null}, ${q.data_verifica ?? null})
      on conflict (id) do update set tema=excluded.tema, domanda=excluded.domanda, comune=excluded.comune, codice_istat=excluded.codice_istat, risposta=excluded.risposta, fonti=excluded.fonti`
  }

  const fonti = await sql<{ source: string; license: string | null }[]>`select source, mode() within group (order by license) license from meta.fonti group by source`
  for (const f of fonti) {
    const dubbia = !f.license || /verific|non verific/i.test(f.license)
    await sql`insert into meta.source_license_review (source, license_dichiarata, stato)
      values (${f.source}, ${f.license}, ${dubbia ? 'da_verificare' : 'verificata'})
      on conflict (source) do update set license_dichiarata=excluded.license_dichiarata`
  }
  console.log('seed: test_question', lines.length, '| source_license_review', fonti.length)
  await sql.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
