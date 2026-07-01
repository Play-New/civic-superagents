import { storage, RAW_BUCKET, SNAP } from './env'

export async function ensureBucket(): Promise<void> {
  const { data, error } = await storage.listBuckets()
  if (error) throw error
  if (!data.some((b) => b.name === RAW_BUCKET)) {
    const { error: e } = await storage.createBucket(RAW_BUCKET, { public: false })
    if (e && !/exist/i.test(e.message)) throw e
  }
}

// Lands a raw snapshot at <source>/<SNAP>/<filename>. Returns the storage path.
// SNAP (data della run, YYYY-MM-DD) makes snapshots immutable across days and matches
// meta.fonti.snapshot_date: older fonte rows keep citing unchanged bytes; a same-day re-run
// overwrites only its own snapshot (last-write-wins). filename may contain semantic subdirs.
export async function landSnapshot(
  source: string,
  filename: string,
  body: Buffer,
  contentType = 'application/octet-stream',
): Promise<string> {
  const path = `${source}/${SNAP}/${filename}`
  const { error } = await storage.from(RAW_BUCKET).upload(path, body, { upsert: true, contentType })
  if (error) throw error
  return `${RAW_BUCKET}/${path}`
}
