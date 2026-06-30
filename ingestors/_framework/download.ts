// Browser UA: some Italian gov endpoints (ANAC WAF) block generic clients.
const UA = 'Mozilla/5.0 (civic-superagents data ingestor)'

export async function fetchBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status} ${r.statusText}`)
  return Buffer.from(await r.arrayBuffer())
}

export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status} ${r.statusText}`)
  return (await r.json()) as T
}
