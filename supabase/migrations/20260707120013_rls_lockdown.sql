-- Mette in sicurezza, per difesa-in-profondità, gli schemi dati civici abilitando RLS su ogni
-- tabella con una policy di lettura per il solo ruolo di serving.
--
-- Contesto verificato sul DB:
--   * config.toml espone all'API solo public + graphql_public; nessun grant ad anon/authenticated
--     su geo/meta/glossary/mart -> i dati civici NON sono raggiungibili via REST. Questa migrazione
--     è quindi hardening preventivo (rende innocuo un eventuale futuro "expose schema" per errore).
--   * il serving MCP legge come civic_serve (membro di civic_readonly, SENZA bypassrls); ingestion e
--     verify girano come postgres (bypassrls). Quindi RLS ON + policy di lettura per civic_readonly
--     non rompe il serving e nega di default i ruoli API.
--
-- NOTA su public.spatial_ref_sys (la tabella segnalata dall'advisor rls_disabled_in_public):
-- è una tabella di sistema PostGIS di proprietà di `supabase_admin`, NON di `postgres`. Il ruolo
-- postgres non può abilitarvi RLS né revocarne i grant ("must be owner of table spatial_ref_sys"),
-- quindi NON è correggibile da una migrazione. Va gestita lato piattaforma (Dashboard > Advisors,
-- oppure supporto Supabase). Rischio reale basso: sono dati EPSG pubblici, la anon key non è
-- pubblicata da nessuna parte in questo progetto e nessuna query usa ST_Transform/spatial_ref_sys
-- (solo ST_SetSRID/ST_Contains a SRID 4326).

-- Ruoli di serving idempotenti: garantiscono che `supabase db push` sia riproducibile su un DB nuovo
-- (setup_readonly.ts poi promuove civic_serve a login+password e assegna i grant).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'civic_readonly') then
    create role civic_readonly nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'civic_serve') then
    create role civic_serve nologin;
  end if;
end $$;

-- schemi dati civici: RLS on su ogni tabella + lettura consentita al solo ruolo di serving
do $$
declare t record;
begin
  for t in
    select schemaname, tablename
    from pg_tables
    where schemaname in ('geo', 'meta', 'glossary', 'mart')
  loop
    execute format('alter table %I.%I enable row level security', t.schemaname, t.tablename);
    execute format('drop policy if exists civic_read on %I.%I', t.schemaname, t.tablename);
    execute format(
      'create policy civic_read on %I.%I for select to civic_readonly using (true)',
      t.schemaname, t.tablename);
  end loop;
end $$;

-- 3) le due tabelle di revisione: scrittura per civic_serve (tool firma_risposta / verifica_licenza)
drop policy if exists civic_review_ins on meta.test_question;
drop policy if exists civic_review_upd on meta.test_question;
create policy civic_review_ins on meta.test_question
  for insert to civic_serve with check (true);
create policy civic_review_upd on meta.test_question
  for update to civic_serve using (true) with check (true);

drop policy if exists civic_review_ins on meta.source_license_review;
drop policy if exists civic_review_upd on meta.source_license_review;
create policy civic_review_ins on meta.source_license_review
  for insert to civic_serve with check (true);
create policy civic_review_upd on meta.source_license_review
  for update to civic_serve using (true) with check (true);
