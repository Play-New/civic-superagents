// Entry HTTP (Streamable HTTP) per il deploy su Railway. Mirror del pattern luma-mcp/mcp-personio.
// Intero endpoint POST /mcp dietro bearer token (MCP_AUTH_TOKEN). /health per il healthcheck.
import express, { type Request, type Response } from 'express'
import { timingSafeEqual } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createServer } from './server'

const PORT = Number(process.env.PORT ?? 3000)
const MCP_PATH = '/mcp'
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN?.trim()

// Confronto a tempo costante (evita timing leak). Solo header Authorization: Bearer —
// niente token in query string (finirebbe in access log / proxy / cronologia).
function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

function authorized(req: Request): boolean {
  if (!AUTH_TOKEN) return true // se non impostato, aperto (solo dev)
  const h = req.header('authorization')
  const bearer = h?.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : undefined
  return !!bearer && safeEq(bearer, AUTH_TOKEN)
}

const app = express()
app.use(express.json({ limit: '1mb' }))

app.post(MCP_PATH, async (req: Request, res: Response) => {
  if (!authorized(req)) {
    res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized: token mancante o non valido.' }, id: null })
    return
  }
  const server = createServer()
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  res.on('close', () => { void transport.close(); void server.close() })
  try {
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  } catch (err) {
    console.error('mcp handler error:', err)
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error.' }, id: null })
  }
})

app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok', service: 'civic-mcp' }))

app.listen(PORT, () => console.log(`civic MCP server in ascolto su http://localhost:${PORT}${MCP_PATH}`))
