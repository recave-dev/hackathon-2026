import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildPersonCard, buildTopicCard, graphCatalog } from '../src/server/graph-cards.ts'
import { openGraph } from '../src/server/graph-answer.ts'

const g = openGraph()

test('cost card sums the invoices and names the approver, without a language model', () => {
  const card = buildTopicCard(g, 'product:pipedrive', 'cost')
  assert.ok(card)
  assert.equal(card.spend?.total, 1224)
  assert.equal(card.spend?.currency, 'EUR')
  assert.equal(card.spend?.count, 6)
  assert.match(card.headline, /1\s?224 EUR/)
  assert.match(card.answer, /^Łącznie 1\s?224 EUR za 6 faktur od czerwca 2025 do listopada 2025/)
  assert.ok(card.people.some((p) => p.label === 'Zatwierdza' && p.name === 'Karol Bąk'))
  assert.ok(card.people.some((p) => p.label === 'Właściciel' && p.name === 'Tomasz Nowak'))
  assert.ok(card.citations.length > 0)
  assert.ok(card.latencyMs < 200)
})

test('owner and options facets read the graph edges', () => {
  const owner = buildTopicCard(g, 'product:pipedrive', 'owner')
  assert.equal(owner?.headline, 'Tomasz Nowak')
  const options = buildTopicCard(g, 'product:edoreczenia', 'options')
  assert.ok(options)
  assert.equal(options.options.length, 6)
  assert.equal(options.options.find((o) => o.selected)?.label, 'Partner with ConnectorCo')
  const status = buildTopicCard(g, 'product:edoreczenia', 'status')
  assert.equal(status?.headline, '6 z 10')
})

test('a decision card knows its status and history', () => {
  const card = buildTopicCard(g, 'decision:purchase-pipedrive-leadbooster-2025-07', 'status')
  assert.equal(card?.headline, 'odrzucona')
  assert.match(card!.answer, /8 lipca 2025/)
  assert.ok(card!.open.some((o) => o.includes('12 listopada 2025')))
})

test('person card lists what the person approves and the topics behind it', () => {
  const card = buildPersonCard(g, 'person:karol-bak')
  assert.ok(card)
  assert.equal(card.role, 'Finance Lead')
  assert.equal(card.owns.filter((o) => o.startsWith('Zatwierdza')).length, 4)
  assert.deepEqual(card.topics.map((t) => t.label).sort(), ['Intercom', 'Pipedrive'])
  assert.ok(card.citations.length > 0)
})

test('unknown ids and hints', () => {
  assert.equal(buildTopicCard(g, 'product:nope', 'cost'), null)
  assert.equal(buildPersonCard(g, 'product:pipedrive'), null)
  const catalog = graphCatalog(g)
  const pipedrive = catalog.topics.find((t) => t.id === 'product:pipedrive')!
  assert.match(pipedrive.hint, /^Product or tool "Pipedrive"/)
  assert.ok(pipedrive.aliases.includes('pipedrive crm'))
})
