// Acceptance check: compute the pilot-question answers straight from the mart tables.
import { sql } from './_framework/env'

async function main() {
  const counts = await sql`
    select 'idrogeo_comune' t, count(*)::int n from mart.idrogeo_comune
    union all select 'rifiuti_comune_anno', count(*)::int from mart.rifiuti_comune_anno
    union all select 'consumo_suolo_comune', count(*)::int from mart.consumo_suolo_comune
    union all select 'aria_misure', count(*)::int from mart.aria_misure
    union all select 'scuola_edificio', count(*)::int from mart.scuola_edificio
    union all select 'glossary.sensore_comune', count(*)::int from glossary.sensore_comune
    order by t`
  console.log('=== mart row counts ===')
  for (const r of counts) console.log(' ', r.t.padEnd(24), r.n)

  console.log('\n=== pilot question answers (from data) ===')

  const q5 = (await sql`select pop_esposta_frane, area_pericolosita_frane_pct from mart.idrogeo_comune where comune_istat='014061'`)[0]
  console.log('Q05 Sondrio — pop esposta frane (P3+P4):', q5?.pop_esposta_frane, '| % area:', q5?.area_pericolosita_frane_pct)

  const q6 = (await sql`select pop_esposta_alluvioni, area_pericolosita_alluvioni_pct from mart.idrogeo_comune where comune_istat='018110'`)[0]
  console.log('Q06 Pavia — pop esposta alluvioni (P3):', q6?.pop_esposta_alluvioni, '| % area:', q6?.area_pericolosita_alluvioni_pct)

  const q1 = await sql`select anno, rd_pct, procapite_kg from mart.rifiuti_comune_anno where comune_istat='017029' order by anno`
  console.log('Q01 Brescia — RD% e procapite per anno:')
  for (const r of q1) console.log('   ', r.anno, 'RD%=' + r.rd_pct, 'kg/ab=' + r.procapite_kg)

  const q7 = (await sql`select suolo_consumato_ha, suolo_consumato_pct, incremento_ha from mart.consumo_suolo_comune where comune_istat='016024'`)[0]
  const avg = (await sql`select round(avg(suolo_consumato_pct)::numeric,2) a from mart.consumo_suolo_comune cs join geo.comuni g on g.codice_istat=cs.comune_istat where g.denominazione_regione='Lombardia'`)[0]
  console.log('Q07 Bergamo — suolo consumato:', q7?.suolo_consumato_ha, 'ha (' + q7?.suolo_consumato_pct + '%), incr 23-24:', q7?.incremento_ha, 'ha | media Lombardia:', avg?.a + '%')

  const q3 = (await sql`
    with daily as (
      select data, max(valore) v from mart.aria_misure
      where comune_istat='015146' and inquinante='PM10' and data >= '2024-01-01' and data < '2025-01-01'
      group by data)
    select count(*) filter (where v > 50)::int sforamenti, count(*)::int giorni_misurati from daily`)[0]
  console.log('Q03 Milano — giorni sforamento PM10>50 nel 2024:', q3?.sforamenti, '/', q3?.giorni_misurati, 'giorni misurati')

  const q9 = (await sql`select count(*)::int edifici,
      count(*) filter (where certificato_antincendio)::int cpi_si,
      count(*) filter (where certificato_antincendio is false)::int cpi_no
    from mart.scuola_edificio where comune_istat='012133'`)[0]
  const q9z = await sql`select zona_sismica, count(*)::int n from mart.scuola_edificio where comune_istat='012133' group by zona_sismica order by zona_sismica`
  console.log('Q09 Varese — edifici:', q9?.edifici, '| CPI si/no:', q9?.cpi_si + '/' + q9?.cpi_no, '| zona sismica:', q9z.map((r) => (r.zona_sismica ?? 'n/d') + '→' + r.n).join(' '))

  const q10 = (await sql`select count(*) filter (where agibilita)::int si, count(*) filter (where agibilita is false)::int no, count(*) filter (where agibilita is null)::int nd from mart.scuola_edificio where comune_istat='019036'`)[0]
  console.log('Q10 Cremona — agibilità SI/NO/n.d.:', q10?.si + '/' + q10?.no + '/' + q10?.nd)

  await sql.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
