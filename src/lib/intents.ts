/**
 * What Jev decides about a request addressed to Bolek, in one fast call.
 * Person lookups and screen commands are handled without the agent; everything
 * else goes to the agent, which picks its own tools. Shared by server and
 * client, so it must stay free of server-only imports.
 */

export type Intent = 'person' | 'ui_close' | 'ui_background' | 'ui_open' | 'ui_send' | 'ask'

export interface IntentSpec {
  id: Intent
  /** English criterion for the Jev choice question. */
  hint: string
  /** Polish label shown while it runs. */
  label: string
}

export const INTENTS: IntentSpec[] = [
  { id: 'person', hint: 'Asks who a colleague is, their role, what they own or are working on, how to reach them.', label: 'Szukam osoby' },
  { id: 'ui_close', hint: 'Tells the assistant to hide, close or clear what is on the screen: "schowaj", "zamknij", "dzięki, to wszystko", "wystarczy".', label: 'Chowam' },
  { id: 'ui_background', hint: 'Tells the assistant to put the current thing aside for later / into the background / to the side: "odłóż to", "przenieś do tła", "zostaw na później", "wrócimy do tego".', label: 'Odkładam' },
  { id: 'ui_open', hint: 'Tells the assistant to bring back something it showed or prepared earlier: "otwórz raport", "pokaż tę notatkę", "wróć do wykresu", "co z tym mailem".', label: 'Otwieram' },
  { id: 'ui_send', hint: 'Confirms sending the prepared email: "wyślij", "wysyłaj", "możesz wysłać", "ok, wyślij to".', label: 'Wysyłam' },
  {
    id: 'ask',
    hint: 'Any other request or question: company facts, numbers, notes from the conversation, drafting an email or document, a chart, a report, a screenshot of a web page, the internet, general knowledge.',
    label: 'Sprawdzam',
  },
]

export const intentById = (id: string | null | undefined): IntentSpec | undefined => INTENTS.find((i) => i.id === id)
