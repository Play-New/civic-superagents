import { sql } from './env'

// Smoke test: confirms the SUPABASE_DB_URL in .env actually connects.
const r = await sql<{ ok: number; postgis: string | null }[]>`
  select 1 as ok, extversion as postgis
  from pg_extension where extname = 'postgis'
  union all select 1, null limit 1`
console.log('db ok:', r[0].ok, '| postgis:', r[0].postgis ?? '(checking)')
await sql.end()
