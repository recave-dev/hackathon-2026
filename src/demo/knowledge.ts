import type { Id } from './types'

/**
 * Knowledge cards the live meeting assistant can put on screen, and the
 * scripted meetings used to demo it. Cards are the "answer" side of the
 * company graph flattened for a single screen; scenarios are what people say.
 *
 * Card copy is Polish (what the board sees). `hint` and `aliases` are what the
 * Jev router and the offline fallback use to recognise the topic in speech.
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

export type CardCategory = 'tool' | 'vendor' | 'client' | 'hiring' | 'infra' | 'project'

export const CATEGORY_LABEL: Record<CardCategory, string> = {
  tool: 'Narzędzie',
  vendor: 'Dostawca',
  client: 'Klient',
  hiring: 'Rekrutacja',
  infra: 'Infrastruktura',
  project: 'Projekt',
}

export interface CardFact {
  label: string
  value: string
  hint?: string
  /** Facets this figure answers; the first matching fact is shown biggest. */
  facets: Facet[]
}

export interface CardPerson {
  label: string
  personId: Id
  note: string
}

export type CardEventKind = 'approved' | 'rejected' | 'decision' | 'deadline' | 'note'

export interface CardEvent {
  at: string
  kind: CardEventKind
  title: string
  detail: string
  personId?: Id
  amount?: string
}

export interface KnowledgeCard {
  id: string
  title: string
  subtitle: string
  category: CardCategory
  /** English description used as the Jev choice criterion. */
  hint: string
  /** Lower-case Polish keywords for the offline fallback matcher. */
  aliases: string[]
  /** Answers per facet, in the CEO's words. `general` is required. */
  answers: Partial<Record<Facet, string>> & { general: string }
  facts: CardFact[]
  people: CardPerson[]
  timeline: CardEvent[]
  openItems: string[]
  sourceIds: Id[]
  /** Existing Context topic with an invoice chart. */
  contextTopicId?: Id
  decisionId?: Id
}

