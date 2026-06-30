-- 0006_mart_bilancio_pnrr.sql — bilanci comunali per missione (BDAP FET) + PNRR per comune (OpenPNRR).

-- SPESA per comune × anno × MISSIONE (rendiconto armonizzato, solo enti tipo 'COMUNI'/ELCOMU).
create table if not exists mart.bilancio_comune (
  comune_istat      text not null references geo.comuni (codice_istat),
  anno              integer not null,
  missione_cod      text not null,    -- '01'..'20','50','60','99'
  missione_desc     text,
  impegni           numeric,          -- competenza (default per "quanto spende")
  totale_pagamenti  numeric,          -- pagamenti comp.+residui
  fonte_id          bigint not null references meta.fonti (id),
  primary key (comune_istat, anno, missione_cod)
);
create index if not exists bilancio_comune_anno_idx on mart.bilancio_comune (comune_istat, anno);

-- PNRR interventi (OpenPNRR). Grain = progetto (CUP) ; importi a livello progetto.
create table if not exists mart.pnrr_progetto (
  progetto_id        text primary key,
  cup                text,
  titolo             text,
  codice_misura      text,    -- es. M1C1I1.04.05
  missione           text,    -- M1..M7
  componente         text,    -- M#C#
  descrizione_misura text,
  importo_pnrr       numeric,
  importo_totale     numeric,
  is_in_regis        boolean, -- prossimo proxy di "stato" (lo stato per-progetto NON è aperto)
  soggetto_attuatore text,
  fonte_id           bigint not null references meta.fonti (id)
);

-- Localizzazione PNRR: un progetto puo toccare piu comuni (importi NON ripartiti).
create table if not exists mart.pnrr_progetto_comune (
  progetto_id   text not null references mart.pnrr_progetto (progetto_id) on delete cascade,
  comune_istat  text not null references geo.comuni (codice_istat),
  primary key (progetto_id, comune_istat)
);
create index if not exists pnrr_progetto_comune_istat_idx on mart.pnrr_progetto_comune (comune_istat);
