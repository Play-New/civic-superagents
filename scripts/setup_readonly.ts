// Creates a read-only Postgres role bundle (civic_readonly) + a login role (civic_serve) for the MCP
// serving layer, then verifies reads work and writes are BLOCKED, and writes SUPABASE_DB_URL_READONLY to .env.
// Run once after schema changes: npm run setup:readonly
import 'dotenv/config'
import postgres from 'postgres'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const adminUrl = process.env.SUPABASE_DB_URL
const ref = process.env.SUPABASE_PROJECT_REF
if (!adminUrl || !ref) throw new Error('Missing SUPABASE_DB_URL / SUPABASE_PROJECT_REF in .env')

const pw = randomBytes(20).toString('hex')
const sql = postgres(adminUrl, { prepare: false })

// 1) read-only privilege bundle
await sql.unsafe(`do $$ begin if not exists (select 1 from pg_roles where rolname='civic_readonly') then create role civic_readonly nologin; end if; end $$;`)
for (const sch of ['geo', 'meta', 'glossary', 'mart']) {
  await sql.unsafe(`grant usage on schema ${sch} to civic_readonly`)
  await sql.unsafe(`grant select on all tables in schema ${sch} to civic_readonly`)
  await sql.unsafe(`alter default privileges in schema ${sch} grant select on tables to civic_readonly`)
}
// 2) login role for the serving layer
await sql.unsafe(`do $$ begin
  if exists (select 1 from pg_roles where rolname='civic_serve') then alter role civic_serve login password '${pw}';
  else create role civic_serve login password '${pw}'; end if; end $$;`)
await sql.unsafe(`grant civic_readonly to civic_serve`)
// le 2 tabelle di revisione: scrittura SOLO qui (i tool firma_risposta / verifica_licenza)
await sql.unsafe(`grant insert, update on meta.test_question, meta.source_license_review to civic_serve`)
await sql.end()

// host:porta dallo split sull'ULTIMO '@' (la password può contenere '@')
const bare = adminUrl.replace(/^postgres(ql)?:\/\//, '')
const at = bare.lastIndexOf('@')
if (at < 0) throw new Error('SUPABASE_DB_URL senza credenziali user:password@host')
const hm = bare.slice(at + 1).match(/^([^:/?]+)(?::(\d+))?/)
if (!hm) throw new Error('Host non riconosciuto in SUPABASE_DB_URL')
const host = hm[1], port = hm[2] ?? '5432'
// Connessione diretta (db.<ref>.supabase.co) → ruolo semplice; Supavisor pooler → tenant username civic_serve.<ref>
const adminUser = decodeURIComponent(bare.slice(0, at).split(':')[0])
const roUser = host.endsWith('.pooler.supabase.com')
  ? `civic_serve.${adminUser.includes('.') ? adminUser.split('.')[1] : ref}`
  : 'civic_serve'
const roUrl = `postgresql://${roUser}:${pw}@${host}:${port}/postgres`

// 3) verify con retry (Supavisor può ritardare il refresh della password dopo ALTER ROLE)
let n = 0, blocked = false, review = false
for (let i = 1; ; i++) {
  try {
    const ro = postgres(roUrl, { prepare: false })
    n = (await ro<{ n: number }[]>`select count(*)::int n from geo.comuni`)[0].n
    try { await ro`insert into mart.cer_comune (comune_istat, fonte_id) values ('000000', 1)` } catch { blocked = true }
    // prova l'INSERT senza persistere: civic_serve non ha DELETE, quindi transazione + rollback forzato
    try {
      await ro.begin(async (tx) => {
        await tx`insert into meta.test_question (id) values ('__perm__') on conflict (id) do nothing`
        review = true
        throw new Error('rollback voluto')
      })
    } catch { /* rollback atteso; review resta false solo se l'insert è fallito */ }
    await ro.end()
    break
  } catch (e) {
    if (i >= 6) throw e
    console.log(`  pooler non ancora pronto, retry ${i}...`)
    await new Promise((r) => setTimeout(r, 5000))
  }
}

// 4) persist .env SOLO dopo la verifica: un run fallito non lascia una SUPABASE_DB_URL_READONLY rotta
let env = readFileSync('.env', 'utf8')
const line = 'SUPABASE_DB_URL_READONLY=' + roUrl
env = /SUPABASE_DB_URL_READONLY=/.test(env) ? env.replace(/SUPABASE_DB_URL_READONLY=.*/, () => line) : env.trimEnd() + '\n' + line + '\n'
writeFileSync('.env', env)

console.log(`read-only ok | comuni ${n} | write mart bloccato ${blocked} (atteso true) | write review ${review} (atteso true) | .env aggiornato`)
