import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { matchDeck, parseDeck, parseSlideNumber } from '../src/lib/slides.ts'
import { focusFallback, type FocusInput } from '../src/server/focus.ts'
import { fallback } from '../src/server/relevance.ts'

const DECKS = [
  { id: 'zarzad-q3-2026', title: 'Zarząd — przegląd Q3 2026', description: 'Kwartalny przegląd dla zarządu' },
  { id: 'wdrozenie-alfa-status', title: 'Wdrożenie Alfa — status', description: 'Stan wdrożenia u klienta Alfa' },
  { id: 'budzet-2027', title: 'Budżet 2027 — pierwsza wersja', description: 'Założenia budżetu na 2027' },
]

test('built-in decks parse into titled slides', () => {
  const deck = parseDeck(readFileSync('knowledge/presentations/zarzad-q3-2026.md', 'utf8'))
  assert.equal(deck.title, 'Zarząd — przegląd Q3 2026')
  assert.equal(deck.slides.length, 7)
  assert.equal(deck.slides[0]!.title, 'Przegląd Q3 2026')
  assert.equal(deck.slides[3]!.title, 'Wdrożenia')
  assert.match(deck.slides[3]!.body, /\| Alfa \|/)
  assert.ok(deck.description.length > 10)
})

test('a deck without separators or front matter is one slide named by its heading', () => {
  const deck = parseDeck('## Tylko jeden\n\nTreść')
  assert.equal(deck.title, 'Tylko jeden')
  assert.equal(deck.slides.length, 1)
  assert.equal(deck.slides[0]!.body, 'Treść')
})

test('decks match by declined title words', () => {
  assert.equal(matchDeck('otwórz prezentację o budżecie', DECKS)?.id, 'budzet-2027')
  assert.equal(matchDeck('pokaż slajdy z wdrożenia Alfy', DECKS)?.id, 'wdrozenie-alfa-status')
  assert.equal(matchDeck('odpal przegląd kwartału dla zarządu', DECKS)?.id, 'zarzad-q3-2026')
  assert.equal(matchDeck('otwórz prezentację', DECKS), undefined)
})

test('slide numbers come from digits and Polish ordinals', () => {
  assert.equal(parseSlideNumber('slajd 3', 7), 3)
  assert.equal(parseSlideNumber('pokaż piąty slajd', 7), 5)
  assert.equal(parseSlideNumber('przejdź do slajdu numer 7', 7), 7)
  assert.equal(parseSlideNumber('slajd 12', 7), null)
  assert.equal(parseSlideNumber('to jest ciekawe', 7), null)
})

const focus: FocusInput['focus'] = { kind: 'presentation', title: 'Zarząd — przegląd Q3 2026', position: 2, total: 7, itemTitles: ['Przegląd Q3 2026', 'Sprzedaż i pipeline', 'CivicFlow 4.3', 'Wdrożenia', 'Koszty narzędzi', 'Ryzyka', 'Decyzje na dziś'] }
const judge = (text: string) => focusFallback({ text, focus }, 0)

test('offline focus commands', () => {
  assert.equal(judge('następny slajd').command, 'next')
  assert.equal(judge('dalej').command, 'next')
  assert.equal(judge('poprzedni').command, 'prev')
  assert.equal(judge('wróć').command, 'prev')
  assert.equal(judge('od początku').command, 'first')
  assert.equal(judge('ostatni slajd').command, 'last')
  assert.equal(judge('zamknij prezentację').command, 'close')
  assert.equal(judge('zamknij').command, 'close')
  assert.deepEqual([judge('slajd trzeci').command, judge('slajd trzeci').target], ['goto', 3])
  assert.deepEqual([judge('przejdź do ryzyk').command, judge('przejdź do ryzyk').target], ['goto', 6])
  assert.deepEqual([judge('pokaż koszty narzędzi').command, judge('pokaż koszty narzędzi').target], ['goto', 5])
  assert.equal(judge('to jest ciekawa liczba').command, 'none')
  assert.equal(judge('ile płacimy za Pipedrive?').command, 'none')
})

test('offline intent: opening a presentation resolves to a stored deck', () => {
  const r = fallback({ meeting: { title: 'Zarząd', goal: '', participants: [] }, recent: [{ speaker: 'Sala', text: 'otwórz prezentację o budżecie' }], mode: 'command', presentations: DECKS }, 0)
  assert.equal(r.intent.id, 'ui_present')
  assert.equal(r.presentation?.id, 'budzet-2027')
})
