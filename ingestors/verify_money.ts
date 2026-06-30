// Spot-check the money/governo marts for the pilot comuni.
import { sql } from './_framework/env'

const PILOTS: [string, string][] = [
  ['015146', 'Milano'], ['017029', 'Brescia'], ['016024', 'Bergamo'], ['018110', 'Pavia'], ['013075', 'Como'],
]

async function main() {
  const counts = await sql`
    select 'comuni con popolazione' t, count(*) filter (where popolazione is not null)::int n from geo.comuni
    union all select 'progetto_coesione', count(*)::int from mart.progetto_coesione
    union all select 'progetto_comune (link)', count(*)::int from mart.progetto_comune
    union all select 'amministratore_comune', count(*)::int from mart.amministratore_comune`
  console.log('=== counts ===')
  for (const r of counts) console.log(' ', String(r.t).padEnd(26), r.n)

  console.log('\n=== popolazione (ISTAT) ===')
  const pop = await sql`select codice_istat, denominazione, popolazione, popolazione_anno from geo.comuni where codice_istat in ${sql(PILOTS.map((p) => p[0]))} order by denominazione`
  for (const r of pop) console.log('  ' + r.denominazione.padEnd(10), r.popolazione, '(' + r.popolazione_anno + ')')

  console.log('\n=== fondi coesione 2021-2027 per comune ===')
  for (const [istat, name] of PILOTS) {
    const r = (await sql`
      select count(distinct pc.cod_locale)::int n, coalesce(sum(p.importo_finanziato),0)::numeric tot, coalesce(sum(p.importo_pagato),0)::numeric pag
      from mart.progetto_comune pc join mart.progetto_coesione p on p.cod_locale = pc.cod_locale
      where pc.comune_istat = ${istat}`)[0]
    console.log('  ' + name.padEnd(10), r.n, 'progetti |', 'finanziato €' + Math.round(r.tot).toLocaleString('it-IT'), '| pagato €' + Math.round(r.pag).toLocaleString('it-IT'))
  }

  console.log('\n=== chi governa (Sindaco) ===')
  for (const [istat, name] of PILOTS) {
    const s = (await sql`select cognome, nome, lista, data_elezione::text d from mart.amministratore_comune where comune_istat = ${istat} and carica = 'Sindaco' limit 1`)[0]
    const giunta = (await sql`select count(*)::int n from mart.amministratore_comune where comune_istat = ${istat}`)[0]
    console.log('  ' + name.padEnd(10), s ? `${s.cognome} ${s.nome} — ${s.lista || 'n/d'} (eletto ${s.d})` : 'n/d', `| ${giunta.n} amministratori`)
  }

  console.log('\n=== bilancio per missione (impegni 2024) ===')
  for (const [istat, name] of PILOTS.slice(0, 3)) {
    const r = await sql`select missione_cod, missione_desc, impegni from mart.bilancio_comune where comune_istat = ${istat} and anno = 2024 and missione_cod in ('04', '12') order by missione_cod`
    console.log('  ' + name.padEnd(10), r.map((x) => `M${x.missione_cod} ${(x.missione_desc || '').split(' ')[0]}=€${Math.round(x.impegni).toLocaleString('it-IT')}`).join(' | '))
  }

  console.log('\n=== PNRR per comune ===')
  for (const [istat, name] of PILOTS) {
    const r = (await sql`
      select count(distinct p.progetto_id)::int n, coalesce(sum(p.importo_pnrr),0)::numeric tot
      from mart.pnrr_progetto_comune pc join mart.pnrr_progetto p on p.progetto_id = pc.progetto_id
      where pc.comune_istat = ${istat}`)[0]
    console.log('  ' + name.padEnd(10), r.n, 'progetti PNRR | €' + Math.round(r.tot).toLocaleString('it-IT'), '(multi-comune non ripartito)')
  }
  await sql.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
