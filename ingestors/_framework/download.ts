import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'

// UA browser: alcune WAF gov (ANAC, esploradati) bloccano i client generici — notes/anac-appalti.md.
export const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'

// UA storico dei fetch nativi qui sotto (comportamento invariato per i chiamanti esistenti).
const FETCH_UA = 'Mozilla/5.0 (civic-superagents data ingestor)'

export async function fetchBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url, { headers: { 'User-Agent': FETCH_UA } })
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status} ${r.statusText}`)
  return Buffer.from(await r.arrayBuffer())
}

export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { 'User-Agent': FETCH_UA, Accept: 'application/json' } })
  if (!r.ok) throw new Error(`GET ${url} -> ${r.status} ${r.statusText}`)
  return (await r.json()) as T
}

// Fetch via curl: alcuni host gov (esploradati, ANAC) 500ano su Node/undici ma servono curl.
// Sempre: --fail, -L (redirect), -g (globoff, URL SDMX con '[]'), UA browser, retry con sleep 2s.
export type CurlOpts = {
  headers?: string[][] // es. [['Accept', 'application/json'], ['Referer', '...']]
  retries?: number // default 3 (=> 4 tentativi totali, come i loop ISTAT storici)
  rejectEmpty?: boolean // body vuoto/solo-whitespace = tentativo fallito (quirk ISTAT "200 con 0 byte")
  maxBufferMb?: number // default 256
  data?: string // body POST passato a curl --data ('@file' supportato)
}

const isBlank = (b: Buffer) => b.every((x) => x === 32 || x === 9 || x === 10 || x === 13)

function curlRetry(url: string, extra: string[], opts: CurlOpts, isEmpty: (out: Buffer) => boolean): Buffer {
  const retries = opts.retries ?? 3
  const args = ['-sSL', '--fail', '-g', '-A', UA]
  for (const [k, v] of opts.headers ?? []) args.push('-H', `${k}: ${v}`)
  if (opts.data != null) args.push('-X', 'POST', '--data', opts.data)
  args.push(...extra, url)
  for (let attempt = 1; ; attempt++) {
    try {
      const out = execFileSync('curl', args, { maxBuffer: (opts.maxBufferMb ?? 256) * 1024 * 1024 })
      // quirk esploradati: query rotta -> "200 con 0 byte" (notes/istat-welfare.md) -> tratta come fallimento e riprova
      if (opts.rejectEmpty && isEmpty(out)) throw new Error(`risposta vuota (quirk "200 con 0 byte", es. ISTAT esploradati): ${url}`)
      return out
    } catch (e) {
      if (attempt > retries) throw e
      console.log(`  curl fallito (tentativo ${attempt}), retry: ${url}`)
      execFileSync('sleep', ['2'])
    }
  }
}

export function curlText(url: string, opts: CurlOpts = {}): string {
  return curlRetry(url, [], opts, isBlank).toString('utf8')
}

export function curlBuf(url: string, opts: CurlOpts = {}): Buffer {
  return curlRetry(url, [], opts, isBlank)
}

// Per zip multi-GB: scrive su disco (curl -o), niente buffer in memoria.
export function curlToFile(url: string, destPath: string, opts: CurlOpts = {}): void {
  curlRetry(url, ['-o', destPath], opts, () => statSync(destPath).size === 0)
}
