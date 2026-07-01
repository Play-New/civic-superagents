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

// Ultimo anno disponibile (max(anno)) per tabella mart, cache per la vita del processo:
// evita l'anno hardcoded che invecchia in silenzio a ogni re-ingestione.
const annoCache = new Map<string, Promise<number | null>>()
function latestAnno(table: string, extraFilter?: string): Promise<number | null> {
  const key = `${table}|${extraFilter ?? ''}`
  let p = annoCache.get(key)
  if (!p) {
    p = sql.unsafe(`select max(anno)::int a from ${table}${extraFilter ? ` where ${extraFilter}` : ''}`).then((r) => (r[0]?.a ?? null) as number | null)
    p.catch(() => annoCache.delete(key)) // non cachare i fallimenti transitori
    annoCache.set(key, p)
  }
  return p
}

// Fonti citabili (CLAUDE.md §5): le righe meta.fonti che reggono i numeri mostrati, dedup, senza null.
async function citaFonti(ids: (number | string | null | undefined)[]) {
  const uniq = [...new Set(ids.filter((x): x is number | string => x != null))]
  if (uniq.length === 0) return []
  return sql`select source, titolo, dataset_id, url, snapshot_date::text snapshot, license, note_path
    from meta.fonti where id = any(${uniq}::bigint[]) order by source, snapshot_date desc`
}

// Peer-similarity ("gemelli"): comuni nella stessa classe demografica (Art.156 TUEL) e regione;
// fallback nazionale se la regione ha pochi pari. Confronta le metriche-chiave alla mediana dei gemelli.
export async function gemelliComune(istat: string) {
  const [m] = await sql<{ classe: number; reg: string }[]>`select geo.classe_demografica(popolazione) classe, denominazione_regione reg from geo.comuni where codice_istat = ${istat}`
  if (!m?.classe) return null
  // un solo scan della classe su tutta Italia, con flag regionale: niente doppio passaggio quando la regione ha <5 pari
  const stessaClasse = await sql<{ codice_istat: string; in_regione: boolean }[]>`select codice_istat, (denominazione_regione = ${m.reg}) in_regione from geo.comuni where geo.classe_demografica(popolazione) = ${m.classe} and codice_istat <> ${istat}`
  const regionali = stessaClasse.filter((r) => r.in_regione)
  const nazionale = regionali.length < 5
  const criterio = nazionale ? `classe demografica ${m.classe} · nazionale` : `classe demografica ${m.classe} · regione ${m.reg}`
  const peers = (nazionale ? stessaClasse : regionali).map((r) => r.codice_istat)
  const [cls, annoRifiuti, annoSuolo, annoBilancio] = await Promise.all([
    sql<{ etichetta: string }[]>`select etichetta from glossary.classe_demografica where classe = ${m.classe}`,
    latestAnno('mart.rifiuti_comune_anno'),
    latestAnno('mart.consumo_suolo_comune'),
    latestAnno('mart.bilancio_comune'),
  ])
  if (peers.length === 0) return { classe: m.classe, etichetta: cls[0]?.etichetta, criterio, n_gemelli: 0, confronti: [] }

  const cmp = async (metrica: string, unita: string, valQ: Promise<{ v: number | null }[]>, medQ: Promise<{ m: number | null }[]>) => {
    const [val, med0] = await Promise.all([valQ, medQ]) // valore e mediana in parallelo
    const v = val[0]?.v
    const med = med0[0]?.m
    if (v == null || med == null) return null
    const diff = Number(med) ? Math.round((Number(v) / Number(med) - 1) * 100) : null
    return { metrica, unita, valore: Math.round(Number(v) * 100) / 100, mediana_gemelli: Math.round(Number(med) * 100) / 100, scostamento_pct: diff, verdetto: diff == null ? null : diff > 0 ? 'sopra i gemelli' : diff < 0 ? 'sotto i gemelli' : 'in linea con i gemelli' }
  }

  const confronti = (await Promise.all([
    cmp('rifiuti pro-capite', 'kg/ab',
      sql`select procapite_kg v from mart.rifiuti_comune_anno where comune_istat = ${istat} and anno = ${annoRifiuti}`,
      sql`select percentile_cont(0.5) within group (order by procapite_kg) m from mart.rifiuti_comune_anno where anno = ${annoRifiuti} and comune_istat = any(${peers})`),
    cmp('raccolta differenziata', '%',
      sql`select rd_pct v from mart.rifiuti_comune_anno where comune_istat = ${istat} and anno = ${annoRifiuti}`,
      sql`select percentile_cont(0.5) within group (order by rd_pct) m from mart.rifiuti_comune_anno where anno = ${annoRifiuti} and comune_istat = any(${peers})`),
    cmp('consumo di suolo', '%',
      sql`select suolo_consumato_pct v from mart.consumo_suolo_comune where comune_istat = ${istat} and anno = ${annoSuolo}`,
      sql`select percentile_cont(0.5) within group (order by suolo_consumato_pct) m from mart.consumo_suolo_comune where anno = ${annoSuolo} and comune_istat = any(${peers})`),
    cmp(`spesa comunale pro-capite (impegni ${annoBilancio})`, '€/ab',
      sql`select sum(b.impegni)/nullif(g.popolazione,0) v from mart.bilancio_comune b join geo.comuni g on g.codice_istat=b.comune_istat where b.comune_istat = ${istat} and b.anno=${annoBilancio} group by g.popolazione`,
      sql`select percentile_cont(0.5) within group (order by pc) m from (select sum(b.impegni)/nullif(g.popolazione,0) pc from mart.bilancio_comune b join geo.comuni g on g.codice_istat=b.comune_istat where b.comune_istat = any(${peers}) and b.anno=${annoBilancio} group by b.comune_istat, g.popolazione) t`),
  ])).filter(Boolean)

  return { classe: m.classe, etichetta: cls[0]?.etichetta, criterio, n_gemelli: peers.length, confronti }
}

