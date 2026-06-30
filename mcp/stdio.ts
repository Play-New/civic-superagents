// Entry stdio per Claude Desktop / uso locale.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './server'

await createServer().connect(new StdioServerTransport())
console.error('civic-superagents MCP server avviato (stdio)')