export const KNOWLEDGE_CARDS: KnowledgeCard[] = [
  {
    id: 'pipedrive',
    title: 'Pipedrive',
    subtitle: 'CRM · Sprzedaż i Customer Success',
    category: 'tool',
    hint: 'Pipedrive, the CRM subscription used by Sales and Customer Success: its seats, monthly price, invoices, the CFO spending cap, the rejected LeadBooster add-on and the related rejected Intercom request.',
    aliases: ['pipedrive', 'crm', 'leadbooster', 'lead booster', 'intercom', 'miejsca w crm', 'subskrypcj'],
    answers: {
      general:
        'Subskrypcję kupiono w maju, żeby śledzić pipeline pilota e-Doręczenia. Dziś 8 miejsc za 272 EUR miesięcznie, limit CFO 300 EUR.',
      cost: 'Ostatnie sześć miesięcy to 1 224 EUR w sześciu fakturach: cztery po 170 EUR (5 miejsc) i dwie po 272 EUR (8 miejsc od października). Limit CFO wynosi 300 EUR miesięcznie, zapas 28 EUR.',
      owner:
        'Wydatek zatwierdza Michał Baran (CFO): subskrypcję 15 maja z limitem 200 EUR i rozszerzenie 3 września z limitem 300 EUR. Za listę miejsc i przegląd anulowania odpowiada Katarzyna Wójcik.',
      history:
        'Maj: 5 miejsc za 170 EUR. Czerwiec: Intercom (74 EUR) odrzucony. Lipiec: dodatek LeadBooster (32,50 EUR) odrzucony, bo pilot miał jedną płatną aktywację. Wrzesień: 3 miejsca dla Customer Success, 272 EUR od października.',
      status: 'Aktywna, 8 miejsc, 272 EUR miesięcznie. Przegląd anulowania po wyniku pilota (6 z 10 aktywacji) jest zapisany, ale nie ma terminu.',
      deadline: 'Nie ma zobowiązania rocznego, rozliczenie miesięczne. Wnioski o Intercom i LeadBooster miały wrócić po przeglądzie 12 listopada.',
      options: 'Zostawić 8 miejsc, wrócić do 5 po zakończeniu onboardingu gmin, albo anulować po przeglądzie pilota. Dodatki LeadBooster i Intercom czekają na przegląd 12 listopada.',
    },
    facts: [
      { label: 'Ostatnie 6 miesięcy', value: '1 224 EUR', hint: '6 faktur, czerwiec–listopad', facets: ['cost', 'general'] },
      { label: 'Miesięcznie', value: '272 EUR', hint: '8 miejsc od 1 października', facets: ['cost', 'status'] },
      { label: 'Limit CFO', value: '300 EUR', hint: 'zapas 28 EUR', facets: ['cost', 'owner'] },
      { label: 'Odrzucone dodatki', value: '2', hint: 'Intercom 74 EUR, LeadBooster 32,50 EUR', facets: ['history', 'options'] },
    ],
    people: [
      { label: 'Zatwierdza wydatki', personId: 'p-michal', note: 'Zatwierdził subskrypcję 15 maja (limit 200 EUR) i rozszerzenie 3 września (limit 300 EUR).' },
      { label: 'Odpowiada za subskrypcję', personId: 'p-kasia', note: 'Właścicielka listy miejsc i przeglądu anulowania po wyniku pilota.' },
      { label: 'Korzysta', personId: 'p-ola', note: 'Trzy miejsca Customer Success od 1 października.' },
    ],
    timeline: [
      { at: '2026-05-15', kind: 'approved', title: 'Pipedrive Advanced, 5 miejsc', detail: 'Wniosek Kasi z 14 maja. Limit 200 EUR, start 1 czerwca razem z pilotem.', personId: 'p-michal', amount: '170 EUR / mies.' },
      { at: '2026-06-10', kind: 'rejected', title: 'Intercom Essential (inny produkt, ten sam kanał)', detail: 'Wniosek Oli odrzucony: gminy korzystają ze skrzynki helpdesku; powrót po 10 płatnych aktywacjach.', personId: 'p-michal', amount: '74 EUR / mies.' },
      { at: '2026-07-08', kind: 'rejected', title: 'Dodatek Pipedrive LeadBooster', detail: 'Odrzucony: jedna płatna aktywacja, a dodatek celuje w leady przychodzące. Powrót po przeglądzie 12 listopada.', personId: 'p-michal', amount: '32,50 EUR / mies.' },
      { at: '2026-09-03', kind: 'approved', title: 'Trzy miejsca dla Customer Success', detail: 'Osiem miejsc od 1 października, nowy limit 300 EUR.', personId: 'p-michal', amount: '272 EUR / mies.' },
    ],
    openItems: [
      'Przegląd anulowania po wyniku pilota (6 z 10 aktywacji), właścicielka Kasia, bez terminu.',
      'Wnioski o Intercom i LeadBooster miały wrócić po przeglądzie 12 listopada.',
    ],
    sourceIds: ['src-pd-request', 'src-pd-approval', 'src-intercom-request', 'src-leadbooster-request', 'src-pd-seats', 'src-pd-inv-11'],
    contextTopicId: 'ctx-pipedrive',
    decisionId: 'dec-edoreczenia',
  },
  {
    id: 'alfa',
    title: 'Wdrożenie Alfa',
    subtitle: 'Klient · start produkcyjny i integracja ERP',
    category: 'client',
    hint: 'Alfa, the customer implementation project: go-live date, the ERP integration promised in the contract (§4), the product roadmap date of 8 December, the customer email asking for 15 November, and the extra training request.',
    aliases: ['alfa', 'alfy', 'alfą', 'marek lis', 'integracj', 'erp', 'start produkcyjny', 'szkoleni', 'ewa kot'],
    answers: {
      general:
        'Alfa oczekuje startu 15 listopada razem z integracją ERP. Umowa (§4) wiąże integrację ze startem, a plan produktu daje gotowość dopiero 8 grudnia. Rozmowa z Markiem: start podstawowych funkcji 15 listopada, integracja 8 grudnia, do potwierdzenia na piśmie.',
      deadline:
        'Trzy daty: 15 listopada start podstawowych funkcji (Alfa), 8 grudnia gotowość integracji ERP (plan produktu, Piotr), a umowa z 2 czerwca w §4 wiąże integrację ze startem produkcyjnym. Ustne uzgodnienie z Markiem rozdziela te terminy; brak potwierdzenia pisemnego.',
      owner: 'Po stronie Droker właścicielką wdrożenia jest Anna Nowak (PM), integrację prowadzi Piotr Zieliński (CTO). Po stronie Alfy decyduje Marek Lis (COO), IT prowadzi Ewa Kot.',
      status: 'Konflikt terminów z maila z 3 listopada został ustnie wyjaśniony: start 15 listopada bez integracji, integracja 8 grudnia. Alfa chce dodatkowego szkolenia; Anna przygotuje harmonogram. Otwarte: rozliczenie szkolenia.',
      history: 'Umowa 2 czerwca (§4: integracja przy starcie). Plan produktu 20 października (integracja 8 grudnia). Mail Marka 3 listopada (start 15 listopada z integracją). Rozmowa CEO z Markiem: rozdzielenie terminów.',
      cost: 'Szkolenie dodatkowe nie ma jeszcze wyceny ani decyzji, czy jest w cenie wdrożenia, czy płatne osobno. To otwarta sprawa do decyzji.',
      options: 'Szkolenie w cenie wdrożenia (relacja) albo płatne osobno (marża). Integracja: dotrzymać 8 grudnia albo negocjować aneks do §4.',
    },
    facts: [
      { label: 'Start podstawowych funkcji', value: '15 lis', hint: 'oczekiwanie Alfy, uzgodnione ustnie', facets: ['deadline', 'general', 'status'] },
      { label: 'Integracja ERP', value: '8 gru', hint: 'plan produktu Q4', facets: ['deadline', 'general'] },
      { label: 'Umowa §4', value: 'ERP przy starcie', hint: 'podpisana 2 czerwca', facets: ['history', 'options'] },
      { label: 'Szkolenie', value: 'bez wyceny', hint: 'w cenie czy płatne?', facets: ['cost', 'options'] },
    ],
    people: [
      { label: 'Odpowiada za wdrożenie', personId: 'p-anna', note: 'Przygotowuje harmonogram szkolenia do jutra.' },
      { label: 'Integracja ERP', personId: 'p-piotr', note: 'Właściciel planu produktu; gotowość 8 grudnia.' },
      { label: 'Decyduje po stronie Alfy', personId: 'p-marek', note: 'COO Alfy; autor maila z 3 listopada.' },
      { label: 'IT Alfy', personId: 'p-ewa', note: 'Odbiór integracji po stronie klienta.' },
    ],
    timeline: [
      { at: '2026-06-02', kind: 'note', title: 'Umowa wdrożeniowa, §4', detail: 'Integracja z ERP uruchomiona wraz ze startem produkcyjnym.' },
      { at: '2026-10-20', kind: 'decision', title: 'Plan produktu Q4', detail: 'Integracja ERP dla Alfy gotowa 8 grudnia. Start podstawowych funkcji możliwy wcześniej.', personId: 'p-piotr' },
      { at: '2026-11-03', kind: 'deadline', title: 'Mail Alfy: start 15 listopada z integracją', detail: 'Marek Lis prosi o potwierdzenie startu zgodnie z umową.', personId: 'p-marek' },
      { at: '2026-11-10', kind: 'note', title: 'Rozmowa CEO z Markiem', detail: 'Ustnie: start 15 listopada, integracja 8 grudnia, dodatkowe szkolenie. Do potwierdzenia na piśmie.', personId: 'p-tomasz' },
    ],
    openItems: [
      'Potwierdzenie pisemne od Alfy: start 15 listopada bez integracji, integracja 8 grudnia.',
      'Decyzja: szkolenie w cenie czy dodatkowo płatne.',
      'Harmonogram szkolenia (Anna, do jutra).',
    ],
    sourceIds: ['src-alfa-contract', 'src-alfa-roadmap', 'src-alfa-email'],
    decisionId: 'dec-alfa-training',
  },
  {
    id: 'beta-testing',
    title: 'Beta Testing',
    subtitle: 'Podwykonawca QA · umowa ramowa',
    category: 'vendor',
    hint: 'Beta Testing, the external QA subcontractor: the framework contract ending 14 November, the 36,000 PLN per quarter price, the two-business-day written notice rule, and the Gamma release on 28 November that depends on their two testers.',
    aliases: ['beta testing', 'bety', 'betą', 'qa', 'tester', 'podwykonawc', 'regresj', 'gamma'],
    answers: {
      general:
        'Umowa ramowa z Beta Testing kończy się 14 listopada. Przedłużenie na dotychczasowych warunkach to 36 000 zł za kwartał. Bez ich dwóch testerów regresja przed wydaniem Gamma 28 listopada nie ma szans.',
      cost: '36 000 zł za kwartał na dotychczasowych warunkach, czyli 12 000 zł miesięcznie za dwóch testerów. Beta proponuje też rozmowę o nowym zakresie.',
      deadline: 'Umowa kończy się 14 listopada. Przedłużenie wymaga pisemnego potwierdzenia najpóźniej 2 dni robocze wcześniej, czyli do czwartku 12 listopada. Wydanie Gamma: 28 listopada.',
      owner: 'Ocenę oferty i alternatyw prowadzi Piotr Zieliński (CTO), termin 11 listopada. Decyzja należy do CEO.',
      status: 'Oferta przedłużenia z 2 listopada czeka na odpowiedź. Piotr ocenia alternatywy do 11 listopada. Wewnętrznie mamy jednego testera.',
      history: 'Umowa ramowa podpisana 14 listopada 2025 na rok. 2 listopada Beta wysłała ofertę przedłużenia. 6 listopada Piotr na Slacku: bez dwóch testerów regresja 28 listopada nie ma szans.',
      options: 'Przedłużyć na kwartał (36 000 zł, bezpieczne wydanie), negocjować mniejszy zakres, albo nie przedłużać i przesunąć wydanie Gamma.',
    },
    facts: [
      { label: 'Koniec umowy', value: '14 lis', hint: 'pisemne potwierdzenie do 12 lis', facets: ['deadline', 'general'] },
      { label: 'Przedłużenie', value: '36 000 zł', hint: 'za kwartał, 2 testerów', facets: ['cost', 'general', 'options'] },
      { label: 'Wydanie Gamma', value: '28 lis', hint: 'regresja wymaga 2 testerów', facets: ['deadline', 'status'] },
      { label: 'Testerzy wewnętrzni', value: '1', hint: 'wg Piotra, #gamma-delivery', facets: ['status', 'options'] },
    ],
    people: [
      { label: 'Ocenia ofertę', personId: 'p-piotr', note: 'Ocena oferty Beta Testing i alternatyw do 11 listopada.' },
      { label: 'Decyduje', personId: 'p-tomasz', note: 'Decyzja o przedłużeniu umowy ramowej.' },
      { label: 'Budżet', personId: 'p-michal', note: 'Kwartalny koszt 36 000 zł w budżecie Gamma.' },
    ],
    timeline: [
      { at: '2025-11-14', kind: 'note', title: 'Umowa ramowa, pkt 9', detail: 'Przedłużenie wymaga pisemnego potwierdzenia 2 dni robocze przed końcem okresu.' },
      { at: '2026-11-02', kind: 'note', title: 'Oferta przedłużenia', detail: 'Dotychczasowe warunki (36 000 zł / kwartał) albo nowy zakres.', amount: '36 000 zł / kw.' },
      { at: '2026-11-06', kind: 'note', title: '#gamma-delivery', detail: 'Piotr: bez dwóch testerów z Bety regresja przed 28 listopada nie ma szans. Wewnętrznie jedna osoba.', personId: 'p-piotr' },
      { at: '2026-11-12', kind: 'deadline', title: 'Ostatni dzień na potwierdzenie', detail: '2 dni robocze przed 14 listopada.' },
    ],
    openItems: ['Ocena alternatyw (Piotr, 11 listopada).', 'Pisemne potwierdzenie przedłużenia do 12 listopada.'],
    sourceIds: ['src-qa-email', 'src-qa-slack', 'src-qa-contract'],
    decisionId: 'dec-qa-vendor',
  },
  {
    id: 'senior-backend',
    title: 'Senior backend — oferta',
    subtitle: 'Rekrutacja · Zespół Platformy',
    category: 'hiring',
    hint: 'The senior backend developer candidate: expects 26,000 PLN gross on an employment contract versus 23,000 PLN in the budget, has a competing offer, and wants an answer today by 16:00.',
    aliases: ['kandydat', 'senior', 'backend', 'rekrutac', 'oferta dla', 'pensj', 'wynagrodzeni', 'joanna kruk'],
    answers: {
      general: 'Kandydat oczekuje 26 000 zł brutto na umowie o pracę wobec 23 000 zł w budżecie. Ma drugą ofertę i czeka na decyzję do dziś, 16:00.',
      cost: '26 000 zł brutto miesięcznie wobec 23 000 zł w budżecie zespołu Platformy, czyli 3 000 zł miesięcznie i 36 000 zł rocznie ponad plan. Start od 1 grudnia.',
      deadline: 'Odpowiedź do dziś, wtorek 10 listopada, godz. 16:00. Kandydat ma drugą ofertę.',
      owner: 'Rekrutację prowadzi Joanna Kruk. Ocena techniczna: Piotr Zieliński (najlepszy z pięciu). Budżet: Michał Baran. Decyzja: CEO.',
      status: 'Czekamy z odpowiedzią. Piotr: technicznie najlepszy z pięciu; gdyby odpadł, sourcing zajmie realnie 6–8 tygodni.',
      history: 'Budżet etatu ustalony 15 stycznia (23 000 zł, start 1 grudnia). 6 listopada rekruterka przekazała oczekiwania kandydata. 7 listopada Piotr ocenił go jako najlepszego z pięciu.',
      options: 'Zaakceptować 26 000 zł, zaproponować 23 000 zł plus podwyżka po okresie próbnym, albo odpuścić i wrócić do sourcingu (6–8 tygodni).',
    },
    facts: [
      { label: 'Oczekiwanie', value: '26 000 zł', hint: 'brutto, UoP', facets: ['cost', 'general'] },
      { label: 'Budżet', value: '23 000 zł', hint: 'etat od 1 grudnia', facets: ['cost', 'options'] },
      { label: 'Odpowiedź do', value: 'dziś 16:00', hint: 'kandydat ma drugą ofertę', facets: ['deadline', 'general', 'status'] },
      { label: 'Alternatywa', value: '6–8 tyg.', hint: 'powrót do sourcingu', facets: ['options', 'status'] },
    ],
    people: [
      { label: 'Ocena techniczna', personId: 'p-piotr', note: 'Najlepszy z pięciu kandydatów.' },
      { label: 'Budżet', personId: 'p-michal', note: 'Etat senior backend 23 000 zł brutto.' },
      { label: 'Decyduje', personId: 'p-tomasz', note: 'Odpowiedź dla kandydata do 16:00.' },
    ],
    timeline: [
      { at: '2026-01-15', kind: 'note', title: 'Budżet zespołu Platformy', detail: 'Etat senior backend: 23 000 zł brutto, start 1 grudnia.', personId: 'p-michal' },
      { at: '2026-11-06', kind: 'note', title: 'Rekruter: oczekiwania kandydata', detail: '26 000 zł brutto na UoP. Druga oferta, decyzja do wtorku 16:00.' },
      { at: '2026-11-07', kind: 'note', title: '#hiring', detail: 'Piotr: technicznie najlepszy z pięciu. Bez niego sourcing 6–8 tygodni.', personId: 'p-piotr' },
      { at: '2026-11-10', kind: 'deadline', title: 'Odpowiedź dla kandydata', detail: 'Dziś, godz. 16:00.' },
    ],
    openItems: ['Odpowiedź dla kandydata do 16:00.'],
    sourceIds: ['src-cand-email', 'src-cand-slack', 'src-budget'],
    decisionId: 'dec-senior-offer',
  },
  {
    id: 'hosting',
    title: 'Hosting stagingów',
    subtitle: 'Infrastruktura · migracja środowisk testowych',
    category: 'infra',
    hint: 'The staging environments hosting migration offer: an estimated saving of 1,800 PLN per month, a two-week migration with test-environment downtime.',
    aliases: ['hosting', 'staging', 'stagingów', 'środowisk', 'migracj', 'chmur', 'serwer'],
    answers: {
      general: 'Oferta z 28 października: migracja środowisk stagingowych z oszczędnością 1 800 zł miesięcznie. Migracja trwa 2 tygodnie z przestojem środowisk testowych.',
      cost: 'Oszczędność szacowana na 1 800 zł miesięcznie, czyli 21 600 zł rocznie. Koszt ukryty: 2 tygodnie przestoju środowisk testowych.',
      deadline: 'Oferta nie ma terminu ważności. Realny problem to okno migracji: 2 tygodnie przestoju nie mieszczą się przed wydaniem Gamma 28 listopada.',
      owner: 'Infrastrukturę prowadzi Piotr Zieliński (CTO). Oszczędność liczy Michał Baran (CFO).',
      status: 'Sprawa odłożona, czeka na wolne okno po wydaniu Gamma.',
      history: 'Oferta migracji przyszła 28 października. Nie było jeszcze decyzji.',
      options: 'Migrować w grudniu po wydaniu Gamma, negocjować migrację bez przestoju, albo zostać u obecnego dostawcy.',
    },
    facts: [
      { label: 'Oszczędność', value: '1 800 zł', hint: 'miesięcznie, 21 600 zł rocznie', facets: ['cost', 'general'] },
      { label: 'Migracja', value: '2 tyg.', hint: 'z przestojem środowisk testowych', facets: ['deadline', 'status', 'options'] },
      { label: 'Najbliższe okno', value: 'po 28 lis', hint: 'po wydaniu Gamma', facets: ['deadline', 'options'] },
    ],
    people: [
      { label: 'Infrastruktura', personId: 'p-piotr', note: 'Ocena ryzyka przestoju i okna migracji.' },
      { label: 'Oszczędność', personId: 'p-michal', note: '1 800 zł miesięcznie w budżecie infrastruktury.' },
    ],
    timeline: [{ at: '2026-10-28', kind: 'note', title: 'Oferta migracji', detail: 'Oszczędność 1 800 zł miesięcznie; migracja 2 tygodnie z przestojem środowisk testowych.', amount: '−1 800 zł / mies.' }],
    openItems: ['Ustalić okno migracji po wydaniu Gamma.'],
    sourceIds: ['src-hosting-offer'],
    decisionId: 'dec-hosting',
  },
  {
    id: 'edoreczenia',
    title: 'Konektor e-Doręczenia',
    subtitle: 'Projekt · pilot z partnerem ConnectorCo',
    category: 'project',
    hint: 'The e-Doręczenia (Polish electronic delivery) connector project: the May decision to run a partner pilot with ConnectorCo instead of building in-house, the KPI of 10 paid activations in six months, and the November result of 6 activations.',
    aliases: ['e-doręczenia', 'edoręczenia', 'e-doreczenia', 'doręczeń', 'konektor', 'pilot', 'connectorco', 'aktywacj', 'gmin'],
    answers: {
      general: 'W maju zarząd wybrał pilot z partnerem ConnectorCo zamiast budowy własnej. KPI: 10 płatnych aktywacji w 6 miesięcy. Wynik z 5 listopada: 6 aktywacji.',
      status: 'Pilot zamknął się wynikiem 6 płatnych aktywacji wobec celu 10. Sprzedaż mówiła o 12 zainteresowanych gminach; potwierdzone były 4 zapytania. Lekcja zapisana przy decyzji.',
      cost: 'Pilot z partnerem: 6 tygodni wdrożenia zamiast 16 tygodni budowy własnej. Koszty pośrednie: Pipedrive na pipeline pilota (1 224 EUR w 6 miesięcy).',
      owner: 'Właścicielką pilota jest Anna Nowak. Decyzję podjął zarząd 12 maja. Pipeline prowadzi Katarzyna Wójcik.',
      deadline: 'Pilot trwał od czerwca do listopada. Wynik KPI zaimportowano 5 listopada. Przegląd i kolejna decyzja: 12 listopada.',
      history: '12 maja: decyzja o pilocie z partnerem (build vs partner vs wait). Sprzedaż: 12 zainteresowanych, potwierdzone 4. 5 listopada: 6 płatnych aktywacji.',
      options: 'Kontynuować z partnerem, przejąć konektor do własnej budowy, albo zamknąć temat. Do przeglądu 12 listopada.',
    },
    facts: [
      { label: 'Płatne aktywacje', value: '6 / 10', hint: 'wynik z 5 listopada', facets: ['status', 'general'] },
      { label: 'Decyzja', value: '12 maja', hint: 'pilot z partnerem ConnectorCo', facets: ['history', 'general'] },
      { label: 'Czas wdrożenia', value: '6 tyg.', hint: 'zamiast 16 tyg. własnej budowy', facets: ['cost', 'options'] },
      { label: 'Przegląd', value: '12 lis', hint: 'kolejna decyzja', facets: ['deadline', 'options'] },
    ],
    people: [
      { label: 'Właścicielka pilota', personId: 'p-anna', note: 'Odpowiada za wdrożenie z ConnectorCo i KPI.' },
      { label: 'Pipeline sprzedaży', personId: 'p-kasia', note: 'Nazwany pipeline pilota w Pipedrive.' },
      { label: 'Decyzja', personId: 'p-tomasz', note: 'Zarząd, 12 maja 2026.' },
    ],
    timeline: [
      { at: '2026-05-12', kind: 'decision', title: 'Spotkanie zarządu: pilot z partnerem', detail: 'Właściciel: Anna Nowak. KPI: 10 płatnych aktywacji w 6 miesięcy.', personId: 'p-tomasz' },
      { at: '2026-11-05', kind: 'note', title: 'Import KPI: aktywacje.csv', detail: 'Płatne aktywacje: 6; cel: 10.' },
      { at: '2026-11-12', kind: 'deadline', title: 'Przegląd pilota', detail: 'Kolejna decyzja: kontynuować, przejąć, zamknąć.' },
    ],
    openItems: ['Przegląd pilota i kolejna decyzja 12 listopada.', 'Przegląd anulowania Pipedrive po wyniku pilota.'],
    sourceIds: ['src-edo-meeting', 'src-edo-kpi', 'src-edo-sales'],
    decisionId: 'dec-edoreczenia',
  },
]

