// Dump the full leggi_comune profile JSON for one comune (name or 6-digit ISTAT code).
// Usage: npx tsx scripts/profile.ts "Ragusa"   |   npx tsx scripts/profile.ts 088009
import { leggiComune, resolveComune } from '../mcp/queries'
import { sql } from '../mcp/db'

const arg = (process.argv[2] ?? '').trim()
if (!arg) { console.error('uso: tsx scripts/profile.ts <nome|codice_istat>'); process.exit(1) }
const id = /^\d{6}$/.test(arg) ? arg : await resolveComune(arg)
console.log(JSON.stringify(id ? await leggiComune(id) : { errore: 'comune non trovato: ' + arg }, null, 2))
await sql.end()
