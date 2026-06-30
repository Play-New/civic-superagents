import { sql } from './env'

export interface Fonte {
  source: string
  dataset_id: string
  titolo?: string
  url: string
  snapshot_date: string
  storage_path?: string
  formato?: string
  license?: string
  latest_usable_year?: number
  granularita?: string
  note_path?: string
  quirks?: string
}

// Inserts (or refreshes) the provenance row. Returns meta.fonti.id — the citation anchor.
export async function recordFonte(f: Fonte): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    insert into meta.fonti
      (source, dataset_id, titolo, url, snapshot_date, storage_path, formato, license, latest_usable_year, granularita, note_path, quirks)
    values
      (${f.source}, ${f.dataset_id}, ${f.titolo ?? null}, ${f.url}, ${f.snapshot_date}, ${f.storage_path ?? null},
       ${f.formato ?? null}, ${f.license ?? null}, ${f.latest_usable_year ?? null}, ${f.granularita ?? null}, ${f.note_path ?? null}, ${f.quirks ?? null})
    on conflict (source, dataset_id, snapshot_date) do update set
      titolo = excluded.titolo, url = excluded.url, storage_path = excluded.storage_path,
      formato = excluded.formato, license = excluded.license, latest_usable_year = excluded.latest_usable_year,
      granularita = excluded.granularita, note_path = excluded.note_path, quirks = excluded.quirks, ingested_at = now()
    returning id`
  return rows[0].id
}