// Full civic profile, comune-keyed, every figure backed by a meta.fonti reference.
export async function leggiComune(istat: string) {
  const [anag] = await sql`
    select codice_istat, denominazione, denominazione_provincia, sigla_provincia, denominazione_regione, popolazione, popolazione_anno
    from geo.comuni where codice_istat = ${istat}`
  if (!anag) return null

  // bilancio: le due query dipendono dall'ultimo anno disponibile PER QUESTO comune (BDAP arriva a ondate regionali)
  const bilancioQ = (async () => {
    const anno = ((await sql`select max(anno)::int a from mart.bilancio_comune where comune_istat = ${istat}`)[0]?.a ?? null) as number | null
    if (!anno) return { anno: null as number | null, totale_impegni: null as unknown, top_missioni: [] as unknown[] }
    const [top_missioni, [tot]] = await Promise.all([
      sql`select missione_cod, missione_desc, impegni from mart.bilancio_comune where comune_istat = ${istat} and anno = ${anno} and impegni is not null order by impegni desc limit 6`,
      sql`select sum(impegni)::numeric tot from mart.bilancio_comune where comune_istat = ${istat} and anno = ${anno}`,
    ])
    return { anno, totale_impegni: (tot?.tot ?? null) as unknown, top_missioni: top_missioni as unknown[] }
  })()

  // Fonti citabili: ESATTAMENTE le righe meta.fonti che reggono i dati mostrati per QUESTO comune,
  // raccolte via il fonte_id region/anno-specifico di ogni mart (es. BDAP → la regione giusta, non
  // una fissa). Popolazione via geo.comuni.popolazione_fonte_id (puntatore esatto dell'ingestor);
  // il match testuale su istat_sdmx resta solo come fallback se il puntatore manca.
  const fontiQ = sql`
    select source, titolo, dataset_id, url, snapshot_date::text snapshot, license, note_path
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
      union select popolazione_fonte_id from geo.comuni where codice_istat = ${istat} and popolazione_fonte_id is not null
      union select id from meta.fonti where source = 'istat_sdmx' and titolo ilike '%popolazione%'
        and not exists (select 1 from geo.comuni where codice_istat = ${istat} and popolazione_fonte_id is not null)
    )
    order by source, snapshot_date desc`

  // tutte comune-keyed e indipendenti: un solo giro di Promise.all invece di ~20 await in fila
  const [
    [idrogeo], [rifiuti], [consumo_suolo], [scuola], [aria],
    bilancio, [coesione], [pnrr], [sindaco], [giunta], gemelli,
    appalti, [biblioteche], acque_balneazione, [energia], welfare, fonti,
  ] = await Promise.all([
    sql`
      select pop_esposta_frane, pop_esposta_alluvioni, area_pericolosita_frane_pct, area_pericolosita_alluvioni_pct
      from mart.idrogeo_comune where comune_istat = ${istat}`,
    sql`select anno, rd_pct, procapite_kg from mart.rifiuti_comune_anno where comune_istat = ${istat} order by anno desc limit 1`,
    sql`select anno, suolo_consumato_ha, suolo_consumato_pct from mart.consumo_suolo_comune where comune_istat = ${istat} order by anno desc limit 1`,
    sql`
      select count(*)::int edifici,
        count(*) filter (where certificato_antincendio)::int con_antincendio,
        count(*) filter (where certificato_antincendio is false)::int senza_antincendio
      from mart.scuola_edificio where comune_istat = ${istat}`,
    // aria PM10: sintesi annuale NAZIONALE (EEA) — copre i comuni con almeno una stazione di monitoraggio
    sql`select anno, n_stazioni, media_annua, giorni_sforamento_max from mart.aria_comune_anno where comune_istat = ${istat} and inquinante = 'PM10' order by anno desc limit 1`,
    bilancioQ,
    sql`
      select count(distinct pc.cod_locale)::int n_progetti, coalesce(sum(p.importo_finanziato),0)::numeric finanziato
      from mart.progetto_comune pc join mart.progetto_coesione p on p.cod_locale = pc.cod_locale where pc.comune_istat = ${istat}`,
    sql`
      select count(distinct p.progetto_id)::int n_progetti, coalesce(sum(p.importo_pnrr),0)::numeric finanziato
      from mart.pnrr_progetto_comune pc join mart.pnrr_progetto p on p.progetto_id = pc.progetto_id where pc.comune_istat = ${istat}`,
    sql`select cognome, nome, lista, data_elezione::text data_elezione from mart.amministratore_comune where comune_istat = ${istat} and carica = 'Sindaco' limit 1`,
    sql`select count(*)::int n from mart.amministratore_comune where comune_istat = ${istat}`,
    gemelliComune(istat),
    appaltiComune(istat, 3),
    sql`
      select count(*)::int totale,
        count(*) filter (where tipologia_amministrativa = 'Comune')::int comunali,
        count(*) filter (where tipologia_funzionale = 'Pubblica')::int pubbliche
      from mart.biblioteca_comune where comune_istat = ${istat}`,
    sql`
      select sito_id, classe_qualita, anno from mart.balneazione_sito
      where comune_istat = ${istat} and anno = (select max(anno) from mart.balneazione_sito where comune_istat = ${istat})
      order by sito_id`,
    sql`select n_configurazioni, n_impianti, potenza_kw from mart.cer_comune where comune_istat = ${istat}`,
    sql`
      select indicatore, valore, anno from mart.welfare_comune
      where comune_istat = ${istat} and anno = (select max(anno) from mart.welfare_comune where comune_istat = ${istat})`,
    fontiQ,
  ])

  return {
    anagrafica: anag,
    ambiente: { aria, rifiuti, rischio_idrogeologico: idrogeo, consumo_suolo, acque_balneazione },
    scuola,
    cultura: { biblioteche },
    energia: { comunita_energetiche: energia ?? { n_configurazioni: 0, n_impianti: 0, potenza_kw: null } },
    welfare: { prima_infanzia: welfare },
    bilancio: { anno: bilancio.anno, totale_impegni: bilancio.totale_impegni, top_missioni: bilancio.top_missioni },
    fondi: {
      coesione: { ...coesione, nota: 'fondi di coesione (FSE/FESR/FSC…), NON PNRR' },
      pnrr: { ...pnrr, nota: 'importi multi-comune non ripartiti; stato per-progetto non pubblico' },
    },
    governo: { sindaco: sindaco ?? null, n_amministratori: giunta?.n ?? 0 },
    // stesso blocco di appalti_comune (query condivise), ridotto ai top 3 aggiudicatari
    appalti: { anno: appalti.anno, n_appalti: appalti.n_appalti, importo_totale: appalti.importo_totale, top_aggiudicatari: appalti.top_aggiudicatari.slice(0, 3), nota: appalti.nota },
    gemelli,
    fonti,
    disclaimer: 'Dati pubblici; aria = EEA (copre solo i comuni con stazione); bilancio = impegni di competenza (BDAP, ritardo medio 12-18 mesi); fondi multi-comune non ripartiti; verificare le fonti citate.',
  }
}

