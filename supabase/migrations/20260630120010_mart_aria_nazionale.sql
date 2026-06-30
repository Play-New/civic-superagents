-- 0010 — qualità aria nazionale per comune (sintesi annuale PM10, EEA).
-- Grana sintetica (1 riga per comune/anno) perché il dato per-stazione giornaliero nazionale è enorme;
-- copre solo i comuni con almeno una stazione (il monitoraggio è sparso, non capillare).
create table if not exists mart.aria_comune_anno (
  comune_istat          text not null references geo.comuni (codice_istat),
  anno                  integer not null,
  inquinante            text not null default 'PM10',
  n_stazioni            integer,
  media_annua           numeric,   -- media delle medie annue delle stazioni del comune (µg/m³)
  giorni_sforamento_max integer,   -- giorni > 50 µg/m³ della stazione peggiore (limite UE: max 35/anno)
  fonte_id              bigint not null references meta.fonti (id),
  primary key (comune_istat, anno, inquinante)
);
create index if not exists aria_comune_anno_idx on mart.aria_comune_anno (comune_istat, anno);
