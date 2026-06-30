-- 0004_mart_wedge.sql — comune-keyed analytical tables for the 5 WEDGES.
-- Wedge-first per the locked decision. Money/governo marts arrive in later migrations (0005+).
-- Columns are a first cut; Phase 1 refines them against the real downloaded shapes.
-- INVARIANT: every mart row carries comune_istat (-> geo.comuni) AND fonte_id (-> meta.fonti).

create schema if not exists mart;

-- AIR QUALITY — measures. Time-series, partition candidate by year.
-- Source: dati.lombardia nicp-bhqi (pilota). Filtro: stato='VA', scarta valore=-9999.
create table if not exists mart.aria_misure (
  id            bigint generated always as identity primary key,
  comune_istat  text not null references geo.comuni (codice_istat),
  id_sensore    text,
  inquinante    text not null,          -- PM10, PM2.5, NO2, O3, ...
  data          date not null,
  valore        numeric,
  unita         text,
  fonte_id      bigint not null references meta.fonti (id)
);
create index if not exists aria_comune_data_idx on mart.aria_misure (comune_istat, inquinante, data);

-- LANDSLIDE / FLOOD RISK — per comune. Source: ISPRA IdroGEO (/api/pir/comuni, /api/iffi/comuni).
create table if not exists mart.idrogeo_comune (
  comune_istat            text primary key references geo.comuni (codice_istat),
  pop_esposta_frane       integer,
  pop_esposta_alluvioni   integer,
  area_pericolosita_frane_pct      numeric,
  area_pericolosita_alluvioni_pct  numeric,
  classe                  text,
  fonte_id                bigint not null references meta.fonti (id)
);

-- WASTE / recycling — per comune per year. Source: ISPRA Catasto Rifiuti (2024 = latest usable).
create table if not exists mart.rifiuti_comune_anno (
  comune_istat   text not null references geo.comuni (codice_istat),
  anno           integer not null,
  rifiuti_tot_t  numeric,
  procapite_kg   numeric,
  rd_pct         numeric,                -- % raccolta differenziata
  fonte_id       bigint not null references meta.fonti (id),
  primary key (comune_istat, anno)
);

-- SOIL CONSUMPTION — per comune per year. Source: ISPRA consumo di suolo (ed. 2025, dati al 2024).
create table if not exists mart.consumo_suolo_comune (
  comune_istat       text not null references geo.comuni (codice_istat),
  anno               integer not null,
  suolo_consumato_ha numeric,
  incremento_ha      numeric,
  suolo_consumato_pct numeric,
  fonte_id           bigint not null references meta.fonti (id),
  primary key (comune_istat, anno)
);

-- SCHOOL — per building. Source: MIUR dati.istruzione.it (granularità edificio).
create table if not exists mart.scuola_edificio (
  codice_edificio  text primary key,
  comune_istat     text not null references geo.comuni (codice_istat),
  denominazione    text,
  agibilita        boolean,
  certificato_antincendio boolean,
  zona_sismica     text,
  fonte_id         bigint not null references meta.fonti (id)
);

comment on schema mart is 'Tabelle analitiche comune-keyed servite via PostREST/MCP. Wedge-first; money e governo nelle migrazioni 0005+.';