export const cardById = (id: string | null | undefined): KnowledgeCard | undefined =>
  id ? KNOWLEDGE_CARDS.find((c) => c.id === id) : undefined

/** One thing somebody says in a meeting. */
export interface ScenarioLine {
  id: string
  speakerId: Id
  text: string
  /** What the assistant should do for this line; used by the demo self-check. */
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
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'bolek-people',
    title: 'Bolek — kto jest kim',
    goal: 'Asystent odzywa się tylko na imię. Ludzie z kart, reszta z grafu firmy.',
    participantIds: ['p-tomasz', 'p-michal', 'p-kasia', 'p-anna'],
    mode: 'wake',
    lines: [
      { id: 'z1', speakerId: 'p-tomasz', text: 'Zanim przejdziemy do agendy: w piątek mamy warsztat z zespołem Platformy, będzie tam kilka nowych osób.', expect: null },
      { id: 'z2', speakerId: 'p-kasia', text: 'Ja tam idę, ale szczerze nie kojarzę połowy nazwisk z zaproszenia.', expect: null },
      { id: 'z3', speakerId: 'p-michal', text: 'Bolek, powiedz mi, kim jest Darek Wylon?', expect: { person: 'darek-wylon' } },
      { id: 'z4', speakerId: 'p-kasia', text: 'Aha, czyli to on prowadzi rekrutację seniora. Dobrze wiedzieć.', expect: null },
      { id: 'z5', speakerId: 'p-anna', text: 'Bolek.', expect: null },
      { id: 'z6', speakerId: 'p-anna', text: 'Nad czym teraz pracuje Patrycja?', expect: { person: 'patrycja-sowa' } },
      { id: 'z7', speakerId: 'p-tomasz', text: 'Dobra, to ona pilnuje potwierdzenia od Alfy. Wracamy do agendy, Michał, koszty.', expect: null },
      { id: 'z8', speakerId: 'p-michal', text: 'Zero zmian poza jedną pozycją. Bolek, ile płacimy za Pipedrive?', expect: { card: 'pipedrive', facet: 'cost' } },
      { id: 'z9', speakerId: 'p-tomasz', text: 'A za co dokładnie odpowiada Piotr, Bolek?', expect: { person: 'piotr-zielinski' } },
      { id: 'z10', speakerId: 'p-tomasz', text: 'OK, dzięki. Kończymy.', expect: null },
    ],
  },
  {
    id: 'board-weekly',
    title: 'Zarząd — przegląd tygodnia',
    goal: 'Koszty narzędzi, status Alfy i umowa z podwykonawcą QA.',
    participantIds: ['p-tomasz', 'p-michal', 'p-kasia', 'p-piotr', 'p-anna'],
    mode: 'ambient',
    lines: [
      { id: 'l1', speakerId: 'p-tomasz', text: 'Dobra, zaczynamy. Mamy trzy tematy: koszty, Alfa i Beta Testing. Michał, zacznij od kosztów.', expect: null },
      { id: 'l2', speakerId: 'p-michal', text: 'Przejrzałem subskrypcje. Większość jest bez zmian, ale jedna pozycja rośnie.', expect: null },
      { id: 'l3', speakerId: 'p-tomasz', text: 'A właściwie ile my płacimy za Pipedrive?', expect: { card: 'pipedrive', facet: 'cost' } },
      { id: 'l4', speakerId: 'p-kasia', text: 'Kto to w ogóle zatwierdzał i kto odpowiada za miejsca?', expect: { card: 'pipedrive', facet: 'owner' } },
      { id: 'l5', speakerId: 'p-michal', text: 'Ja, we wrześniu. A ten LeadBooster w końcu wzięliśmy czy nie?', expect: { card: 'pipedrive', facet: 'history' } },
      { id: 'l6', speakerId: 'p-tomasz', text: 'OK, wracamy do tego po przeglądzie pilota. Przejdźmy do Alfy.', expect: null },
      { id: 'l7', speakerId: 'p-anna', text: 'Marek napisał, że chcą start 15 listopada razem z integracją ERP. Jak to się ma do umowy?', expect: { card: 'alfa', facet: 'deadline' } },
      { id: 'l8', speakerId: 'p-piotr', text: 'Integracja będzie 8 grudnia, wcześniej się nie da. Tomasz, ty z nimi rozmawiałeś.', expect: null },
      { id: 'l9', speakerId: 'p-tomasz', text: 'Tak, ustnie zgodzili się rozdzielić terminy. Anna, potrzebuję tego na piśmie.', expect: null },
      { id: 'l10', speakerId: 'p-piotr', text: 'Ostatnia rzecz: Beta Testing. Umowa nam się kończy, do kiedy musimy odpowiedzieć?', expect: { card: 'beta-testing', facet: 'deadline' } },
      { id: 'l11', speakerId: 'p-michal', text: 'I ile to nas kosztuje za kwartał?', expect: { card: 'beta-testing', facet: 'cost' } },
      { id: 'l12', speakerId: 'p-tomasz', text: 'Dobrze, decyzję podejmę dziś po południu. Dzięki wszystkim.', expect: null },
    ],
  },
  {
    id: 'board-people-pilot',
    title: 'Zarząd — ludzie i pilot',
    goal: 'Oferta dla kandydata, wynik pilota e-Doręczenia i hosting stagingów.',
    participantIds: ['p-tomasz', 'p-piotr', 'p-michal', 'p-anna'],
    mode: 'ambient',
    lines: [
      { id: 'm1', speakerId: 'p-piotr', text: 'Zanim zaczniemy: kandydat na seniora czeka na odpowiedź do szesnastej. Ile on chciał?', expect: { card: 'senior-backend', facet: 'cost' } },
      { id: 'm2', speakerId: 'p-michal', text: 'W budżecie mamy mniej. Jakie mamy opcje, jeśli nie damy 26 tysięcy?', expect: { card: 'senior-backend', facet: 'options' } },
      { id: 'm3', speakerId: 'p-tomasz', text: 'Wrócimy do tego o piętnastej. Anna, jak wyszedł pilot e-Doręczeń?', expect: { card: 'edoreczenia', facet: 'status' } },
      { id: 'm4', speakerId: 'p-anna', text: 'Sześć z dziesięciu. Sprzedaż mówiła o dwunastu gminach, potwierdzone były cztery.', expect: null },
      { id: 'm5', speakerId: 'p-michal', text: 'Czyli w maju zdecydowaliśmy na podstawie dwunastu. Kto to wtedy prowadził?', expect: { card: 'edoreczenia', facet: 'owner' } },
      { id: 'm6', speakerId: 'p-tomasz', text: 'Pogadamy o tym w czwartek na przeglądzie. Piotr, co z hostingiem stagingów, ile byśmy oszczędzili?', expect: { card: 'hosting', facet: 'cost' } },
      { id: 'm7', speakerId: 'p-piotr', text: 'Trochę, ale migracja to dwa tygodnie przestoju, przed wydaniem Gamma się nie zmieści.', expect: null },
      { id: 'm8', speakerId: 'p-tomasz', text: 'To po wydaniu. Kończymy, dzięki.', expect: null },
    ],
  },
]
