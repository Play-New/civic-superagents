-- 0002_meta.sql — provenance. Backs the hard citation policy (CLAUDE.md §5):
-- every mart row references a meta.fonti row, which points to an immutable file in raw/ Storage.

create schema if not exists meta;

create table if not exists meta.fonti (
  id                  bigint generated always as identity primary key,
  source              text not null,        -- chiave stabile della fonte, es. 'ispra_catasto_rifiuti'
  dataset_id          text,                 -- id/slug del dataset presso la fonte
  titolo              text,
  url                 text not null,         -- endpoint o URL del file alla data di snapshot
  snapshot_date       date not null,         -- quando è stato scaricato (immutabile)
  storage_path        text,                  -- path nel bucket Storage raw/, es. raw/rifiuti/2024/dettaglio_comunale.csv
  formato             text,                  -- csv | json | sdmx-json | xlsx | shp | sparql | gtfs ...
  license             text,                  -- es. CC-BY-4.0, CC0-1.0, IODL-2.0
  latest_usable_year  integer,               -- ultimo anno con dato valido (es. rifiuti = 2024, 2025 vuoto)
  granularita         text,                  -- comune | provincia | regione | struttura | sito
  note_path           text,                  -- path alla nota quirk, es. notes/ispra-rifiuti.md
  quirks              text,                  -- nota inline breve sui tranelli (filtro -9999, off-by-one, ...)
  ingested_at         timestamptz not null default now(),
  unique (source, dataset_id, snapshot_date)
);

comment on table meta.fonti is 'Una riga per ogni dataset/snapshot ingerito. La citazione in output risale qui: source + dataset_id + snapshot_date + riga.';

-- FK ritardata da 0001 (geo.comuni.fonte_id)
alter table geo.comuni
  drop constraint if exists comuni_fonte_fk,
  add constraint comuni_fonte_fk foreign key (fonte_id) references meta.fonti (id);
