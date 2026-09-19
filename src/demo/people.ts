import type { Id } from './types'

/**
 * Hardcoded people profiles the assistant can answer "who is X" with.
 * Demo data: edit freely. `hint` is what Jev sees, `aliases` feed the offline
 * matcher (lower-case, include Polish declensions and first-name-only forms).
 */

export interface PersonFact {
  label: string
  value: string
  hint?: string
}

export interface PersonItem {
  title: string
  detail: string
  /** Knowledge card this item relates to, if any. */
  cardId?: string
  /** ISO date for recent activity. */
  at?: string
}

export interface PersonCard {
  id: string
  name: string
  role: string
  team: string
  /** Seed person id when the profile maps onto the demo graph. */
  personId?: Id
  hint: string
  aliases: string[]
  /** Two or three sentences a board member would want to hear first. */
  summary: string
  facts: PersonFact[]
  /** What they own right now. */
  owns: string[]
  /** Current projects and open threads. */
  current: PersonItem[]
  /** Recent decisions, tasks or messages. */
  recent: PersonItem[]
  /** Practical notes: availability, how to reach, working style. */
  notes: string[]
  sourceIds: Id[]
}

export const PEOPLE_CARDS: PersonCard[] = [
  {
    id: 'darek-wylon',
    name: 'Darek Wylon',
    role: 'Head of Platform Engineering',
    team: 'Zespół Platformy · Bielsko-Biała',
    hint: 'Darek (Dariusz) Wylon, Head of Platform Engineering: owns the platform team, infrastructure, staging environments and the hiring of backend engineers.',
    aliases: ['darek', 'darka', 'darkiem', 'darku', 'dariusz', 'dariusza', 'wylon', 'wylona', 'wylonem'],
    summary:
      'Darek prowadzi zespół Platformy od stycznia 2024: sześć osób, infrastruktura, środowiska stagingowe i wspólne biblioteki dla Alfy i Gammy. W tym kwartale odpowiada za migrację hostingu stagingów i rekrutację seniora backend. Raportuje do Piotra.',
    facts: [
      { label: 'W firmie od', value: '2021', hint: 'Head of Platform od stycznia 2024' },
      { label: 'Zespół', value: '6 osób', hint: '4 backend, 1 DevOps, 1 QA' },
      { label: 'Aktywne sprawy', value: '2', hint: 'hosting stagingów, senior backend' },
      { label: 'Raportuje do', value: 'Piotr Z.', hint: 'CTO' },
    ],
    owns: ['Infrastruktura i środowiska stagingowe', 'Wspólne biblioteki platformy (auth, integracje ERP)', 'Rekrutacja inżynierów backend', 'Dyżury on-call zespołu Platformy'],
    current: [
      { title: 'Migracja hostingu stagingów', detail: 'Ocenia ofertę z 28 października: 1 800 zł oszczędności miesięcznie, 2 tygodnie przestoju. Rekomenduje okno po wydaniu Gamma.', cardId: 'hosting' },
      { title: 'Rekrutacja: senior backend', detail: 'Prowadził rozmowy techniczne z pięcioma kandydatami; wskazał najlepszego. Odpowiedź dla kandydata do dziś 16:00.', cardId: 'senior-backend' },
      { title: 'Integracja ERP dla Alfy', detail: 'Biblioteka integracyjna gotowa na 8 grudnia; zespół Platformy dostarcza warstwę wspólną, wdrożenie robi zespół Alfy.', cardId: 'alfa' },
    ],
    recent: [
      { at: '2026-11-07', title: '#hiring', detail: 'Rekomendacja kandydata na seniora: technicznie najlepszy z pięciu.' },
      { at: '2026-11-04', title: 'Przegląd infrastruktury Q4', detail: 'Koszty chmury bez zmian; propozycja migracji stagingów po wydaniu Gamma.' },
      { at: '2026-10-20', title: 'Plan produktu Q4', detail: 'Potwierdził gotowość biblioteki ERP na 8 grudnia.' },
    ],
    notes: ['Najlepiej łapać go rano, popołudnia ma zablokowane na pracę z zespołem.', 'Urlop planowany 21–28 grudnia; zastępuje go Piotr.'],
    sourceIds: ['src-cand-slack', 'src-hosting-offer', 'src-alfa-roadmap'],
  },
  {
    id: 'piotr-zielinski',
    name: 'Piotr Zieliński',
    role: 'CTO',
    team: 'Zarząd · Technologia',
    personId: 'p-piotr',
    hint: 'Piotr Zieliński, the CTO: owns the product roadmap, engineering budget and vendor decisions such as the Beta Testing QA contract; technical assessment of hires.',
    aliases: ['piotr', 'piotra', 'piotrem', 'piotrze', 'zieliński', 'zielińskiego', 'zielinski', 'cto'],
    summary:
      'Piotr jest CTO od założenia firmy i odpowiada za plan produktu, budżet inżynierii i decyzje o dostawcach. Teraz prowadzi ocenę oferty Beta Testing (termin 11 listopada) i pilnuje wydania Gamma 28 listopada. Zespoły Platformy, Alfy i Gammy raportują do niego.',
    facts: [
      { label: 'W firmie od', value: '2019', hint: 'współzałożyciel' },
      { label: 'Zespoły', value: '3', hint: 'Platforma, Alfa, Gamma · 19 osób' },
      { label: 'Aktywne sprawy', value: '3', hint: 'Beta Testing, Gamma, senior backend' },
      { label: 'Najbliższy termin', value: '11 lis', hint: 'ocena oferty Beta Testing' },
    ],
    owns: ['Plan produktu i terminy wydań', 'Budżet inżynierii i dostawcy techniczni', 'Ocena techniczna kandydatów', 'Architektura i bezpieczeństwo'],
    current: [
      { title: 'Beta Testing: przedłużenie umowy', detail: 'Ocena oferty i alternatyw do 11 listopada. Bez dwóch testerów regresja przed 28 listopada nie ma szans.', cardId: 'beta-testing' },
      { title: 'Wydanie Gamma 28 listopada', detail: 'Regresja wymaga dwóch testerów zewnętrznych; wewnętrznie jedna osoba.', cardId: 'beta-testing' },
      { title: 'Senior backend', detail: 'Ocena: najlepszy z pięciu. Decyzja płacowa należy do CEO.', cardId: 'senior-backend' },
    ],
    recent: [
      { at: '2026-11-07', title: '#hiring', detail: 'Technicznie najlepszy z pięciu. Gdyby odpadł, sourcing 6–8 tygodni.' },
      { at: '2026-11-06', title: '#gamma-delivery', detail: 'Bez dwóch testerów z Bety regresja przed wydaniem 28 listopada nie ma szans.' },
      { at: '2026-10-20', title: 'Plan produktu Q4', detail: 'Integracja ERP dla Alfy: gotowość 8 grudnia.' },
    ],
    notes: ['Decyzje o dostawcach przygotowuje z Michałem (CFO).', 'W czwartki od 14:00 przegląd architektury, wtedy nie odbiera.'],
    sourceIds: ['src-qa-slack', 'src-cand-slack', 'src-alfa-roadmap'],
  },
  {
    id: 'patrycja-sowa',
    name: 'Patrycja Sowa',
    role: 'Head of Delivery',
    team: 'Wdrożenia · Alfa i Gamma',
    hint: 'Patrycja Sowa, Head of Delivery: owns customer implementations (Alfa, Gamma Logistics), project managers, customer commitments, training and go-live dates.',
    aliases: ['patrycja', 'patrycję', 'patrycji', 'patrycją', 'patrycje', 'sowa', 'sowy', 'sową', 'head of delivery'],
    summary:
      'Patrycja odpowiada za wdrożenia u klientów i zespół project managerów, w tym Annę prowadzącą Alfę. Dziś pilnuje potwierdzenia od Alfy: start 15 listopada bez integracji, integracja 8 grudnia, oraz zakresu dodatkowego szkolenia. Raportuje do CEO.',
    facts: [
      { label: 'W firmie od', value: '2022', hint: 'Head of Delivery od marca 2025' },
      { label: 'Zespół', value: '4 PM', hint: 'Anna Nowak prowadzi Alfę' },
      { label: 'Klienci', value: 'Alfa, Gamma', hint: '2 aktywne wdrożenia' },
      { label: 'Najbliższy termin', value: '15 lis', hint: 'start podstawowych funkcji Alfa' },
    ],
    owns: ['Wdrożenia u klientów i terminy startów', 'Zobowiązania wobec klientów (umowy, aneksy)', 'Szkolenia użytkowników', 'Zespół project managerów'],
    current: [
      { title: 'Alfa: potwierdzenie terminów na piśmie', detail: 'Ustne uzgodnienie z Markiem Lisem (start 15 listopada, integracja 8 grudnia) czeka na potwierdzenie.', cardId: 'alfa' },
      { title: 'Alfa: dodatkowe szkolenie', detail: 'Anna przygotuje harmonogram do jutra; otwarta decyzja, czy szkolenie jest w cenie.', cardId: 'alfa' },
      { title: 'Gamma: wydanie 28 listopada', detail: 'Koordynuje odbiór po stronie Gamma Logistics; zależy od regresji Bety.', cardId: 'beta-testing' },
    ],
    recent: [
      { at: '2026-11-10', title: 'Spotkanie z Alfą 11:00', detail: 'Cel: uzgodnić termin startu, zakres wydania i plan integracji ERP.' },
      { at: '2026-11-03', title: 'Mail Alfy', detail: 'Marek Lis oczekuje startu 15 listopada wraz z integracją.' },
      { at: '2026-06-02', title: 'Umowa wdrożeniowa Alfa', detail: 'Podpisana; §4 wiąże integrację ERP ze startem produkcyjnym.' },
    ],
    notes: ['Preferuje krótkie decyzje na piśmie po spotkaniu; sama wysyła podsumowania do klientów.', 'Wtorki i czwartki spędza u klientów, wtedy odpowiada z opóźnieniem.'],
    sourceIds: ['src-alfa-email', 'src-alfa-contract', 'src-alfa-roadmap'],
  },
]

export const personCardById = (id: string | null | undefined): PersonCard | undefined =>
  id ? PEOPLE_CARDS.find((p) => p.id === id) : undefined
