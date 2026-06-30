import 'dotenv/config'
import postgres from 'postgres'

// Serving layer connects read-only: prefers the civic_serve role (SELECT-only, writes blocked)
// created by `npm run setup:readonly`; falls back to the admin URL for local dev.
const url = process.env.SUPABASE_DB_URL_READONLY || process.env.SUPABASE_DB_URL
if (!url) throw new Error('Missing SUPABASE_DB_URL_READONLY / SUPABASE_DB_URL in .env')

export const sql = postgres(url, { prepare: false, idle_timeout: 20, max: 5 })
