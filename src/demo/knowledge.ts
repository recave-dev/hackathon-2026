import type { Id } from './types'

/**
 * The angles a question can take (facets) and the scripted meetings used to
 * demo the live assistant. Cards themselves come from the company graph
 * (`src/server/graph-cards.ts`); scenario expectations name graph entity ids.
 */

export type Facet = 'cost' | 'owner' | 'deadline' | 'status' | 'history' | 'options' | 'general'

export const FACET_LABEL: Record<Facet, string> = {
  cost: 'Koszt',
  owner: 'Kto odpowiada',
  deadline: 'Termin',
  status: 'Stan',
  history: 'Historia',
  options: 'Opcje',
  general: 'Ogólnie',
}

/** English descriptions for the Jev `facet` choice question. */
export const FACET_HINT: Record<Facet, string> = {
  cost: 'How much it costs or costs us: price, monthly spend, invoices, budget, savings, salary.',
  owner: 'Who owns, approved, is responsible for, or decides about it.',
  deadline: 'When something is due, a date, a deadline, how much time is left.',
  status: 'Current state or outcome: results, KPI, progress, did it work, where we are.',
  history: 'What happened before: earlier requests, past decisions, why it was approved or rejected.',
  options: 'What alternatives are on the table, what we could do, the trade-offs.',
  general: 'A general mention with no specific angle.',
}

/** One thing somebody says in a meeting. */
export interface ScenarioLine {
  id: string
  speakerId: Id
  text: string
  /** What the assistant should show for this line, as graph entity ids; used by the demo self-check. */
  expect: { card?: string; person?: string; facet?: Facet } | null
}

/** `ambient`: every utterance is judged. `wake`: only lines addressed to Bolek are. */
export type ListeningMode = 'ambient' | 'wake'

