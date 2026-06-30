// Tool di revisione (i 2 task umani in chat): firma delle risposte test + verifica licenze-fonte.
// Scrivono su meta.test_question / meta.source_license_review (il ruolo civic_serve ha write solo qui).
import { sql } from './db'

export async function domandeDaVerificare() {
  return sql`select id, tema, domanda, comune, risposta, stato from meta.test_question where stato in ('auto', 'da_verificare') order by id`
}

export async function firmaRisposta(id: string, esito: string, risposta_corretta?: string, note?: string, verificatore?: string) {
  const stato = ['verificato', 'corretto', 'scartato'].includes(esito) ? esito : 'verificato'
  const [r] = await sql`
    update meta.test_question
    set stato = ${stato}, risposta = coalesce(${risposta_corretta ?? null}, risposta),
        note = ${note ?? null}, verificatore = ${verificatore ?? 'utente'}, data_verifica = current_date
    where id = ${id} returning id, stato, verificatore`
  return r ?? { errore: 'id non trovato: ' + id }
}

export async function fontiDaVerificare() {
  return sql`select source, license_dichiarata, stato, note from meta.source_license_review where stato = 'da_verificare' order by source`
}

export async function verificaLicenza(source: string, esito: string, license?: string, note?: string, verificatore?: string) {
  const stato = esito === 'verificata' ? 'verificata' : 'da_verificare'
  const [r] = await sql`
    update meta.source_license_review
    set stato = ${stato}, license_verificata = coalesce(${license ?? null}, license_verificata),
        note = ${note ?? null}, verificatore = ${verificatore ?? 'utente'}, data = current_date
    where source = ${source} returning source, stato, license_verificata`
  return r ?? { errore: 'fonte non trovata: ' + source }
}
