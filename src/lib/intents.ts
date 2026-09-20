/**
 * What Jev decides about a request addressed to Bolek, in one fast call.
 * Person lookups and screen commands are handled without the agent; everything
 * else goes to the agent, which picks its own tools. Shared by server and
 * client, so it must stay free of server-only imports.
 */

export type Intent = 'person' | 'ui_close' | 'ui_background' | 'ui_open' | 'ui_present' | 'ui_scroll_up' | 'ui_scroll_down' | 'ui_send' | 'ask'

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
  {
    id: 'ui_present',
    hint: 'Asks to open, show or start a presentation, slides or a deck, and says so: "otwórz prezentację o budżecie", "pokaż slajdy z przeglądu kwartału", "odpal prezentację Alfa". Showing a web page, landing page, screenshot, chart or data is ask.',
    label: 'Otwieram prezentację',
  },
  { id: 'ui_scroll_up', hint: 'Tells the assistant to scroll the screen up / go back to what was shown before: "przesuń w górę", "scroll do góry", "przewiń wyżej", "wróć wyżej", "pokaż poprzednią odpowiedź".', label: 'Przewijam w górę' },
  { id: 'ui_scroll_down', hint: 'Tells the assistant to scroll the screen down / forward to the newer answer: "przesuń w dół", "scroll na dół", "przewiń niżej", "wróć na dół", "do najnowszej odpowiedzi".', label: 'Przewijam w dół' },
  {
    id: 'ui_send',
    hint: 'Only confirms sending the email the assistant has already prepared: "wyślij", "wysyłaj", "możesz wysłać", "ok, wyślij to". A request that names a recipient or says what to write ("wyślij maila do Tomka z podsumowaniem") is a new email to draft: choose ask.',
    label: 'Wysyłam',
  },
  {
    id: 'ask',
    hint: 'Any other request or question: company facts, numbers, notes from the conversation, drafting an email or document, a chart, a report, a screenshot of a web page, the internet, general knowledge.',
    label: 'Sprawdzam',
  },
]

export const intentById = (id: string | null | undefined): IntentSpec | undefined => INTENTS.find((i) => i.id === id)
