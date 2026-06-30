// Civic SuperAgents MCP server — definisce i tool civici sul data lake (transport: stdio o HTTP).
// Ogni dato risale a una riga meta.fonti (citation policy dura, CLAUDE.md §5).
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { cercaComune, resolveComune, leggiComune, progettiComune, confrontaComuni, classifica, appaltiComune } from './queries'
import { helperFoia } from './foia'
import { domandeDaVerificare, firmaRisposta, fontiDaVerificare, verificaLicenza } from './review'

const TOOLS = [
  {
    name: 'cerca_comune',
    description:
      'Cerca un comune italiano per nome (anche parziale). Restituisce i comuni corrispondenti con codice ISTAT, provincia, regione e popolazione. Usalo per disambiguare prima di leggi_comune quando il nome non è univoco.',
    inputSchema: {
      type: 'object',
      properties: { nome: { type: 'string', description: 'Nome del comune, anche parziale' } },
      required: ['nome'],
    },
  },
  {
    name: 'leggi_comune',
    description:
      "Profilo civico completo di un comune italiano, con ogni dato ancorato a una fonte pubblica citabile: ambiente (qualità aria PM10, raccolta differenziata, rischio frane/alluvioni, consumo di suolo), edilizia scolastica, bilancio per missione (es. quanto spende per istruzione o sociale), fondi di coesione e PNRR ricevuti, e chi governa (sindaco e numero di amministratori). Input: nome del comune o codice ISTAT a 6 cifre. Rispondi in italiano civico e cita sempre le fonti restituite.",
    inputSchema: {
      type: 'object',
      properties: { comune: { type: 'string', description: 'Nome del comune o codice ISTAT (6 cifre)' } },
      required: ['comune'],
    },
  },
  {
    name: 'progetti_comune',
    description: 'Elenca i progetti reali (PNRR o fondi di coesione) localizzati in un comune, ordinati per importo: titolo, importo, missione/ambito, stato. Input: comune (nome o ISTAT) e tipo (\'pnrr\' o \'coesione\').',
    inputSchema: {
      type: 'object',
      properties: {
        comune: { type: 'string', description: 'Nome del comune o codice ISTAT' },
        tipo: { type: 'string', enum: ['pnrr', 'coesione'], description: "'pnrr' (OpenPNRR) o 'coesione' (OpenCoesione)" },
        limite: { type: 'number', description: 'Max progetti (default 20, max 50)' },
      },
      required: ['comune', 'tipo'],
    },
  },
  {
    name: 'confronta_comuni',
    description: 'Confronta due comuni fianco-a-fianco sulle metriche-chiave: popolazione, classe demografica, RD%, rifiuti pro-capite, consumo di suolo, PM10, spesa pro-capite, fondi coesione/PNRR, sindaco. Input: comune_a, comune_b (nome o ISTAT).',
    inputSchema: {
      type: 'object',
      properties: {
        comune_a: { type: 'string', description: 'Primo comune (nome o ISTAT)' },
        comune_b: { type: 'string', description: 'Secondo comune (nome o ISTAT)' },
      },
      required: ['comune_a', 'comune_b'],
    },
  },
  {
    name: 'classifica',
    description: "Classifica dei comuni italiani per una metrica, opzionalmente filtrata per regione. Temi: consumo_suolo, rifiuti_rd, rifiuti_procapite, aria_pm10, spesa_procapite, frane, biblioteche. Es. 'i 10 comuni lombardi con più consumo di suolo'.",
    inputSchema: {
      type: 'object',
      properties: {
        tema: { type: 'string', description: 'consumo_suolo | rifiuti_rd | rifiuti_procapite | aria_pm10 | spesa_procapite | frane | biblioteche' },
        regione: { type: 'string', description: 'Filtra per regione (es. Lombardia); opzionale' },
        ordine: { type: 'string', enum: ['desc', 'asc'], description: "'desc' (i più alti, default) o 'asc'" },
        limite: { type: 'number', description: 'Quanti comuni (default 10, max 50)' },
      },
      required: ['tema'],
    },
  },
  {
    name: 'appalti_comune',
    description: "Appalti aggiudicati dal comune nel 2024 (ANAC): chi vince, top aggiudicatari per importo, e le gare maggiori. Risponde a 'chi prende gli appalti dal mio comune'. Solo CIG ordinari (~sopra €40k). Input: comune (nome o ISTAT).",
    inputSchema: {
      type: 'object',
      properties: {
        comune: { type: 'string', description: 'Nome del comune o codice ISTAT' },
        limite: { type: 'number', description: 'Max gare elencate (default 15, max 50)' },
      },
      required: ['comune'],
    },
  },
  {
    name: 'helper_foia',
    description:
      "Redige una bozza di istanza di accesso civico generalizzato (FOIA italiano, art. 5 c. 2 D.Lgs. 33/2013) pronta da firmare, con base normativa verificata su Normattiva e citazioni immutabili (permalink). L'agente redige, il cittadino firma. Input: 'oggetto' (cosa si chiede) e opzionale 'ente' (destinatario).",
    inputSchema: {
      type: 'object',
      properties: {
        oggetto: { type: 'string', description: 'Cosa si chiede di accedere (dati o documenti)' },
        ente: { type: 'string', description: "Destinatario, es. 'Comune di X — URP' (opzionale)" },
      },
      required: ['oggetto'],
    },
  },
  {
    name: 'domande_da_verificare',
    description: 'REVISIONE: elenca le domande del test set con risposta calcolata in attesa di firma umana (stato auto/da_verificare). Usa firma_risposta per approvarle.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'firma_risposta',
    description: "REVISIONE: firma/corregge una risposta del test set, salvandola nel database. esito: 'verificato' (ok), 'corretto' (con risposta_corretta), 'scartato'. Input: id (es. Q01), esito, opzionali risposta_corretta/note/verificatore.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID domanda (es. Q01)' },
        esito: { type: 'string', enum: ['verificato', 'corretto', 'scartato'], description: 'esito della revisione' },
        risposta_corretta: { type: 'string', description: 'risposta corretta (se esito=corretto)' },
        note: { type: 'string', description: 'note del revisore' },
        verificatore: { type: 'string', description: 'chi firma' },
      },
      required: ['id', 'esito'],
    },
  },
  {
    name: 'fonti_da_verificare',
    description: 'REVISIONE: elenca le fonti dati con licenza ancora da verificare prima della pubblicazione.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'verifica_licenza',
    description: "REVISIONE: registra l'esito della verifica licenza di una fonte. Input: source (es. dait_amministratori), esito ('verificata'), opzionali license/note/verificatore.",
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'source-id della fonte (es. dait_amministratori)' },
        esito: { type: 'string', enum: ['verificata', 'da_verificare'], description: 'esito' },
        license: { type: 'string', description: 'licenza verificata (es. CC-BY-4.0)' },
        note: { type: 'string', description: 'note' },
        verificatore: { type: 'string', description: 'chi verifica' },
      },
      required: ['source', 'esito'],
    },
  },
]

