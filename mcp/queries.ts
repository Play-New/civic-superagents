import { sql } from './db'

export async function cercaComune(nome: string) {
  const q = nome.trim()
  return sql`
    select codice_istat, denominazione, denominazione_provincia, sigla_provincia, denominazione_regione, popolazione
    from geo.comuni
    where lower(denominazione) = lower(${q}) or lower(denominazione) like lower(${q}) || '%'
    order by (lower(denominazione) = lower(${q})) desc, popolazione desc nulls last
    limit 10`
}

export async function resolveComune(input: string): Promise<string | null> {
  const t = input.trim()
  if (/^\d{6}$/.test(t)) {
    const r = await sql`select codice_istat from geo.comuni where codice_istat = ${t}`
    return r.length ? t : null
  }
  const r = await cercaComune(t)
  return r.length ? (r[0] as { codice_istat: string }).codice_istat : null
}

// Peer-similarity ("gemelli"): comuni nella stessa classe demografica (Art.156 TUEL) e regione;
// fallback nazionale se la regione ha pochi pari. Confronta le metriche-chiave alla mediana dei gemelli.
export async function gemelliComune(istat: string) {
  const [m] = await sql<{ classe: number; reg: string }[]>`select geo.classe_demografica(popolazione) classe, denominazione_regione reg from geo.comuni where codice_istat = ${istat}`
  if (!m?.classe) return null
  let criterio = `classe demografica ${m.classe} · regione ${m.reg}`
  let peers = (await sql<{ codice_istat: string }[]>`select codice_istat from geo.comuni where denominazione_regione = ${m.reg} and geo.classe_demografica(popolazione) = ${m.classe} and codice_istat <> ${istat}`).map((r) => r.codice_istat)
  if (peers.length < 5) {
    criterio = `classe demografica ${m.classe} · nazionale`
    peers = (await sql<{ codice_istat: string }[]>`select codice_istat from geo.comuni where geo.classe_demografica(popolazione) = ${m.classe} and codice_istat <> ${istat}`).map((r) => r.codice_istat)
  }
  const [cls] = await sql<{ etichetta: string }[]>`select etichetta from glossary.classe_demografica where classe = ${m.classe}`
  if (peers.length === 0) return { classe: m.classe, etichetta: cls?.etichetta, criterio, n_gemelli: 0, confronti: [] }

  const cmp = async (metrica: string, unita: string, valQ: Promise<{ v: number | null }[]>, medQ: Promise<{ m: number | null }[]>) => {
    const v = (await valQ)[0]?.v
    const med = (await medQ)[0]?.m
    if (v == null || med == null) return null
    const diff = Number(med) ? Math.round((Number(v) / Number(med) - 1) * 100) : null
    return { metrica, unita, valore: Math.round(Number(v) * 100) / 100, mediana_gemelli: Math.round(Number(med) * 100) / 100, scostamento_pct: diff, verdetto: diff == null ? null : diff > 0 ? 'sopra i gemelli' : 'sotto i gemelli' }
  }

  const confronti = (await Promise.all([
    cmp('rifiuti pro-capite', 'kg/ab',
      sql`select procapite_kg v from mart.rifiuti_comune_anno where comune_istat = ${istat} and anno = 2024`,
      sql`select percentile_cont(0.5) within group (order by procapite_kg) m from mart.rifiuti_comune_anno where anno = 2024 and comune_istat = any(${peers})`),
    cmp('raccolta differenziata', '%',
      sql`select rd_pct v from mart.rifiuti_comune_anno where comune_istat = ${istat} and anno = 2024`,
      sql`select percentile_cont(0.5) within group (order by rd_pct) m from mart.rifiuti_comune_anno where anno = 2024 and comune_istat = any(${peers})`),
    cmp('consumo di suolo', '%',
      sql`select suolo_consumato_pct v from mart.consumo_suolo_comune where comune_istat = ${istat}`,
      sql`select percentile_cont(0.5) within group (order by suolo_consumato_pct) m from mart.consumo_suolo_comune where comune_istat = any(${peers})`),
    cmp('spesa comunale pro-capite (impegni 2024)', '€/ab',
      sql`select sum(b.impegni)/nullif(g.popolazione,0) v from mart.bilancio_comune b join geo.comuni g on g.codice_istat=b.comune_istat where b.comune_istat = ${istat} and b.anno=2024 group by g.popolazione`,
      sql`select percentile_cont(0.5) within group (order by pc) m from (select sum(b.impegni)/nullif(g.popolazione,0) pc from mart.bilancio_comune b join geo.comuni g on g.codice_istat=b.comune_istat where b.comune_istat = any(${peers}) and b.anno=2024 group by b.comune_istat, g.popolazione) t`),
  ])).filter(Boolean)

  return { classe: m.classe, etichetta: cls?.etichetta, criterio, n_gemelli: peers.length, confronti }
}

