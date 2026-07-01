import type { Sql } from 'postgres'
import { sql } from './env'

// Italian number: thousands '.', decimal ',', optional '%' suffix, space-padded; '-' / '' => null.
export function parseItNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null
  let s = String(raw).trim().replace(/%/g, '').trim()
  if (s === '' || s === '-') return null
  s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function toNum(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Dot-decimal number ('543497.18', '-10703038.52'); '' => null (unlike toNum, which makes '' = 0).
export function parseDotNumber(raw: string | null | undefined): number | null {
  const t = (raw ?? '').trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

// Normalize a comune name for joining across sources that disagree on accents vs apostrophes
// (e.g. DAIT "AGLIE'" vs geo "Agliè"): strip diacritics, drop punctuation, uppercase, collapse spaces.
export function normName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // strip combining diacritics (à->a, è->e, ...)
    .toUpperCase()
    .replace(/['’ʼ`]/g, '') // drop apostrophes entirely
    .replace(/[^A-Z0-9]+/g, ' ') // any other punctuation -> space
    .replace(/\s+/g, ' ')
    .trim()
}

export async function loadComuneSet(): Promise<Set<string>> {
  const rows = await sql<{ codice_istat: string }[]>`select codice_istat from geo.comuni`
  return new Set(rows.map((r) => r.codice_istat))
}

export async function loadComuniByProCom(): Promise<Map<number, string>> {
  const rows = await sql<{ pro_com: number; codice_istat: string }[]>`
    select pro_com, codice_istat from geo.comuni where pro_com is not null`
  const m = new Map<number, string>()
  for (const r of rows) m.set(r.pro_com, r.codice_istat)
  return m
}

// name(normalized) -> codice_istat, optionally scoped to one region to avoid cross-region name clashes.
export async function loadComuniByName(regione?: string): Promise<Map<string, string>> {
  const rows = regione
    ? await sql<{ denominazione: string; codice_istat: string }[]>`
        select denominazione, codice_istat from geo.comuni where denominazione_regione = ${regione}`
    : await sql<{ denominazione: string; codice_istat: string }[]>`
        select denominazione, codice_istat from geo.comuni`
  const m = new Map<string, string>()
  for (const r of rows) m.set(normName(r.denominazione), r.codice_istat)
  return m
}

// Chunked plain INSERT, nessuna on conflict. Prende l'handle sql come parametro
// così funziona anche dentro sql.begin (refresh atomico delete+insert).
export async function bulkInsert(
  sql: Sql,
  table: string,
  rows: Record<string, unknown>[],
  cols: string[],
  chunk = 1000,
): Promise<number> {
  let done = 0
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk)
    await sql`insert into ${sql.unsafe(table)} ${sql(slice, ...cols)}`
    done += slice.length
  }
  return done
}

// Chunked bulk upsert. `update` lists the columns to refresh on conflict.
export async function bulkUpsert(
  table: string,
  rows: Record<string, unknown>[],
  cols: string[],
  conflict: string,
  update: string[],
  chunk = 1000,
): Promise<number> {
  let done = 0
  const setClause = update.map((c) => `${c} = excluded.${c}`).join(', ')
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk)
    await sql`insert into ${sql.unsafe(table)} ${sql(slice, ...cols)}
      on conflict ${sql.unsafe(conflict)} do update set ${sql.unsafe(setClause)}`
    done += slice.length
  }
  return done
}