// Elenca i progetti reali (PNRR o coesione) localizzati nel comune, per importo, con fonti citabili.
export async function progettiComune(istat: string, tipo: 'pnrr' | 'coesione', limite = 20) {
  const lim = Math.min(limite, 50)
  const progetti = tipo === 'pnrr'
    ? await sql`select p.cup, p.titolo, p.missione, p.componente, p.importo_pnrr, p.is_in_regis, p.soggetto_attuatore, p.fonte_id
      from mart.pnrr_progetto_comune pc join mart.pnrr_progetto p on p.progetto_id = pc.progetto_id
      where pc.comune_istat = ${istat} order by p.importo_pnrr desc nulls last limit ${lim}`
    : await sql`select p.cup, p.titolo, p.ambito, p.programma, p.importo_finanziato, p.importo_pagato, p.stato, p.fonte_id
      from mart.progetto_comune pc join mart.progetto_coesione p on p.cod_locale = pc.cod_locale
      where pc.comune_istat = ${istat} order by p.importo_finanziato desc nulls last limit ${lim}`
  const fonti = await citaFonti(progetti.map((r) => r.fonte_id))
  return { tipo, progetti, fonti, nota: tipo === 'pnrr' ? 'importi multi-comune non ripartiti; stato per-progetto non pubblico' : 'fondi di coesione (FSE/FESR/FSC…), NON PNRR; importi a livello progetto, non ripartiti per comune' }
}