export interface Scenario {
  id: string
  title: string
  goal: string
  participantIds: Id[]
  mode: ListeningMode
  lines: ScenarioLine[]
  /** Which company graph the assistant answers from; `aster` when omitted. */
  company?: 'aster' | 'bielsko'
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'bielsko-meetup-003',
    title: 'bielsko.ai — meetup 003',
    goal: 'Planujemy trzeci meetup: ile osób, które miejsce (NovaPatria, Kawiarnia Grunt, Cavatina Hall), statystyki 001 vs 002, grafika, strona i mail z podsumowaniem.',
    participantIds: ['p-michal', 'p-tomasz'],
    mode: 'wake',
    company: 'bielsko',
    lines: [
      { id: 'b1', speakerId: 'p-michal', text: 'Siemano, dzisiaj chcemy przegadać kolejny meetup bielsko.ai 003.', expect: null },
      { id: 'b2', speakerId: 'p-tomasz', text: 'Na 002 mieliśmy 94 zapisanych i 52 osoby na miejscu, więc na 003 celujemy w 100 osób.', expect: null },
      { id: 'b3', speakerId: 'p-michal', text: 'Bolek, znajdź 3 lokale w Bielsku, które są w stanie pomieścić tyle osób, i porównaj je w tabeli.', expect: null },
      { id: 'b4', speakerId: 'p-tomasz', text: 'Dobra, idziemy z NovaPatria. Termin: 30 października, godzina 17:00.', expect: null },
      { id: 'b5', speakerId: 'p-michal', text: 'Bolek, porównaj statystyki meetupu 001 i 002.', expect: null },
      { id: 'b6', speakerId: 'p-tomasz', text: 'Bolek, zrób grafikę na meetup 003.', expect: null },
      { id: 'b7', speakerId: 'p-michal', text: 'Bolek, zaktualizuj stronę bielsko.ai: meetup 003 w NovaPatria, 30 października o 17:00.', expect: null },
      { id: 'b8', speakerId: 'p-tomasz', text: 'Bolek, wyślij email z podsumowaniem do Tomka Kielara.', expect: null },
      { id: 'b9', speakerId: 'p-michal', text: 'Bolek, wyślij.', expect: null },
    ],
  },
  {
    id: 'aster-tools',
    title: 'Zarząd — narzędzia i pilot',
    goal: 'Koszt Pipedrive, kto zatwierdza zakupy, wynik pilota e-Doręczeń i opcje na listopad. Wszystko z grafu firmy.',
    participantIds: ['p-tomasz', 'p-michal', 'p-kasia', 'p-anna'],
    mode: 'wake',
    lines: [
      { id: 'a1', speakerId: 'p-tomasz', text: 'Dobra, zaczynamy od narzędzi sprzedażowych. Michał, jak wygląda Pipedrive?', expect: null },
      { id: 'a2', speakerId: 'p-michal', text: 'Bolek, ile płacimy za Pipedrive?', expect: { card: 'product:pipedrive', facet: 'cost' } },
      { id: 'a3', speakerId: 'p-anna', text: 'Bolek, kto to zatwierdzał?', expect: { card: 'product:pipedrive', facet: 'owner' } },
      { id: 'a4', speakerId: 'p-kasia', text: 'Bolek, a LeadBooster w końcu wzięliśmy?', expect: { card: 'decision:purchase-pipedrive-leadbooster-2025-07', facet: 'status' } },
      { id: 'a5', speakerId: 'p-tomasz', text: 'Dobrze, wracamy do tego po pilocie. Anna, e-Doręczenia.', expect: null },
      { id: 'a6', speakerId: 'p-anna', text: 'Bolek, jak wyszedł pilot e-Doręczeń?', expect: { card: 'product:edoreczenia', facet: 'status' } },
      { id: 'a7', speakerId: 'p-michal', text: 'Bolek, kim jest Karol Bąk?', expect: { person: 'person:karol-bak' } },
      { id: 'a8', speakerId: 'p-kasia', text: 'Bolek, jakie mamy opcje dla e-Doręczeń?', expect: { card: 'product:edoreczenia', facet: 'options' } },
      { id: 'a9', speakerId: 'p-tomasz', text: 'Bolek, dzięki.', expect: null },
      { id: 'a10', speakerId: 'p-tomasz', text: 'Kończymy spotkanie.', expect: null },
    ],
  },
  {
    id: 'bolek-people',
    title: 'Bolek — kto jest kim',
    goal: 'Asystent odzywa się tylko na imię. Ludzie i tematy z grafu firmy.',
    participantIds: ['p-tomasz', 'p-michal', 'p-kasia', 'p-anna'],
    mode: 'wake',
    lines: [
      { id: 'z1', speakerId: 'p-tomasz', text: 'Zanim przejdziemy do agendy: w piątek mamy warsztat z zespołem Platformy, będzie tam kilka nowych osób.', expect: null },
      { id: 'z2', speakerId: 'p-kasia', text: 'Ja tam idę, ale szczerze nie kojarzę połowy nazwisk z zaproszenia.', expect: null },
      { id: 'z3', speakerId: 'p-michal', text: 'Bolek, powiedz mi, kim jest Karol Bąk?', expect: { person: 'person:karol-bak' } },
      { id: 'z4', speakerId: 'p-kasia', text: 'Aha, czyli to on zatwierdza zakupy narzędzi. Dobrze wiedzieć.', expect: null },
      { id: 'z5', speakerId: 'p-anna', text: 'Bolek.', expect: null },
      { id: 'z6', speakerId: 'p-anna', text: 'Nad czym teraz pracuje Ewa Mazur?', expect: { person: 'person:ewa-mazur' } },
      { id: 'z7', speakerId: 'p-tomasz', text: 'Dobra, to ona pilnuje onboardingu gmin. Wracamy do agendy, Michał, koszty.', expect: null },
      { id: 'z8', speakerId: 'p-michal', text: 'Zero zmian poza jedną pozycją. Bolek, ile płacimy za Pipedrive?', expect: { card: 'product:pipedrive', facet: 'cost' } },
      { id: 'z9', speakerId: 'p-tomasz', text: 'A za co dokładnie odpowiada Piotr Kaczmarek, Bolek?', expect: { person: 'person:piotr-kaczmarek' } },
      { id: 'z10', speakerId: 'p-tomasz', text: 'OK, dzięki. Kończymy.', expect: null },
    ],
  },
  {
    id: 'bolek-notes',
    title: 'Bolek — notatki i raport',
    goal: 'Dyskusja o Beta Testing, potem prośba o punkty, raport w tle, pytanie z internetu i o dane firmy.',
    participantIds: ['p-tomasz', 'p-piotr', 'p-michal', 'p-anna'],
    mode: 'wake',
    lines: [
      { id: 'n1', speakerId: 'p-tomasz', text: 'Dobra, Beta Testing. Umowa kończy się czternastego, Piotr, gdzie jesteśmy?', expect: null },
      { id: 'n2', speakerId: 'p-piotr', text: 'Oferta jest na stole: 36 tysięcy za kwartał, dwóch testerów jak dotąd. Bez nich regresja przed wydaniem Gamma 28 listopada nie ma szans, wewnętrznie mamy jedną osobę.', expect: null },
      { id: 'n3', speakerId: 'p-michal', text: 'Trzy miesiące to 12 tysięcy miesięcznie. Pytałem ich o mniejszy zakres, jeden tester za 20 tysięcy kwartalnie, ale to nie domyka regresji.', expect: null },
      { id: 'n4', speakerId: 'p-anna', text: 'Gamma Logistics czeka na termin. Jak przesuniemy wydanie, muszę ich uprzedzić do końca tygodnia.', expect: null },
      { id: 'n5', speakerId: 'p-tomasz', text: 'Czyli przedłużamy na jeden kwartał na starych warunkach, a Piotr do czwartku sprawdza alternatywy na kolejny. Michał, potwierdzenie pisemne musi wyjść do dwunastego.', expect: null },
      { id: 'n6', speakerId: 'p-michal', text: 'Jasne, wyślę w środę. Wracając do kosztów narzędzi, tam też jest kilka rzeczy do przeglądu.', expect: null },
      { id: 'n7', speakerId: 'p-anna', text: 'Bolek, zrób punkty z tego, co przed chwilą omawialiśmy o Beta Testing.', expect: null },
      { id: 'n8', speakerId: 'p-tomasz', text: 'Bolek, przygotuj na następne spotkanie krótki raport o wydatkach na narzędzia i decyzjach zakupowych.', expect: null },
      { id: 'n9', speakerId: 'p-michal', text: 'Bolek, jaki jest dzisiaj kurs euro według NBP?', expect: null },
      { id: 'n10', speakerId: 'p-piotr', text: 'Bolek, co to właściwie są e-Doręczenia u nas?', expect: { card: 'product:edoreczenia' } },
      { id: 'n11', speakerId: 'p-tomasz', text: 'Bolek, dzięki.', expect: null },
    ],
  },
  {
    id: 'board-weekly',
    title: 'Zarząd — przegląd tygodnia',
    goal: 'Koszty narzędzi, status Alfy i umowa z podwykonawcą QA. Tryb „zawsze”: karty pojawiają się bez wołania.',
    participantIds: ['p-tomasz', 'p-michal', 'p-kasia', 'p-piotr', 'p-anna'],
    mode: 'ambient',
    lines: [
      { id: 'l1', speakerId: 'p-tomasz', text: 'Dobra, zaczynamy. Mamy trzy tematy: koszty, Alfa i Beta Testing. Michał, zacznij od kosztów.', expect: null },
      { id: 'l2', speakerId: 'p-michal', text: 'Przejrzałem subskrypcje. Większość jest bez zmian, ale jedna pozycja rośnie.', expect: null },
      { id: 'l3', speakerId: 'p-tomasz', text: 'A właściwie ile my płacimy za Pipedrive?', expect: { card: 'product:pipedrive', facet: 'cost' } },
      { id: 'l4', speakerId: 'p-kasia', text: 'Kto to w ogóle zatwierdzał i kto odpowiada za miejsca?', expect: { card: 'product:pipedrive', facet: 'owner' } },
      { id: 'l5', speakerId: 'p-michal', text: 'Ja, we wrześniu. A ten LeadBooster w końcu wzięliśmy czy nie?', expect: { card: 'decision:purchase-pipedrive-leadbooster-2025-07', facet: 'status' } },
      { id: 'l6', speakerId: 'p-tomasz', text: 'OK, wracamy do tego po przeglądzie pilota. Przejdźmy do Alfy.', expect: null },
      { id: 'l7', speakerId: 'p-anna', text: 'Marek napisał, że chcą start 15 listopada razem z wdrożeniem ERP. Jak to się ma do umowy?', expect: null },
      { id: 'l8', speakerId: 'p-piotr', text: 'Wdrożenie będzie 8 grudnia, wcześniej się nie da. Tomasz, ty z nimi rozmawiałeś.', expect: null },
      { id: 'l9', speakerId: 'p-tomasz', text: 'Tak, ustnie zgodzili się rozdzielić terminy. Anna, potrzebuję tego na piśmie.', expect: null },
      { id: 'l10', speakerId: 'p-piotr', text: 'Ostatnia rzecz: Beta Testing. Umowa nam się kończy, do kiedy musimy odpowiedzieć?', expect: null },
      { id: 'l11', speakerId: 'p-michal', text: 'I ile to nas kosztuje za kwartał?', expect: null },
      { id: 'l12', speakerId: 'p-tomasz', text: 'Dobrze, decyzję podejmę dziś po południu. Dzięki wszystkim.', expect: null },
    ],
  },
  {
    id: 'board-people-pilot',
    title: 'Zarząd — ludzie i pilot',
    goal: 'Oferta dla kandydata, wynik pilota e-Doręczenia i hosting stagingów. Tryb „zawsze”.',
    participantIds: ['p-tomasz', 'p-piotr', 'p-michal', 'p-anna'],
    mode: 'ambient',
    lines: [
      { id: 'm1', speakerId: 'p-piotr', text: 'Zanim zaczniemy: kandydat na seniora czeka na odpowiedź do szesnastej. Ile on chciał?', expect: null },
      { id: 'm2', speakerId: 'p-michal', text: 'W budżecie mamy mniej. Jakie mamy możliwości, jeśli nie damy 26 tysięcy?', expect: null },
      { id: 'm3', speakerId: 'p-tomasz', text: 'Wrócimy do tego o piętnastej. Anna, jak wyszedł pilot e-Doręczeń?', expect: { card: 'product:edoreczenia', facet: 'status' } },
      { id: 'm4', speakerId: 'p-anna', text: 'Sześć z dziesięciu. Sprzedaż mówiła o dwunastu gminach, potwierdzone były cztery.', expect: null },
      { id: 'm5', speakerId: 'p-michal', text: 'Czyli w maju zdecydowaliśmy na podstawie dwunastu. Kto to wtedy prowadził?', expect: { card: 'product:edoreczenia', facet: 'owner' } },
      { id: 'm6', speakerId: 'p-tomasz', text: 'Pogadamy o tym w czwartek na przeglądzie. Piotr, co z hostingiem stagingów, ile byśmy oszczędzili?', expect: null },
      { id: 'm7', speakerId: 'p-piotr', text: 'Trochę, ale migracja to dwa tygodnie przestoju, przed wydaniem Gamma się nie zmieści.', expect: null },
      { id: 'm8', speakerId: 'p-tomasz', text: 'To po wydaniu. Kończymy, dzięki.', expect: null },
    ],
  },
]
