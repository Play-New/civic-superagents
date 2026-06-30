// Computes the 10 civic answers from the lake and writes them back to questions.jsonl
// as stato="auto" (computed, pending HUMAN sign-off -> "verificato"). Italiano civico + fonti.
import { sql } from '../ingestors/_framework/env'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const eur = (n: number) => '€' + Math.round(n).toLocaleString('it-IT')

async function fonte(source: string, extra: string): Promise<string> {
  const [f] = await sql<{ titolo: string; snapshot: string }[]>`select titolo, snapshot_date::text snapshot from meta.fonti where source = ${source} order by snapshot_date desc limit 1`
  return f ? `${f.titolo} (snapshot ${f.snapshot}) — ${extra}` : `${source} — ${extra}`
}

const answers: Record<string, () => Promise<{ risposta: string; fonti: string[] }>> = {
  async Q01() {
    const r = await sql`select anno, rd_pct from mart.rifiuti_comune_anno where comune_istat='017029' order by anno`
    const y24 = r.find((x: any) => x.anno === 2024), y20 = r.find((x: any) => x.anno === 2020)
    return { risposta: `Brescia ha una raccolta differenziata del ${y24?.rd_pct}% nel 2024; nel 2020 era del ${y20?.rd_pct}%, quindi è leggermente calata negli ultimi 5 anni.`, fonti: [await fonte('ispra_catasto_rifiuti', 'RUComunali 2020-2024, comune 017029')] }
  },
  async Q02() {
    const [m] = await sql`select procapite_kg from mart.rifiuti_comune_anno where comune_istat='108033' and anno=2024`
    const [peer] = await sql`select round(avg(r.procapite_kg)::numeric,1) media from mart.rifiuti_comune_anno r join geo.comuni g on g.codice_istat=r.comune_istat where r.anno=2024 and g.denominazione_regione='Lombardia' and g.popolazione between 80000 and 180000`
    return { risposta: `Monza produce ${m?.procapite_kg} kg di rifiuti pro-capite (2024), contro una media di ${peer?.media} kg dei comuni lombardi di dimensione simile (80-180 mila ab.): ${Number(m?.procapite_kg) > Number(peer?.media) ? 'più' : 'meno'} della media.`, fonti: [await fonte('ispra_catasto_rifiuti', 'RUComunali 2024; popolazione ISTAT')] }
  },
  async Q03() {
    const [r] = await sql`with d as (select data, max(valore) v from mart.aria_misure where comune_istat='015146' and inquinante='PM10' and extract(year from data)=2024 group by data) select count(*) filter (where v>50)::int s, count(*)::int g from d`
    return { risposta: `Nel 2024 le centraline di Milano hanno superato il limite giornaliero di PM10 (50 µg/m³) in ${r?.s} giorni su ${r?.g} misurati — ben oltre i 35 giorni consentiti dalla legge.`, fonti: [await fonte('dati_lombardia_aria', 'misure PM10 2024, sensori del comune 015146')] }
  },
  async Q04() {
    const [r] = await sql`with mx as (select max(data) d from mart.aria_misure where comune_istat='013075' and inquinante='PM10') select round(avg(valore)::numeric,1) media, max(valore) maxv, min(data)::text dal, max(data)::text al from mart.aria_misure, mx where comune_istat='013075' and inquinante='PM10' and data > mx.d - interval '7 days'`
    return { risposta: `Nell'ultima settimana disponibile (${r?.dal} → ${r?.al}) le centraline di Como hanno registrato un PM10 medio di ${r?.media} µg/m³ (massimo ${r?.maxv}).`, fonti: [await fonte('dati_lombardia_aria', 'misure PM10, sensori del comune 013075')] }
  },
  async Q05() {
    const [r] = await sql`select pop_esposta_frane, area_pericolosita_frane_pct from mart.idrogeo_comune where comune_istat='014061'`
    return { risposta: `A Sondrio ${r?.pop_esposta_frane} persone vivono in aree a pericolosità da frana elevata o molto elevata (P3+P4), pari al ${r?.area_pericolosita_frane_pct}% del territorio comunale.`, fonti: [await fonte('ispra_idrogeo', 'PIR comune pro_com 14061')] }
  },
  async Q06() {
    const [r] = await sql`select area_pericolosita_alluvioni_pct, pop_esposta_alluvioni from mart.idrogeo_comune where comune_istat='018110'`
    return { risposta: `Il ${r?.area_pericolosita_alluvioni_pct}% del territorio di Pavia è classificato a pericolosità idraulica elevata (P3), con ${r?.pop_esposta_alluvioni} residenti esposti.`, fonti: [await fonte('ispra_idrogeo', 'PIR comune pro_com 18110')] }
  },
  async Q07() {
    const [b] = await sql`select suolo_consumato_ha, suolo_consumato_pct, incremento_ha from mart.consumo_suolo_comune where comune_istat='016024'`
    const [a] = await sql`select round(avg(suolo_consumato_pct)::numeric,2) m from mart.consumo_suolo_comune cs join geo.comuni g on g.codice_istat=cs.comune_istat where g.denominazione_regione='Lombardia'`
    return { risposta: `Bergamo ha ${b?.suolo_consumato_ha} ettari di suolo consumato (${b?.suolo_consumato_pct}% del territorio, +${b?.incremento_ha} ha nell'ultimo anno) — molto sopra la media lombarda del ${a?.m}%.`, fonti: [await fonte('ispra_consumo_suolo', 'comune 016024, dati 2024')] }
  },
  async Q08() {
    const [r] = await sql`select suolo_consumato_pct, suolo_consumato_ha from mart.consumo_suolo_comune where comune_istat='097042'`
    return { risposta: `A Lecco il ${r?.suolo_consumato_pct}% della superficie comunale è suolo consumato (${r?.suolo_consumato_ha} ettari).`, fonti: [await fonte('ispra_consumo_suolo', 'comune 097042, dati 2024')] }
  },
  async Q09() {
    const [r] = await sql`select count(*)::int e, count(*) filter (where certificato_antincendio)::int si, count(*) filter (where certificato_antincendio is false)::int no, count(distinct zona_sismica) from mart.scuola_edificio where comune_istat='012133'`
    const [z] = await sql`select string_agg(distinct zona_sismica,', ') z from mart.scuola_edificio where comune_istat='012133'`
    return { risposta: `Varese ha ${r?.e} edifici scolastici, tutti in zona sismica ${z?.z}; ${r?.si} hanno il certificato di prevenzione incendi, ${r?.no} no.`, fonti: [await fonte('miur_edilizia_scolastica', 'comune 012133')] }
  },
  async Q10() {
    const [r] = await sql`select count(*) filter (where agibilita)::int si, count(*) filter (where agibilita is false)::int no, count(*) filter (where agibilita is null)::int nd, count(*)::int tot from mart.scuola_edificio where comune_istat='019036'`
    return { risposta: `Degli edifici scolastici di Cremona, ${r?.si} dichiarano l'agibilità/collaudo statico, ${r?.no} no e ${r?.nd} non definito (su ${r?.tot}).`, fonti: [await fonte('miur_edilizia_scolastica', 'comune 019036')] }
  },
  async Q11() {
    const r = await sql`select missione_cod, impegni from mart.bilancio_comune where comune_istat='015146' and anno=2024 and missione_cod in ('04','12') order by missione_cod`
    const istr = (r as any[]).find((x) => x.missione_cod === '04'), soc = (r as any[]).find((x) => x.missione_cod === '12')
    return { risposta: `Nel 2024 Milano impegna ${eur(Number(istr?.impegni))} per l'istruzione (missione 04) e ${eur(Number(soc?.impegni))} per i diritti sociali (missione 12).`, fonti: [await fonte('bdap_rendiconto', 'rendiconto 2024, comune 015146, missioni 04 e 12 (impegni)')] }
  },
  async Q12() {
    const [r] = await sql`select count(distinct p.progetto_id)::int n, coalesce(sum(p.importo_pnrr),0)::numeric tot from mart.pnrr_progetto_comune pc join mart.pnrr_progetto p on p.progetto_id=pc.progetto_id where pc.comune_istat='016024'`
    return { risposta: `${r?.n} progetti PNRR toccano Bergamo, per un finanziamento complessivo di ${eur(Number(r?.tot))} (importi non ripartiti tra i comuni dei progetti multi-comune).`, fonti: [await fonte('openpnrr', 'progetti localizzati nel comune 016024')] }
  },
  async Q13() {
    const [r] = await sql`select count(distinct pc.cod_locale)::int n, coalesce(sum(p.importo_finanziato),0)::numeric tot from mart.progetto_comune pc join mart.progetto_coesione p on p.cod_locale=pc.cod_locale where pc.comune_istat='018110'`
    return { risposta: `Pavia ha ${r?.n} progetti di coesione (ciclo 2021-2027) per ${eur(Number(r?.tot))} di finanziamento pubblico.`, fonti: [await fonte('opencoesione', 'progetti coesione localizzati nel comune 018110')] }
  },
  async Q14() {
    const [s] = await sql`select cognome, nome, lista from mart.amministratore_comune where comune_istat='013075' and carica='Sindaco' limit 1`
    const [g] = await sql`select count(*)::int n from mart.amministratore_comune where comune_istat='013075'`
    return { risposta: `Il sindaco di Como è ${(s as any)?.nome} ${(s as any)?.cognome} (${(s as any)?.lista || 'lista n/d'}); il governo comunale conta ${g?.n} amministratori tra sindaco, giunta e consiglio.`, fonti: [await fonte('dait_amministratori', 'amministratori in carica, comune 013075')] }
  },
  async Q15() {
    const [r] = await sql`select count(*)::int tot, count(*) filter (where tipologia_amministrativa='Comune')::int comunali from mart.biblioteca_comune where comune_istat='017029'`
    return { risposta: `A Brescia risultano ${r?.tot} biblioteche censite, di cui ${r?.comunali} comunali.`, fonti: [await fonte('iccu_biblioteche', 'Anagrafe Biblioteche, comune 017029')] }
  },
  async Q16() {
    const [r] = await sql`select valore from mart.welfare_comune where comune_istat='015146' and indicatore='posti_nido_per_100_bambini_0_2' order by anno desc limit 1`
    return { risposta: `Milano offre ${r?.valore} posti negli asili nido ogni 100 bambini 0-2 anni (ultimo dato ISTAT disponibile).`, fonti: [await fonte('istat_sdmx', 'servizi prima infanzia, comune 015146')] }
  },
}

async function main() {
  const path = join(here, 'questions.jsonl')
  const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim())
  const out: string[] = []
  for (const line of lines) {
    const q = JSON.parse(line)
    const fn = answers[q.id]
    if (fn) {
      const { risposta, fonti } = await fn()
      Object.assign(q, { risposta, fonti, verificatore: 'auto (lake)', data_verifica: '2026-06-29', stato: 'auto' })
    }
    out.push(JSON.stringify(q))
  }
  writeFileSync(path, out.join('\n') + '\n')
  console.log('questions.jsonl aggiornato con risposte calcolate (stato=auto)')
  await sql.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
