-- 0011 — appalti aggiudicati con stazione appaltante = COMUNE (ANAC). "Chi vince gli appalti del mio comune".
-- Soglia: CIG ordinari (sopra ~€40k); il sotto-soglia (SmartCIG) è in dataset separati, NON incluso (dichiarato).
create table if not exists mart.appalto (
  cig                 text primary key,
  comune_istat        text references geo.comuni (codice_istat),
  stazione_appaltante text,
  cf_stazione         text,
  aggiudicatario      text,
  cf_aggiudicatario   text,
  importo             numeric,   -- importo_aggiudicazione (prezzo di aggiudicazione)
  importo_base        numeric,   -- importo_complessivo_gara (base d'asta)
  oggetto             text,
  anno                integer,
  esito               text,
  fonte_id            bigint not null references meta.fonti (id)
);
create index if not exists appalto_comune_idx on mart.appalto (comune_istat);
create index if not exists appalto_cf_agg_idx on mart.appalto (cf_aggiudicatario);
