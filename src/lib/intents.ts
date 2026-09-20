/**
 * What Bolek can be asked to do. Shared by the Jev router (server), the
 * action runner (server) and the screen (client), so it must stay free of
 * server-only imports.
 */

export type Intent = 'person' | 'data' | 'meeting' | 'general' | 'web' | 'report'

export interface IntentSpec {
  id: Intent
  /** English criterion for the Jev choice question. */
  hint: string
  /** Polish label shown while the action runs. */
  label: string
  mode: 'fast' | 'background'
}

export const INTENTS: IntentSpec[] = [
  { id: 'person', hint: 'Asks who a colleague is, their role, what they own or are working on, how to reach them.', label: 'Szukam osoby', mode: 'fast' },
  {
    id: 'data',
    hint: 'Asks for a company fact recorded in our systems: costs, invoices, subscriptions, approvals, owners, dates, customers, decisions, KPIs, pilots, vendors.',
    label: 'Sprawdzam dane firmy',
    mode: 'fast',
  },
  {
    id: 'meeting',
    hint: 'Asks about this very conversation: summarise, make bullet points or notes, what was decided, action items, what someone said earlier in the meeting, recap the last topic.',
    label: 'Czytam transkrypcję',
    mode: 'fast',
  },
  {
    id: 'report',
    hint: 'Asks to prepare, write, draft or produce something longer to be used later: a report, a brief, a memo, a document, an email draft, a chart or visualisation, a plan. Work that takes a while.',
    label: 'Przygotowuję raport',
    mode: 'background',
  },
  {
    id: 'web',
    hint: 'Asks about the outside world that needs the internet: news, competitors, market or exchange rates, regulations, public companies, products, anything not in company systems and not general knowledge.',
    label: 'Szukam w internecie',
    mode: 'fast',
  },
  {
    id: 'general',
    hint: 'A general knowledge or reasoning question anyone could answer without company data or fresh news: definitions, explanations, translations, arithmetic, how-to, advice.',
    label: 'Myślę',
    mode: 'fast',
  },
]

export const intentById = (id: string | null | undefined): IntentSpec | undefined => INTENTS.find((i) => i.id === id)