export function createServer(): Server {
  const server = new Server({ name: 'civic-superagents', version: '0.1.0' }, { capabilities: { tools: {} } })

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  const a = (args ?? {}) as Record<string, unknown>
  try {
    if (name === 'cerca_comune') {
      const rows = await cercaComune(String(a.nome ?? ''))
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] }
    }
    if (name === 'leggi_comune') {
      const istat = await resolveComune(String(a.comune ?? ''))
      if (!istat) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ errore: 'comune non trovato', suggerimento: 'usa cerca_comune per il nome esatto' }) }],
          isError: true,
        }
      }
      const profilo = await leggiComune(istat)
      return { content: [{ type: 'text', text: JSON.stringify(profilo, null, 2) }] }
    }
    if (name === 'progetti_comune') {
      const istat = await resolveComune(String(a.comune ?? ''))
      if (!istat) return { content: [{ type: 'text', text: JSON.stringify({ errore: 'comune non trovato' }) }], isError: true }
      const tipo = a.tipo === 'coesione' ? 'coesione' : 'pnrr'
      const rows = await progettiComune(istat, tipo, a.limite ? Number(a.limite) : 20)
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] }
    }
    if (name === 'confronta_comuni') {
      const [ia, ib] = await Promise.all([resolveComune(String(a.comune_a ?? '')), resolveComune(String(a.comune_b ?? ''))])
      if (!ia || !ib) return { content: [{ type: 'text', text: JSON.stringify({ errore: 'comune non trovato', a: ia, b: ib }) }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(await confrontaComuni(ia, ib), null, 2) }] }
    }
    if (name === 'classifica') {
      const r = await classifica(String(a.tema ?? ''), { regione: a.regione ? String(a.regione) : null, ordine: a.ordine === 'asc' ? 'asc' : 'desc', limite: a.limite ? Number(a.limite) : 10 })
      return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] }
    }
    if (name === 'appalti_comune') {
      const istat = await resolveComune(String(a.comune ?? ''))
      if (!istat) return { content: [{ type: 'text', text: JSON.stringify({ errore: 'comune non trovato' }) }], isError: true }
      const r = await appaltiComune(istat, a.limite ? Number(a.limite) : 15)
      return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] }
    }
    if (name === 'helper_foia') {
      const r = helperFoia(String(a.oggetto ?? ''), a.ente ? String(a.ente) : undefined)
      return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] }
    }
    if (name === 'domande_da_verificare') {
      return { content: [{ type: 'text', text: JSON.stringify(await domandeDaVerificare(), null, 2) }] }
    }
    if (name === 'firma_risposta') {
      const r = await firmaRisposta(String(a.id ?? ''), String(a.esito ?? ''), a.risposta_corretta ? String(a.risposta_corretta) : undefined, a.note ? String(a.note) : undefined, a.verificatore ? String(a.verificatore) : undefined)
      return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] }
    }
    if (name === 'fonti_da_verificare') {
      return { content: [{ type: 'text', text: JSON.stringify(await fontiDaVerificare(), null, 2) }] }
    }
    if (name === 'verifica_licenza') {
      const r = await verificaLicenza(String(a.source ?? ''), String(a.esito ?? ''), a.license ? String(a.license) : undefined, a.note ? String(a.note) : undefined, a.verificatore ? String(a.verificatore) : undefined)
      return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] }
    }
    return { content: [{ type: 'text', text: `tool sconosciuto: ${name}` }], isError: true }
  } catch (e) {
    return { content: [{ type: 'text', text: 'errore: ' + (e as Error).message }], isError: true }
  }
  })

  return server
}
