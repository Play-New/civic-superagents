-- 0012 — tabelle di revisione (firma risposte test + verifica licenze) per i tool MCP in chat.
-- Scrivibili dal ruolo civic_serve SOLO queste due (grant in scripts/setup_readonly.ts).

create table if not exists meta.test_question (
  id            text primary key,
  tema          text,
  domanda       text,
  comune        text,
  codice_istat  text,
  risposta      text,
  fonti         jsonb,
  stato         text default 'auto',   -- da_verificare | auto | verificato | corretto | scartato
  verificatore  text,
  note          text,
  data_verifica date
);

create table if not exists meta.source_license_review (
  source             text primary key,
  license_dichiarata text,
  stato              text default 'da_verificare',  -- da_verificare | verificata
  license_verificata text,
  url                text,
  note               text,
  verificatore       text,
  data               date
);