// Full civic profile, comune-keyed, every figure backed by a meta.fonti reference.
export async function leggiComune(istat: string) {
  const [anag] = await sql`
    select codice_istat, denominazione, denominazione_provincia, sigla_provincia, denominazione_regione, popolazione, popolazione_anno
    from geo.comuni where codice_istat = ${istat}`
  if (!anag) return null

  const [idrogeo] = await sql`
    select pop_esposta_frane, pop_esposta_alluvioni, area_pericolosita_frane_pct, area_pericolosita_alluvioni_pct
    from mart.idrogeo_comune where comune_istat = ${istat}`
  const [rifiuti] = await sql`select anno, rd_pct, procapite_kg from mart.rifiuti_comune_anno where comune_istat = ${istat} order by anno desc limit 1`
  const [consumo_suolo] = await sql`select anno, suolo_consumato_ha, suolo_consumato_pct from mart.consumo_suolo_comune where comune_istat = ${istat} order by anno desc limit 1`
  const [scuola] = await sql`
    select count(*)::int edifici,
      count(*) filter (where certificato_antincendio)::int con_antincendio,
      count(*) filter (where certificato_antincendio is false)::int senza_antincendio
    from mart.scuola_edificio where comune_istat = ${istat}`

  // aria PM10: sintesi annuale NAZIONALE (EEA) — copre i comuni con almeno una stazione di monitoraggio
  const [aria] = await sql`select anno, n_stazioni, media_annua, giorni_sforamento_max from mart.aria_comune_anno where comune_istat = ${istat} and inquinante = 'PM10' order by anno desc limit 1`

  const bilAnno = (await sql`select max(anno) a from mart.bilancio_comune where comune_istat = ${istat}`)[0]?.a as number | null
  const top_missioni = bilAnno
    ? await sql`select missione_cod, missione_desc, impegni from mart.bilancio_comune where comune_istat = ${istat} and anno = ${bilAnno} and impegni is not null order by impegni desc limit 6`
    : []
  const [bilTot] = bilAnno
    ? await sql`select sum(impegni)::numeric tot from mart.bilancio_comune where comune_istat = ${istat} and anno = ${bilAnno}`
    : [{ tot: null }]

  const [coesione] = await sql`
    select count(distinct pc.cod_locale)::int n_progetti, coalesce(sum(p.importo_finanziato),0)::numeric finanziato
    from mart.progetto_comune pc join mart.progetto_coesione p on p.cod_locale = pc.cod_locale where pc.comune_istat = ${istat}`
  const [pnrr] = await sql`
    select count(distinct p.progetto_id)::int n_progetti, coalesce(sum(p.importo_pnrr),0)::numeric finanziato
    from mart.pnrr_progetto_comune pc join mart.pnrr_progetto p on p.progetto_id = pc.progetto_id where pc.comune_istat = ${istat}`

  const [sindaco] = await sql`select cognome, nome, lista, data_elezione::text data_elezione from mart.amministratore_comune where comune_istat = ${istat} and carica = 'Sindaco' limit 1`
  const [giunta] = await sql`select count(*)::int n from mart.amministratore_comune where comune_istat = ${istat}`
  const gemelli = await gemelliComune(istat)

  const [appalti] = await sql`select count(*)::int n, coalesce(sum(importo),0)::numeric tot from mart.appalto where comune_istat = ${istat} and aggiudicatario is not null`
  const top_aggiudicatari = await sql`select aggiudicatario, count(*)::int n_appalti, round(sum(importo)::numeric,0) importo from mart.appalto where comune_istat = ${istat} and aggiudicatario is not null group by aggiudicatario order by importo desc nulls last limit 3`

  const [biblioteche] = await sql`
    select count(*)::int totale,
      count(*) filter (where tipologia_amministrativa = 'Comune')::int comunali,
      count(*) filter (where tipologia_funzionale = 'Pubblica')::int pubbliche
    from mart.biblioteca_comune where comune_istat = ${istat}`
  const acque_balneazione = await sql`
    select sito_id, classe_qualita, anno from mart.balneazione_sito
    where comune_istat = ${istat} and anno = (select max(anno) from mart.balneazione_sito where comune_istat = ${istat})
    order by sito_id`

  const [energia] = await sql`select n_configurazioni, n_impianti, potenza_kw from mart.cer_comune where comune_istat = ${istat}`
  const welfare = await sql`
    select indicatore, valore, anno from mart.welfare_comune
    where comune_istat = ${istat} and anno = (select max(anno) from mart.welfare_comune where comune_istat = ${istat})`

  // Fonti citabili: ESATTAMENTE le righe meta.fonti che reggono i dati mostrati per QUESTO comune,
  // raccolte via il fonte_id region/anno-specifico di ogni mart (es. BDAP → la regione giusta, non
  // una fissa). Niente fonti irrilevanti (es. aria Lombardia o GSE dove non c'è CER) né di regione sbagliata.
  const fonti = await sql`
    select source, titolo, url, snapshot_date::text snapshot, license, note_path
    from meta.fonti where id in (
      select fonte_id from mart.idrogeo_comune where comune_istat = ${istat} and fonte_id is not null
      union select fonte_id from mart.consumo_suolo_comune where comune_istat = ${istat} and fonte_id is not null
      union select fonte_id from mart.scuola_edificio where comune_istat = ${istat} and fonte_id is not null
      union select fonte_id from mart.aria_comune_anno where comune_istat = ${istat} and inquinante = 'PM10' and fonte_id is not null
      union select fonte_id from mart.rifiuti_comune_anno where comune_istat = ${istat} and anno = (select max(anno) from mart.rifiuti_comune_anno where comune_istat = ${istat}) and fonte_id is not null
      union select fonte_id from mart.bilancio_comune where comune_istat = ${istat} and anno = (select max(anno) from mart.bilancio_comune where comune_istat = ${istat}) and fonte_id is not null
      union select fonte_id from mart.amministratore_comune where comune_istat = ${istat} and fonte_id is not null
      union select fonte_id from mart.appalto where comune_istat = ${istat} and fonte_id is not null
      union select fonte_id from mart.biblioteca_comune where comune_istat = ${istat} and fonte_id is not null
      union select fonte_id from mart.balneazione_sito where comune_istat = ${istat} and fonte_id is not null
      union select fonte_id from mart.cer_comune where comune_istat = ${istat} and fonte_id is not null
      union select fonte_id from mart.welfare_comune where comune_istat = ${istat} and fonte_id is not null
      union select p.fonte_id from mart.progetto_comune pc join mart.progetto_coesione p on p.cod_locale = pc.cod_locale where pc.comune_istat = ${istat} and p.fonte_id is not null
      union select p.fonte_id from mart.pnrr_progetto_comune pc join mart.pnrr_progetto p on p.progetto_id = pc.progetto_id where pc.comune_istat = ${istat} and p.fonte_id is not null
      union select id from meta.fonti where source = 'istat_sdmx' and titolo ilike '%popolazione%'
    )
    order by source, snapshot_date desc`

  return {
    anagrafica: anag,
    ambiente: { aria, rifiuti, rischio_idrogeologico: idrogeo, consumo_suolo, acque_balneazione },
    scuola,
    cultura: { biblioteche },
    energia: { comunita_energetiche: energia ?? { n_configurazioni: 0, n_impianti: 0, potenza_kw: null } },
    welfare: { prima_infanzia: welfare },
    bilancio: { anno: bilAnno, totale_impegni: bilTot?.tot, top_missioni },
    fondi: {
      coesione: { ...coesione, nota: 'fondi di coesione (FSE/FESR/FSC…), NON PNRR' },
      pnrr: { ...pnrr, nota: 'importi multi-comune non ripartiti; stato per-progetto non pubblico' },
    },
    governo: { sindaco: sindaco ?? null, n_amministratori: giunta?.n ?? 0 },
    appalti: { anno: 2024, n_appalti: appalti?.n ?? 0, importo_totale: appalti?.tot ?? 0, top_aggiudicatari, nota: 'CIG ordinari (~sopra €40k); sotto-soglia escluso' },
    gemelli,
    fonti,
    disclaimer: 'Dati pubblici; aria = EEA (copre solo i comuni con stazione); bilancio = impegni di competenza; fondi multi-comune non ripartiti; verificare le fonti citate.',
  }
}

