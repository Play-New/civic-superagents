import { storage, RAW_BUCKET } from './env'

export async function ensureBucket(): Promise<void> {
  const { data, error } = await storage.listBuckets()
  if (error) throw error
  if (!data.some((b) => b.name === RAW_BUCKET)) {
    const { error: e } = await storage.createBucket(RAW_BUCKET, { public: false })
    if (e && !/exist/i.test(e.message)) throw e
  }
}

// Lands an immutable snapshot at raw/<source>/<snapshot>/<filename>. Returns the storage path.
export async function landSnapshot(
  source: string,
  snapshot: string,
  filename: string,
  body: Buffer,
  contentType = 'application/octet-stream',
): Promise<string> {
  const path = `${source}/${snapshot}/${filename}`
  const { error } = await storage.from(RAW_BUCKET).upload(path, body, { upsert: true, contentType })
  if (error) throw error
  return `${RAW_BUCKET}/${path}`
}