async function metricheComune(istat: string) {
  const [a] = await sql`select denominazione, denominazione_provincia, popolazione, popolazione_fonte_id, geo.classe_demografica(popolazione) classe from geo.comuni where codice_istat = ${istat}`
  if (!a) return null
  const [annoRifiuti, annoSuolo, annoBilancio] = await Promise.all([
    latestAnno('mart.rifiuti_comune_anno'), latestAnno('mart.consumo_suolo_comune'), latestAnno('mart.bilancio_comune'),
  ])
  // query indipendenti in parallelo (confronta_comuni ne paga 8 per comune) + fonte_id per la citazione
  const [[rif], [suolo], [aria], [bil], [coes], [pnrr], [s]] = await Promise.all([
    sql`select rd_pct, procapite_kg, fonte_id from mart.rifiuti_comune_anno where comune_istat = ${istat} and anno = ${annoRifiuti}`,
    sql`select suolo_consumato_pct, fonte_id from mart.consumo_suolo_comune where comune_istat = ${istat} and anno = ${annoSuolo}`,
    sql`select giorni_sforamento_max, fonte_id from mart.aria_comune_anno where comune_istat = ${istat} and inquinante = 'PM10' order by anno desc limit 1`,
    sql`select round((sum(b.impegni)/nullif(g.popolazione,0))::numeric,0) p, array_agg(distinct b.fonte_id) fonte_ids from mart.bilancio_comune b join geo.comuni g on g.codice_istat=b.comune_istat where b.comune_istat = ${istat} and b.anno=${annoBilancio} group by g.popolazione`,
    sql`select coalesce(sum(p.importo_finanziato),0)::numeric t, array_agg(distinct p.fonte_id) fonte_ids from mart.progetto_comune pc join mart.progetto_coesione p on p.cod_locale=pc.cod_locale where pc.comune_istat = ${istat}`,
    sql`select coalesce(sum(p.importo_pnrr),0)::numeric t, array_agg(distinct p.fonte_id) fonte_ids from mart.pnrr_progetto_comune pc join mart.pnrr_progetto p on p.progetto_id=pc.progetto_id where pc.comune_istat = ${istat}`,
    sql`select cognome, nome, fonte_id from mart.amministratore_comune where comune_istat = ${istat} and carica='Sindaco' limit 1`,
  ])
  return {
    denominazione: a.denominazione, provincia: a.denominazione_provincia, popolazione: a.popolazione, classe_demografica: a.classe,
    rifiuti_rd_pct: rif?.rd_pct ?? null, rifiuti_procapite_kg: rif?.procapite_kg ?? null, consumo_suolo_pct: suolo?.suolo_consumato_pct ?? null,
    pm10_giorni_sforamento: aria?.giorni_sforamento_max ?? null, spesa_procapite_eur: bil?.p ?? null,
    fondi_coesione_eur: Number(coes?.t ?? 0), pnrr_eur: Number(pnrr?.t ?? 0), sindaco: s ? `${s.nome} ${s.cognome}` : null,
    _fonte_ids: [a.popolazione_fonte_id, rif?.fonte_id, suolo?.fonte_id, aria?.fonte_id, s?.fonte_id, ...(bil?.fonte_ids ?? []), ...(coes?.fonte_ids ?? []), ...(pnrr?.fonte_ids ?? [])] as (number | string | null | undefined)[],
  }
}

