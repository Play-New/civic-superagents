// Helper FOIA — redige un'istanza di accesso civico generalizzato con basi normative verificate
// su Normattiva (API a.normattiva.it, CC-BY, testo vigente). L'agente redige, il cittadino firma.
// Citazioni immutabili via permalink ELI/URN.

const PERMALINK = (urn: string) => `https://www.normattiva.it/uri-res/N2Ls?${urn}`

// Base normativa verificata verbatim dall'API Normattiva (2026-06-30).
export const FOIA_NORME = [
  { ref: 'D.Lgs. 14/03/2013 n. 33, art. 5 c. 2', cosa: 'accesso civico generalizzato: chiunque ha diritto di accedere a dati e documenti ulteriori rispetto a quelli pubblicati', urn: 'urn:nir:stato:decreto.legislativo:2013-03-14;33~art5' },
  { ref: 'D.Lgs. 33/2013, art. 5 c. 3', cosa: "nessuna legittimazione né motivazione richiesta; l'istanza si presenta all'ufficio che detiene i dati, all'URP o al RPCT", urn: 'urn:nir:stato:decreto.legislativo:2013-03-14;33~art5' },
  { ref: 'D.Lgs. 33/2013, art. 5 c. 4', cosa: 'rilascio gratuito, salvo rimborso dei costi di riproduzione documentati; nessun bollo', urn: 'urn:nir:stato:decreto.legislativo:2013-03-14;33~art5' },
  { ref: 'D.Lgs. 33/2013, art. 5 c. 6', cosa: 'la PA conclude con provvedimento motivato entro 30 giorni dalla presentazione', urn: 'urn:nir:stato:decreto.legislativo:2013-03-14;33~art5' },
  { ref: 'D.Lgs. 33/2013, art. 5 c. 7', cosa: 'in caso di diniego/silenzio: riesame al RPCT, che decide con provvedimento motivato entro 20 giorni, poi ricorso al TAR (art. 116 c.p.a.)', urn: 'urn:nir:stato:decreto.legislativo:2013-03-14;33~art5' },
  { ref: 'D.Lgs. 33/2013, art. 5-bis', cosa: "esclusioni e limiti all'accesso (interessi pubblici e privati)", urn: 'urn:nir:stato:decreto.legislativo:2013-03-14;33~art5bis' },
  { ref: 'D.Lgs. 25/05/2016 n. 97 (riforma Madia)', cosa: 'ha introdotto il FOIA italiano modificando il D.Lgs. 33/2013', urn: 'urn:nir:stato:decreto.legislativo:2016-05-25;97' },
]

export function helperFoia(oggetto: string, ente?: string) {
  const dest = ente || "[ufficio che detiene i dati / URP / Responsabile della prevenzione della corruzione e della trasparenza]"
  const istanza = [
    `Oggetto: Istanza di accesso civico generalizzato (art. 5, comma 2, D.Lgs. 33/2013)`,
    ``,
    `A: ${dest}`,
    ``,
    `Il/La sottoscritto/a __________________, nato/a a __________ il __________, residente in __________, e-mail/PEC __________,`,
    ``,
    `CHIEDE`,
    ``,
    `ai sensi dell'art. 5, comma 2, del D.Lgs. 14 marzo 2013 n. 33 (come modificato dal D.Lgs. 25 maggio 2016 n. 97), di poter accedere a:`,
    ``,
    oggetto.trim(),
    ``,
    `La presente istanza non richiede motivazione (art. 5, c. 3) ed è esente da imposta di bollo. Il rilascio è gratuito, salvo il rimborso dei costi di riproduzione effettivamente sostenuti e documentati (art. 5, c. 4). Si chiede riscontro nel termine di 30 giorni (art. 5, c. 6), preferibilmente in formato elettronico al recapito indicato.`,
    ``,
    `Luogo e data __________            Firma __________`,
  ].join('\n')

  return {
    istanza,
    destinatario: 'ufficio che detiene i dati, oppure URP, oppure RPCT (art. 5, c. 3)',
    requisiti: 'nessuna legittimazione, nessuna motivazione, nessun bollo (art. 5, c. 3-4)',
    tempi: 'risposta entro 30 giorni (art. 5, c. 6)',
    costi: 'gratuito, salvo rimborso costi di riproduzione documentati (art. 5, c. 4)',
    rimedi: 'in caso di diniego o silenzio: riesame al RPCT, che decide con provvedimento motivato entro 20 giorni (art. 5, c. 7), poi ricorso al TAR ex art. 116 c.p.a.; per enti locali, in alternativa, il difensore civico (art. 5, c. 8)',
    fonti: FOIA_NORME.map((n) => `${n.ref} — ${n.cosa} [${PERMALINK(n.urn)}]`),
    disclaimer: 'Bozza generata da fonti normative pubbliche (Normattiva, CC-BY, testo vigente). Verificare l\'ufficio competente e firmare prima dell\'invio. Non costituisce consulenza legale.',
  }
}
