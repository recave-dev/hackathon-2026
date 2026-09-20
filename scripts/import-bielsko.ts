import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { KnowledgeGraph } from '../src/graph/index.ts'
import type { SourceDocument } from '../src/graph/types.ts'

/**
 * Builds the bielsko.ai company graph from `knowledge/bielsko/`: every Markdown
 * document is indexed for search, and the entities the demo relies on (venues,
 * meetups, people, the open venue decision) are seeded deterministically.
 *
 *   bun run import:bielsko
 */

const ROOT = 'knowledge/bielsko'
const DB = process.env.GRAPH_DB_BIELSKO ?? `${ROOT}/bielsko-ai.sqlite`

for (const suffix of ['', '-shm', '-wal']) if (existsSync(DB + suffix)) rmSync(DB + suffix)
const g = new KnowledgeGraph(DB)

const frontmatter = (content: string, path: string): { id: string; date: string } => {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const field = (key: string) => m?.[1]?.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim()
  const id = field('id')
  const date = field('date')
  if (!id || !date) throw new Error(`Missing id or date in ${path}`)
  return { id, date }
}

const GROUPS: { dir: string; kind: SourceDocument['kind'] }[] = [
  { dir: '', kind: 'note' },
  { dir: 'venues', kind: 'note' },
  { dir: 'emails', kind: 'email' },
  { dir: 'meetups', kind: 'meeting_note' },
  { dir: 'slack', kind: 'slack' },
]

let documents = 0
let chunks = 0
for (const { dir, kind } of GROUPS) {
  const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.md')).sort()
  for (const file of files) {
    const rel = dir ? `${dir}/${file}` : file
    const content = readFileSync(join(ROOT, rel), 'utf8')
    const { id, date } = frontmatter(content, rel)
    const res = g.indexDocument({ id, path: `${ROOT}/${rel}`, kind, content, authoredAt: date })
    documents++
    chunks += res.chunks.length
  }
}
// The Luma export as a searchable KPI document.
const csv = readFileSync(join(ROOT, 'kpis/luma.csv'), 'utf8')
g.indexDocument({ id: 'luma-kpis-2026', path: `${ROOT}/kpis/luma.csv`, kind: 'kpi', content: `# Luma statistics\n\n${csv}`, authoredAt: '2026-06-18' })
documents++

type Seed = Parameters<KnowledgeGraph['seedNode']>[0]
const node = (n: Seed) => g.seedNode({ ...n, reviewStatus: 'reviewed' })

node({ id: 'org:bielsko-ai', kind: 'organization', label: 'bielsko.ai', aliases: ['Bielsko AI', 'bielsko ai', 'społeczność bielsko.ai'], attributes: { role: 'company', type: 'AI community, Bielsko-Biała', website: 'https://bielsko.ai', registration: 'Luma (lu.ma/bielsko-ai)', organizers: 'Michał Staśkiewicz, Tomasz Kielar' } })
node({ id: 'person:michal-staskiewicz', kind: 'person', label: 'Michał Staśkiewicz', aliases: ['Michal Staskiewicz', 'mikoscz', 'Michał'], attributes: { email: 'mikoscz@bielsko.ai', role: 'Co-organizer: program, speakers, website' } })
node({ id: 'person:tomasz-kielar', kind: 'person', label: 'Tomasz Kielar', aliases: ['k1eu', 'Tomek Kielar', 'Tomek'], attributes: { email: 'k1eu@bielsko.ai', role: 'Co-organizer: venue, partners, budget' } })

node({ id: 'org:novapatria', kind: 'organization', label: 'NovaPatria', aliases: ['Nova Patria', 'NovaPatria Bielsko'], attributes: { role: 'venue', city: 'Bielsko-Biała', address: 'ul. Cieszyńska', capacity_seated: '100', capacity_standing: '140', cost: 'free in exchange for venue-partner promotion', av: '4K projector, sound system, wireless mics, streaming possible', parking: '40 spots on site', hosted: 'bielsko.ai 001 on 2026-04-23 (cap 60, 62 going, 30 checked in)', availability_003: '2026-10-22, 2026-10-29, 2026-10-30', contact: 'Karolina Mróz, events@novapatria.pl' } })
node({ id: 'org:kawiarnia-grunt', kind: 'organization', label: 'Kawiarnia Grunt', aliases: ['Grunt', 'kawiarnia Grunt'], attributes: { role: 'venue', city: 'Bielsko-Biała', address: 'ul. Wzgórze (old town)', capacity_seated: '50', capacity_standing: '60', cost: 'minimum spend 1500 zł for the evening', av: '75-inch TV, small Bluetooth speaker, no stage or mics', parking: 'none', contact: 'Paweł Dudek' } })
node({ id: 'org:cavatina-hall', kind: 'organization', label: 'Cavatina Hall', aliases: ['Cavatina', 'sala konferencyjna Cavatina'], attributes: { role: 'venue', city: 'Bielsko-Biała', address: 'ul. Dworkowa', capacity_seated: '180', cost: '5000 zł net per evening 17:00-22:00 (offer email 2026-09-08)', av: 'professional sound, LED screen, sound engineer included; video/streaming from 1200 zł net extra', catering: 'in-house operator only, priced separately', availability_003: '2026-10-15, 2026-10-22, 2026-10-29, 2026-10-30', contact: 'Agnieszka Wolna, events@cavatinahall.example' } })
node({ id: 'org:ath-aula', kind: 'organization', label: 'Aula ATH', aliases: ['ATH', 'Akademia Techniczno-Humanistyczna'], attributes: { role: 'venue', city: 'Bielsko-Biała', capacity_seated: '200', cost: 'free (university partnership)', hosted: 'bielsko.ai 002 on 2026-06-18 (cap 100, 94 going, 52 checked in)', notes: 'academic setting limited networking: no bar, corridors' } })

