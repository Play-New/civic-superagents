-- 0005_mart_money_gov.sql — money/governo marts (stream 🟡).
-- Cohesion projects (OpenCoesione), local administrators (DAIT), + ISTAT population on the spine.

-- ISTAT population on the spine (separate provenance from the geometry source).
alter table geo.comuni add column if not exists popolazione_fonte_id bigint references meta.fonti (id);

-- COHESION PROJECTS (OpenCoesione). NB: cohesion funds (FSE/FESR/FSC/POC...), NOT PNRR (that's OpenPNRR).
-- Grain = COD_LOCALE_PROGETTO (one row per project); importi are project-level totals.
create table if not exists mart.progetto_coesione (
  cod_locale          text primary key,
  cup                 text,
  titolo              text,
  programma           text,
  ambito              text,        -- FSE | FESR | FSC | POC | ...
  ciclo               text,        -- es. 2021-2027
  importo_finanziato  numeric,     -- FINANZ_TOTALE_PUBBLICO (totale progetto, NON ripartito tra comuni)
  importo_pagato      numeric,     -- TOT_PAGAMENTI
  stato               text,        -- Concluso | Liquidato | In corso | Non avviato | Non determinabile
  n_comuni            integer,     -- quanti comuni tocca (>1 = multi-comune: non sommare importi per comune)
  fonte_id            bigint not null references meta.fonti (id)
);

-- Localization junction: un progetto puo toccare piu comuni (lista ':::'). Niente importi qui.
create table if not exists mart.progetto_comune (
  cod_locale    text not null references mart.progetto_coesione (cod_locale) on delete cascade,
  comune_istat  text not null references geo.comuni (codice_istat),
  primary key (cod_locale, comune_istat)
);
create index if not exists progetto_comune_istat_idx on mart.progetto_comune (comune_istat);

-- LOCAL ADMINISTRATORS (DAIT anagrafe amministratori comunali "in carica").
create table if not exists mart.amministratore_comune (
  id            bigint generated always as identity primary key,
  comune_istat  text not null references geo.comuni (codice_istat),
  cognome       text,
  nome          text,
  carica        text,        -- Sindaco | Assessore | Consigliere | ...
  incarico      text,        -- Vicesindaco | Presidente del consiglio | ... (sotto-ruolo, spesso vuoto)
  sesso         text,
  data_nascita  date,
  lista         text,
  data_elezione date,
  fonte_id      bigint not null references meta.fonti (id)
);
create index if not exists amministratore_comune_istat_idx on mart.amministratore_comune (comune_istat);
create index if not exists amministratore_carica_idx on mart.amministratore_comune (carica);