export async function confrontaComuni(istatA: string, istatB: string) {
  const [ma, mb] = await Promise.all([metricheComune(istatA), metricheComune(istatB)])
  const fonti = await citaFonti([...(ma?._fonte_ids ?? []), ...(mb?._fonte_ids ?? [])])
  const pub = (m: typeof ma) => (m ? (({ _fonte_ids, ...resto }) => resto)(m) : null)
  return { a: pub(ma), b: pub(mb), fonti, nota: 'spesa pro-capite = impegni BDAP (ritardo medio 12-18 mesi); importi coesione/PNRR a livello progetto, non ripartiti se multi-comune' }
}

// Classifica dei comuni per una metrica (ordinamento e limite in SQL), opzionalmente filtrata per regione.
export async function classifica(tema: string, opts: { regione?: string | null; ordine?: 'desc' | 'asc'; limite?: number } = {}) {
  const dir = opts.ordine === 'asc' ? 'asc' : 'desc'
  const ord = dir === 'asc' ? sql`asc nulls last` : sql`desc nulls last`
  const lim = Math.min(Number(opts.limite) || 10, 50)
  const reg = opts.regione ?? null
  type Row = { codice_istat: string; denominazione: string; denominazione_provincia: string; valore: number; metrica: string; fonte_id?: number | string | null; fonte_ids?: (number | string)[] | null }
  let rows: Row[]
  let anno: number | null = null // anno del dato in classifica (null per le tabelle senza serie storica)
  switch (tema) {
    case 'consumo_suolo':
      anno = await latestAnno('mart.consumo_suolo_comune')
      rows = await sql`select g.codice_istat, g.denominazione, g.denominazione_provincia, round(cs.suolo_consumato_pct::numeric,1) valore, 'consumo suolo %' metrica, cs.fonte_id from mart.consumo_suolo_comune cs join geo.comuni g on g.codice_istat=cs.comune_istat where cs.anno=${anno} and cs.suolo_consumato_pct is not null and (${reg}::text is null or g.denominazione_regione=${reg}) order by valore ${ord} limit ${lim}`; break
    case 'rifiuti_rd':
      anno = await latestAnno('mart.rifiuti_comune_anno')
      rows = await sql`select g.codice_istat, g.denominazione, g.denominazione_provincia, r.rd_pct valore, 'RD %' metrica, r.fonte_id from mart.rifiuti_comune_anno r join geo.comuni g on g.codice_istat=r.comune_istat where r.anno=${anno} and r.rd_pct is not null and (${reg}::text is null or g.denominazione_regione=${reg}) order by valore ${ord} limit ${lim}`; break
    case 'rifiuti_procapite':
      anno = await latestAnno('mart.rifiuti_comune_anno')
      rows = await sql`select g.codice_istat, g.denominazione, g.denominazione_provincia, r.procapite_kg valore, 'kg/ab' metrica, r.fonte_id from mart.rifiuti_comune_anno r join geo.comuni g on g.codice_istat=r.comune_istat where r.anno=${anno} and r.procapite_kg is not null and (${reg}::text is null or g.denominazione_regione=${reg}) order by valore ${ord} limit ${lim}`; break
    case 'aria_pm10':
      anno = await latestAnno('mart.aria_comune_anno', "inquinante='PM10'")
      rows = await sql`select g.codice_istat, g.denominazione, g.denominazione_provincia, a.giorni_sforamento_max valore, 'giorni PM10>50' metrica, a.fonte_id from mart.aria_comune_anno a join geo.comuni g on g.codice_istat=a.comune_istat where a.inquinante='PM10' and a.anno=${anno} and a.giorni_sforamento_max is not null and (${reg}::text is null or g.denominazione_regione=${reg}) order by valore ${ord} limit ${lim}`; break
    case 'spesa_procapite':
      anno = await latestAnno('mart.bilancio_comune')
      rows = await sql`select g.codice_istat, g.denominazione, g.denominazione_provincia, round((sum(b.impegni)/nullif(g.popolazione,0))::numeric,0) valore, 'spesa €/ab' metrica, array_agg(distinct b.fonte_id) fonte_ids from mart.bilancio_comune b join geo.comuni g on g.codice_istat=b.comune_istat where b.anno=${anno} and (${reg}::text is null or g.denominazione_regione=${reg}) group by g.codice_istat, g.denominazione, g.denominazione_provincia, g.popolazione having g.popolazione>0 order by valore ${ord} limit ${lim}`; break
    case 'frane':
      rows = await sql`select g.codice_istat, g.denominazione, g.denominazione_provincia, i.area_pericolosita_frane_pct valore, 'area frane %' metrica, i.fonte_id from mart.idrogeo_comune i join geo.comuni g on g.codice_istat=i.comune_istat where i.area_pericolosita_frane_pct is not null and (${reg}::text is null or g.denominazione_regione=${reg}) order by valore ${ord} limit ${lim}`; break
    case 'biblioteche':
      rows = await sql`select g.codice_istat, g.denominazione, g.denominazione_provincia, count(*)::numeric valore, 'n biblioteche' metrica, array_agg(distinct b.fonte_id) fonte_ids from mart.biblioteca_comune b join geo.comuni g on g.codice_istat=b.comune_istat where (${reg}::text is null or g.denominazione_regione=${reg}) group by g.codice_istat, g.denominazione, g.denominazione_provincia order by valore ${ord} limit ${lim}`; break
    default: throw new Error('tema sconosciuto: ' + tema + '. Disponibili: consumo_suolo, rifiuti_rd, rifiuti_procapite, aria_pm10, spesa_procapite, frane, biblioteche')
  }
  const inClassifica = rows.filter((r) => r.valore != null)
  const fonti = await citaFonti(inClassifica.flatMap((r) => r.fonte_ids ?? (r.fonte_id != null ? [r.fonte_id] : [])))
  return {
    tema, metrica: inClassifica[0]?.metrica ?? tema, regione: reg, ordine: dir, anno,
    classifica: inClassifica.map((r) => ({ comune: r.denominazione, provincia: r.denominazione_provincia, valore: Number(r.valore) })),
    fonti,
    ...(tema === 'spesa_procapite' ? { nota: 'spesa = impegni BDAP (ritardo medio 12-18 mesi)' } : {}),
  }
}

