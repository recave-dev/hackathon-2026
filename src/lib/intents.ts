/**
 * What Jev decides about a request addressed to Bolek, in one fast call.
 * Person lookups, company facts and screen commands are handled without the
 * agent: the graph answers in milliseconds. Notes and web lookups go straight
 * to their tool. Only "produce" requests and the rest reach the agent loop.
 * Shared by server and client, so it must stay free of server-only imports.
 */

export type Intent = 'person' | 'ui_close' | 'ui_background' | 'ui_open' | 'ui_present' | 'ui_scroll_up' | 'ui_scroll_down' | 'ui_send' | 'ask_company' | 'ask_meeting' | 'ask_web' | 'produce' | 'ask'

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
    hint: 'Asks to open, show or start a presentation, slides or a deck, and says so: "otwórz prezentację o budżecie", "pokaż slajdy z przeglądu kwartału", "odpal prezentację Alfa". Showing a web page, landing page, screenshot, chart or data is produce or ask_company.',
    label: 'Otwieram prezentację',
  },
  { id: 'ui_scroll_up', hint: 'Tells the assistant to scroll the screen up / go back to what was shown before: "przesuń w górę", "scroll do góry", "przewiń wyżej", "wróć wyżej", "pokaż poprzednią odpowiedź".', label: 'Przewijam w górę' },
  { id: 'ui_scroll_down', hint: 'Tells the assistant to scroll the screen down / forward to the newer answer: "przesuń w dół", "scroll na dół", "przewiń niżej", "wróć na dół", "do najnowszej odpowiedzi".', label: 'Przewijam w dół' },
  {
    id: 'ui_send',
    hint: 'Only confirms sending the email the assistant has already prepared: "wyślij", "wysyłaj", "możesz wysłać", "ok, wyślij to". A request that names a recipient or says what to write ("wyślij maila do Tomka z podsumowaniem") is a new email to draft: choose produce.',
    label: 'Wysyłam',
  },
  {
    id: 'ask_company',
    hint: 'A question about the company and its records: a cost, invoice, budget or price; who owns, approved or decided something; a deadline or date; a status, result or KPI; a decision and its options; a customer, vendor, product or contract. "ile płacimy za X", "kto to zatwierdził", "jak wyszedł pilot", "jakie mamy opcje".',
    label: 'Sprawdzam dane firmy',
  },
  {
    id: 'ask_meeting',
    hint: 'About this conversation itself, or notes from it: "zrób punkty z tego, co omawialiśmy", "co ustaliliśmy", "podsumuj ostatni temat", "kto co obiecał", "notatka ze spotkania", "jakie mamy zadania z dzisiaj".',
    label: 'Czytam transkrypcję',
  },
  {
    id: 'ask_web',
    hint: 'Needs fresh outside information from the internet: exchange rates, news, regulations, competitors, public facts about other companies or products, "sprawdź w internecie", "jaki jest dzisiaj kurs euro".',
    label: 'Szukam w internecie',
  },
  {
    id: 'produce',
    hint: 'Asks the assistant to make something: write or send an email or message to someone, a document or memo, a chart, a report, a screenshot of a web page, "napisz maila do X", "przygotuj raport", "narysuj wykres", "pokaż nasz landing".',
    label: 'Przygotowuję',
  },
  { id: 'ask', hint: 'Anything else: general knowledge, a definition or explanation, a calculation, small talk with the assistant.', label: 'Sprawdzam' },
]

export const intentById = (id: string | null | undefined): IntentSpec | undefined => INTENTS.find((i) => i.id === id)
