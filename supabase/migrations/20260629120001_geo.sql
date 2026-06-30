-- 0001_geo.sql — the spatial spine. Ingested FIRST; every theme joins to geo.comuni.
-- Source: openpolis/geojson-italy (confini) + ISTAT codici comune.
-- Verified live 2026-06-29 (notes/mappa-open-data-civici.md).

create schema if not exists geo;

-- PostGIS is available on Supabase via the postgis extension.
create extension if not exists postgis;

create table if not exists geo.comuni (
  codice_istat            text primary key,          -- 6 cifre zero-padded (3 prov + 3 comune)
  pro_com                 integer unique,            -- codice numerico usato da ISPRA (pro_com / pro_com_t)
  codice_catastale        text,                      -- Belfiore (es. F205 = Milano)
  denominazione           text not null,
  sigla_provincia         text,
  cod_provincia           text,
  denominazione_provincia text,
  cod_regione             text,
  denominazione_regione   text,
  popolazione             integer,                   -- ultimo dato ISTAT disponibile (nullable)
  popolazione_anno        integer,
  geom                    geometry(MultiPolygon, 4326),
  fonte_id                bigint                      -- FK -> meta.fonti (set after 0002)
);

comment on table geo.comuni is 'Anagrafe comuni italiani: chiave di join di tutto il lake. codice_istat è la PK canonica; pro_com fa da ponte verso ISPRA; codice_catastale verso fonti fiscali.';

create index if not exists comuni_denominazione_lower_idx on geo.comuni (lower(denominazione));
create index if not exists comuni_provincia_idx on geo.comuni (denominazione_provincia);
create index if not exists comuni_regione_idx on geo.comuni (denominazione_regione);
create index if not exists comuni_geom_gix on geo.comuni using gist (geom);
