-- 0007_mart_cultura_acque.sql — cultura (biblioteche ICCU) + acque balneazione (EEA/EMODnet).

-- BIBLIOTECHE (ICCU Anagrafe, CC0). comune via ISTAT diretto.
create table if not exists mart.biblioteca_comune (
  isil                     text primary key,
  comune_istat             text references geo.comuni (codice_istat),
  denominazione            text,
  tipologia_funzionale     text,  -- Pubblica / Specializzata / Scolastica / ...
  tipologia_amministrativa text,  -- Comune / Universita' / Enti ecclesiastici / ...
  indirizzo                text,
  lat                      numeric,
  lng                      numeric,
  fonte_id                 bigint not null references meta.fonti (id)
);
create index if not exists biblioteca_comune_istat_idx on mart.biblioteca_comune (comune_istat);

-- BALNEAZIONE (EEA/WISE via EMODnet). comune dal codice ISTAT incorporato nel sito_id (substr 6-11).
create table if not exists mart.balneazione_sito (
  sito_id        text not null,
  anno           integer not null,
  comune_istat   text references geo.comuni (codice_istat),
  classe_qualita text,  -- "1 - Excellent" / "2 - Good" / "4 - Poor" / ...
  nome           text,
  lat            numeric,
  lng            numeric,
  fonte_id       bigint not null references meta.fonti (id),
  primary key (sito_id, anno)
);
create index if not exists balneazione_comune_idx on mart.balneazione_sito (comune_istat);