node({ id: 'project:meetup-001', kind: 'project', label: 'bielsko.ai 001', aliases: ['meetup 001', 'pierwszy meetup', '001'], attributes: { date: '2026-04-23', time: '17:00-20:30', venue: 'NovaPatria', theme: 'AI agents in small companies', capacity_cap: '60 (max capacity reached)', going: '62', checked_in: '30', check_in_rate: '48%', waitlist: '16', invited: '1', source: 'Luma' } })
node({ id: 'project:meetup-002', kind: 'project', label: 'bielsko.ai 002', aliases: ['meetup 002', 'drugi meetup', '002'], attributes: { date: '2026-06-18', time: '17:30-21:00', venue: 'Aula ATH', theme: 'AI in manufacturing and logistics', capacity_cap: '100', going: '94', checked_in: '52', check_in_rate: '55%', waitlist: '0', source: 'Luma' } })
node({ id: 'project:meetup-003', kind: 'project', label: 'bielsko.ai 003', aliases: ['meetup 003', 'trzeci meetup', '003', 'kolejny meetup'], attributes: { status: 'planning', target_date: 'end of October 2026, Thursday or Friday, 17:00', expected_attendees: '100 on site (Luma cap around 150-180)', theme: 'Voice assistants and AI in meetings', candidate_venues: 'NovaPatria, Kawiarnia Grunt, Cavatina Hall', website_status: 'bielsko.ai still shows "jesień 2026, szczegóły wkrótce"' } })

node({ id: 'decision:venue-001', kind: 'decision', label: 'Venue for bielsko.ai 001: NovaPatria', aliases: [], attributes: { status: 'decided', decided_on: '2026-04-10', outcome: 'NovaPatria, free in exchange for promotion' } })
node({ id: 'decision:venue-003', kind: 'decision', label: 'Venue for bielsko.ai 003', aliases: ['miejsce meetupu 003'], attributes: { status: 'open', owner: 'Tomasz Kielar', deadline: 'end of September 2026 (NovaPatria holds dates until then)' } })
node({ id: 'option:003-novapatria', kind: 'option', label: 'Option: NovaPatria for 003', aliases: [], attributes: { capacity: '100 seated / 140 standing', cost: 'free (promotion)', pros: 'known venue, hosted 001, free, streaming, parking, dates 22/29/30 Oct', cons: '100 seated is exactly the target; standing room to 140' } })
node({ id: 'option:003-grunt', kind: 'option', label: 'Option: Kawiarnia Grunt for 003', aliases: [], attributes: { capacity: '60', cost: 'min. spend 1500 zł', pros: 'atmosphere, coffee', cons: 'too small for 100, no mics or projector' } })
node({ id: 'option:003-cavatina', kind: 'option', label: 'Option: Cavatina Hall for 003', aliases: [], attributes: { capacity: '180 seated', cost: '5000 zł net (offer 2026-09-08)', pros: 'most representative, pro AV', cons: 'only paid option, half empty at 100 people, catering only in-house' } })

const edges: [string, Parameters<KnowledgeGraph['seedEdge']>[1], string][] = [
  ['decision:venue-001', 'about', 'project:meetup-001'],
  ['decision:venue-001', 'about', 'org:novapatria'],
  ['decision:venue-001', 'considers', 'option:003-novapatria'],
  ['decision:venue-003', 'about', 'project:meetup-003'],
  ['decision:venue-003', 'considers', 'option:003-novapatria'],
  ['decision:venue-003', 'considers', 'option:003-grunt'],
  ['decision:venue-003', 'considers', 'option:003-cavatina'],
  ['option:003-novapatria', 'about', 'org:novapatria'],
  ['option:003-grunt', 'about', 'org:kawiarnia-grunt'],
  ['option:003-cavatina', 'about', 'org:cavatina-hall'],
  ['person:michal-staskiewicz', 'works_on', 'project:meetup-003'],
  ['person:tomasz-kielar', 'works_on', 'project:meetup-003'],
  ['decision:venue-003', 'assigned_to', 'person:tomasz-kielar'],
]
for (const [from, relation, to] of edges) g.seedEdge(from, relation, to)

const snap = g.getGraphSnapshot()
console.log(JSON.stringify({ db: DB, documents, chunks, nodes: snap.nodes.length, edges: snap.edges.length }, null, 2))
g.close()