// Elenca i progetti reali (PNRR o coesione) localizzati nel comune, per importo.
export async function progettiComune(istat: string, tipo: 'pnrr' | 'coesione', limite = 20) {
  const lim = Math.min(limite, 50)
  if (tipo === 'pnrr') {
    return sql`select p.cup, p.titolo, p.missione, p.componente, p.importo_pnrr, p.is_in_regis, p.soggetto_attuatore
      from mart.pnrr_progetto_comune pc join mart.pnrr_progetto p on p.progetto_id = pc.progetto_id
      where pc.comune_istat = ${istat} order by p.importo_pnrr desc nulls last limit ${lim}`
  }
  return sql`select p.cup, p.titolo, p.ambito, p.programma, p.importo_finanziato, p.importo_pagato, p.stato
    from mart.progetto_comune pc join mart.progetto_coesione p on p.cod_locale = pc.cod_locale
    where pc.comune_istat = ${istat} order by p.importo_finanziato desc nulls last limit ${lim}`
}

async function metricheComune(istat: string) {
  const [a] = await sql`select denominazione, denominazione_provincia, popolazione, geo.classe_demografica(popolazione) classe from geo.comuni where codice_istat = ${istat}`
  if (!a) return null
  const [rif] = await sql`select rd_pct, procapite_kg from mart.rifiuti_comune_anno where comune_istat = ${istat} and anno = 2024`
  const [suolo] = await sql`select suolo_consumato_pct from mart.consumo_suolo_comune where comune_istat = ${istat}`
  const [aria] = await sql`select giorni_sforamento_max from mart.aria_comune_anno where comune_istat = ${istat} and inquinante = 'PM10' order by anno desc limit 1`
  const [bil] = await sql`select round((sum(b.impegni)/nullif(g.popolazione,0))::numeric,0) p from mart.bilancio_comune b join geo.comuni g on g.codice_istat=b.comune_istat where b.comune_istat = ${istat} and b.anno=2024 group by g.popolazione`
  const [coes] = await sql`select coalesce(sum(p.importo_finanziato),0)::numeric t from mart.progetto_comune pc join mart.progetto_coesione p on p.cod_locale=pc.cod_locale where pc.comune_istat = ${istat}`
  const [pnrr] = await sql`select coalesce(sum(p.importo_pnrr),0)::numeric t from mart.pnrr_progetto_comune pc join mart.pnrr_progetto p on p.progetto_id=pc.progetto_id where pc.comune_istat = ${istat}`
  const [s] = await sql`select cognome, nome from mart.amministratore_comune where comune_istat = ${istat} and carica='Sindaco' limit 1`
  return {
    denominazione: a.denominazione, provincia: a.denominazione_provincia, popolazione: a.popolazione, classe_demografica: a.classe,
    rifiuti_rd_pct: rif?.rd_pct ?? null, rifiuti_procapite_kg: rif?.procapite_kg ?? null, consumo_suolo_pct: suolo?.suolo_consumato_pct ?? null,
    pm10_giorni_sforamento: aria?.giorni_sforamento_max ?? null, spesa_procapite_eur: bil?.p ?? null,
    fondi_coesione_eur: Number(coes?.t ?? 0), pnrr_eur: Number(pnrr?.t ?? 0), sindaco: s ? `${s.nome} ${s.cognome}` : null,
  }
}

