import 'dotenv/config'
import postgres from 'postgres'
import { createClient } from '@supabase/supabase-js'

function need(k: string): string {
  const v = process.env[k]
  if (!v) throw new Error(`Missing env ${k} — copy .env.example to .env and fill it`)
  return v
}

export const SUPABASE_URL = need('SUPABASE_URL')
export const SERVICE_KEY = need('SUPABASE_SERVICE_ROLE_KEY')
export const DB_URL = need('SUPABASE_DB_URL')
export const RAW_BUCKET = 'raw'

// Data snapshot della run (YYYY-MM-DD, UTC): default oggi, override con SNAP= per ri-registrare una data specifica.
export const SNAP = process.env.SNAP || new Date().toISOString().slice(0, 10)

// postgres.js. prepare:false keeps it friendly to the Supabase poolers.
export const sql = postgres(DB_URL, { prepare: false, idle_timeout: 20, max: 5 })

// supabase-js used ONLY for Storage (HTTPS, always reachable). DB writes go via `sql`.
export const storage = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
}).storage
