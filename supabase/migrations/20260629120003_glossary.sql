-- 0003_glossary.sql — the defensible curation (CLAUDE.md §4 genesis table).
-- Lookup tables mirrored from glossary/*.json. Values populated in Phase 1+ from VERIFIED sources only
-- (no fabricated codes/thresholds — citation policy applies to the glossary too).

create schema if not exists glossary;

-- SIOPE → italiano civico (la traduzione che nessun LLM fa bene out-of-the-box)
create table if not exists glossary.siope (
  codice               text primary key,   -- es. 1.03.02.09.008
  descrizione_ufficiale text,
  descrizione_civica   text,               -- es. "spese per servizi informatici"
  livello              integer
);

-- Natura/tipologia CUP
create table if not exists glossary.natura_cup (
  codice      text primary key,
  descrizione text
);

-- Classi demografiche D.Lgs. 118/2011 (soglie da VERIFICARE sulla norma prima di popolare)
create table if not exists glossary.classe_demografica (
  classe      integer primary key,
  soglia_min  integer,
  soglia_max  integer,                      -- null = nessun tetto
  etichetta   text
);

-- Ponte sensore aria → comune (dati.lombardia ib47-atvt; pattern replicabile per altre ARPA)
create table if not exists glossary.sensore_comune (
  id_sensore    text primary key,
  comune_istat  text references geo.comuni (codice_istat),
  inquinante    text,
  nomestazione  text
);

-- Ponte biblioteca ISIL → comune (ICCU Anagrafe Biblioteche)
create table if not exists glossary.isil_comune (
  isil          text primary key,
  comune_istat  text references geo.comuni (codice_istat),
  denominazione text
);

comment on schema glossary is 'Lookup curati e versionati. Mirror di glossary/*.json. Il valore difendibile del commons sta qui, non nei connettori.';