export async function confrontaComuni(istatA: string, istatB: string) {
  const [a, b] = await Promise.all([metricheComune(istatA), metricheComune(istatB)])
  return { a, b }
}

// Classifica dei comuni per una metrica, opzionalmente filtrata per regione.
export async function classifica(tema: string, opts: { regione?: string | null; ordine?: 'desc' | 'asc'; limite?: number } = {}) {
  const dir = opts.ordine === 'asc' ? 'asc' : 'desc'
  const lim = Math.min(Number(opts.limite) || 10, 50)
  const reg = opts.regione ?? null
  type Row = { codice_istat: string; denominazione: string; denominazione_provincia: string; valore: number; metrica: string }
  let rows: Row[]
  switch (tema) {
    case 'consumo_suolo': rows = await sql`select g.codice_istat, g.denominazione, g.denominazione_provincia, round(cs.suolo_consumato_pct::numeric,1) valore, 'consumo suolo %' metrica from mart.consumo_suolo_comune cs join geo.comuni g on g.codice_istat=cs.comune_istat where cs.suolo_consumato_pct is not null and (${reg}::text is null or g.denominazione_regione=${reg})`; break
    case 'rifiuti_rd': rows = await sql`select g.codice_istat, g.denominazione, g.denominazione_provincia, r.rd_pct valore, 'RD %' metrica from mart.rifiuti_comune_anno r join geo.comuni g on g.codice_istat=r.comune_istat where r.anno=2024 and r.rd_pct is not null and (${reg}::text is null or g.denominazione_regione=${reg})`; break
    case 'rifiuti_procapite': rows = await sql`select g.codice_istat, g.denominazione, g.denominazione_provincia, r.procapite_kg valore, 'kg/ab' metrica from mart.rifiuti_comune_anno r join geo.comuni g on g.codice_istat=r.comune_istat where r.anno=2024 and r.procapite_kg is not null and (${reg}::text is null or g.denominazione_regione=${reg})`; break
    case 'aria_pm10': rows = await sql`select g.codice_istat, g.denominazione, g.denominazione_provincia, a.giorni_sforamento_max valore, 'giorni PM10>50' metrica from mart.aria_comune_anno a join geo.comuni g on g.codice_istat=a.comune_istat where a.inquinante='PM10' and a.giorni_sforamento_max is not null and (${reg}::text is null or g.denominazione_regione=${reg})`; break
    case 'spesa_procapite': rows = await sql`select g.codice_istat, g.denominazione, g.denominazione_provincia, round((sum(b.impegni)/nullif(g.popolazione,0))::numeric,0) valore, 'spesa €/ab' metrica from mart.bilancio_comune b join geo.comuni g on g.codice_istat=b.comune_istat where b.anno=2024 and (${reg}::text is null or g.denominazione_regione=${reg}) group by g.codice_istat, g.denominazione, g.denominazione_provincia, g.popolazione having g.popolazione>0`; break
    case 'frane': rows = await sql`select g.codice_istat, g.denominazione, g.denominazione_provincia, i.area_pericolosita_frane_pct valore, 'area frane %' metrica from mart.idrogeo_comune i join geo.comuni g on g.codice_istat=i.comune_istat where i.area_pericolosita_frane_pct is not null and (${reg}::text is null or g.denominazione_regione=${reg})`; break
    case 'biblioteche': rows = await sql`select g.codice_istat, g.denominazione, g.denominazione_provincia, count(*)::numeric valore, 'n biblioteche' metrica from mart.biblioteca_comune b join geo.comuni g on g.codice_istat=b.comune_istat where (${reg}::text is null or g.denominazione_regione=${reg}) group by g.codice_istat, g.denominazione, g.denominazione_provincia`; break
    default: throw new Error('tema sconosciuto: ' + tema + '. Disponibili: consumo_suolo, rifiuti_rd, rifiuti_procapite, aria_pm10, spesa_procapite, frane, biblioteche')
  }
  const sorted = rows.filter((r) => r.valore != null).sort((x, y) => (dir === 'asc' ? Number(x.valore) - Number(y.valore) : Number(y.valore) - Number(x.valore))).slice(0, lim)
  return { tema, metrica: rows[0]?.metrica ?? tema, regione: reg, ordine: dir, classifica: sorted.map((r) => ({ comune: r.denominazione, provincia: r.denominazione_provincia, valore: Number(r.valore) })) }
}

// Appalti del comune (ANAC 2024): chi vince, top aggiudicatari, gare maggiori.
export async function appaltiComune(istat: string, limite = 15) {
  const lim = Math.min(limite, 50)
  const [tot] = await sql`select count(*)::int n, coalesce(sum(importo),0)::numeric importo from mart.appalto where comune_istat = ${istat} and aggiudicatario is not null`
  const top_aggiudicatari = await sql`select aggiudicatario, cf_aggiudicatario, count(*)::int n_appalti, round(sum(importo)::numeric,0) importo from mart.appalto where comune_istat = ${istat} and aggiudicatario is not null group by aggiudicatario, cf_aggiudicatario order by importo desc nulls last limit 10`
  const maggiori_appalti = await sql`select cig, oggetto, aggiudicatario, importo from mart.appalto where comune_istat = ${istat} and aggiudicatario is not null order by importo desc nulls last limit ${lim}`
  return { anno: 2024, n_appalti: tot?.n ?? 0, importo_totale: tot?.importo ?? 0, top_aggiudicatari, maggiori_appalti, nota: 'CIG ordinari ANAC (~sopra €40k), stazione appaltante = comune; sotto-soglia (SmartCIG) escluso' }
}