// Appalti del comune (ANAC, ultimo anno ingerito): chi vince, top aggiudicatari, gare maggiori, fonti citabili.
export async function appaltiComune(istat: string, limite = 15) {
  const lim = Math.min(limite, 50)
  const anno = await latestAnno('mart.appalto')
  const [[tot], top_aggiudicatari, maggiori_appalti, fontiRighe] = await Promise.all([
    sql`select count(*)::int n, coalesce(sum(importo),0)::numeric importo from mart.appalto where comune_istat = ${istat} and anno = ${anno} and aggiudicatario is not null`,
    sql`select aggiudicatario, cf_aggiudicatario, count(*)::int n_appalti, round(sum(importo)::numeric,0) importo from mart.appalto where comune_istat = ${istat} and anno = ${anno} and aggiudicatario is not null group by aggiudicatario, cf_aggiudicatario order by importo desc nulls last limit 10`,
    sql`select cig, oggetto, aggiudicatario, importo from mart.appalto where comune_istat = ${istat} and anno = ${anno} and aggiudicatario is not null order by importo desc nulls last limit ${lim}`,
    sql`select distinct fonte_id from mart.appalto where comune_istat = ${istat} and anno = ${anno} and fonte_id is not null`,
  ])
  const fonti = await citaFonti(fontiRighe.map((r) => r.fonte_id))
  return { anno, n_appalti: tot?.n ?? 0, importo_totale: tot?.importo ?? 0, top_aggiudicatari, maggiori_appalti, fonti, nota: 'CIG ordinari ANAC (~sopra €40k), stazione appaltante = comune; sotto-soglia (SmartCIG) escluso' }
}
