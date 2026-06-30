-- 0009 — classi demografiche dei comuni (Art. 156, c.1, D.Lgs. 267/2000 TUEL).
-- NB: NON è D.Lgs. 118/2011 (governa gli schemi armonizzati, non enumera le classi).
-- Base per il grafo peer-similarity ("gemelli"): popolazione × classe × regione.

insert into glossary.classe_demografica (classe, soglia_min, soglia_max, etichetta) values
  (1, 0, 499, 'meno di 500 abitanti'),
  (2, 500, 999, 'da 500 a 999'),
  (3, 1000, 1999, 'da 1.000 a 1.999'),
  (4, 2000, 2999, 'da 2.000 a 2.999'),
  (5, 3000, 4999, 'da 3.000 a 4.999'),
  (6, 5000, 9999, 'da 5.000 a 9.999'),
  (7, 10000, 19999, 'da 10.000 a 19.999'),
  (8, 20000, 59999, 'da 20.000 a 59.999'),
  (9, 60000, 99999, 'da 60.000 a 99.999'),
  (10, 100000, 249999, 'da 100.000 a 249.999'),
  (11, 250000, 499999, 'da 250.000 a 499.999'),
  (12, 500000, null, '500.000 abitanti ed oltre')
on conflict (classe) do update set soglia_min = excluded.soglia_min, soglia_max = excluded.soglia_max, etichetta = excluded.etichetta;

-- funzione: popolazione -> classe demografica (immutable)
create or replace function geo.classe_demografica(pop integer) returns integer
  language sql immutable as $$
  select case
    when pop is null then null
    when pop < 500 then 1 when pop < 1000 then 2 when pop < 2000 then 3 when pop < 3000 then 4
    when pop < 5000 then 5 when pop < 10000 then 6 when pop < 20000 then 7 when pop < 60000 then 8
    when pop < 100000 then 9 when pop < 250000 then 10 when pop < 500000 then 11 else 12 end $$;
