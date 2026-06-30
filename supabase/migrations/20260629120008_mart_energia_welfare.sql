-- 0008_mart_energia_welfare.sql — comunità energetiche (GSE CER) + servizi prima infanzia (ISTAT).

-- CER — comunità energetiche rinnovabili per comune (GSE). comune via spatial join (lat/lng).
create table if not exists mart.cer_comune (
  comune_istat     text primary key references geo.comuni (codice_istat),
  n_configurazioni integer,
  n_impianti       integer,
  potenza_kw       numeric,
  fonte_id         bigint not null references meta.fonti (id)
);

-- WELFARE — servizi educativi prima infanzia per comune (ISTAT). Long-format per indicatore.
create table if not exists mart.welfare_comune (
  comune_istat text not null references geo.comuni (codice_istat),
  anno         integer not null,
  indicatore   text not null,  -- posti_nido_per_100_bambini_0_2 | posti_nido_autorizzati | spesa_comuni_prima_infanzia_euro
  valore       numeric,
  fonte_id     bigint not null references meta.fonti (id),
  primary key (comune_istat, anno, indicatore)
);
create index if not exists welfare_comune_idx on mart.welfare_comune (comune_istat, anno);
