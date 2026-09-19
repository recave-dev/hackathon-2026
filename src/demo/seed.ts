import type {
  Decision,
  DecisionOption,
  DemoState,
  ExtractedItem,
  Id,
  SessionState,
  TranscriptSegment,
} from './types'

export const STATE_VERSION = 3

/** Fixed demo clock: Tuesday, 10 November 2026, 09:00 (local time). */
export const DEMO_NOW = '2026-11-10T09:00:00'

export const USER_ID = 'p-tomasz'

export const PEOPLE = [
  { id: 'p-tomasz', name: 'Tomasz Kowalski', role: 'CEO', company: 'Droker' },
  { id: 'p-anna', name: 'Anna Nowak', role: 'Project Manager', company: 'Droker' },
  { id: 'p-piotr', name: 'Piotr Zieliński', role: 'CTO', company: 'Droker' },
  { id: 'p-kasia', name: 'Katarzyna Wójcik', role: 'Head of Sales', company: 'Droker' },
  { id: 'p-michal', name: 'Michał Baran', role: 'CFO', company: 'Droker' },
  { id: 'p-marek', name: 'Marek Lis', role: 'COO', company: 'Alfa' },
  { id: 'p-ewa', name: 'Ewa Kot', role: 'Kierownik IT', company: 'Alfa' },
] as const satisfies readonly DemoState['people'][number][]

export const PROJECTS = [
  { id: 'prj-alfa', name: 'Wdrożenie Alfa', client: 'Alfa' },
  { id: 'prj-gamma', name: 'Platforma Gamma', client: 'Gamma Logistics' },
  { id: 'prj-platform', name: 'Zespół Platformy' },
  { id: 'prj-infra', name: 'Infrastruktura' },
  { id: 'prj-edoreczenia', name: 'Konektor e-Doręczenia' },
] as const satisfies readonly DemoState['projects'][number][]

/** People the CEO can delegate a decision to. */
export const DELEGATE_IDS: Id[] = ['p-anna', 'p-piotr', 'p-kasia', 'p-michal']

export const SOURCES: DemoState['sources'] = [
  {
    id: 'src-alfa-contract',
    kind: 'document',
    title: 'Umowa wdrożeniowa Alfa, §4 Zakres startu',
    excerpt:
      'Integracja z systemem ERP Zamawiającego zostanie uruchomiona wraz ze startem produkcyjnym systemu.',
    date: '2026-06-02',
  },
  {
    id: 'src-alfa-roadmap',
    kind: 'document',
    title: 'Plan produktu Q4 2026',
    excerpt: 'Integracja ERP dla Alfy: gotowość 8 grudnia 2026. Start podstawowych funkcji możliwy wcześniej.',
    date: '2026-10-20',
    author: 'Piotr Zieliński',
  },
  {
    id: 'src-alfa-email',
    kind: 'email',
    title: 'Marek Lis (Alfa): Potwierdzenie terminu startu',
    excerpt: 'Liczymy na start 15 listopada razem z integracją ERP, zgodnie z umową. Prosimy o potwierdzenie.',
    date: '2026-11-03',
    author: 'Marek Lis',
  },
  {
    id: 'src-qa-email',
    kind: 'email',
    title: 'Beta Testing: Wygaśnięcie umowy ramowej',
    excerpt:
      'Obecna umowa kończy się 14 listopada. Możemy przedłużyć na dotychczasowych warunkach (36 000 zł / kwartał) lub omówić nowy zakres.',
    date: '2026-11-02',
    author: 'Beta Testing sp. z o.o.',
  },
  {
    id: 'src-qa-slack',
    kind: 'slack',
    title: '#gamma-delivery',
    excerpt:
      'Piotr: Bez dwóch testerów z Bety regresja przed wydaniem 28 listopada nie ma szans. Wewnętrznie mamy jedną osobę.',
    date: '2026-11-06',
    author: 'Piotr Zieliński',
  },
  {
    id: 'src-qa-contract',
    kind: 'document',
    title: 'Umowa ramowa Beta Testing, pkt 9',
    excerpt: 'Przedłużenie wymaga pisemnego potwierdzenia najpóźniej 2 dni robocze przed końcem okresu.',
    date: '2025-11-14',
  },
  {
    id: 'src-cand-email',
    kind: 'email',
    title: 'Rekruter: Oczekiwania kandydata (senior backend)',
    excerpt:
      'Kandydat oczekuje 26 000 zł brutto na UoP. Ma drugą ofertę i prosi o decyzję do wtorku 10 listopada, godz. 16:00.',
    date: '2026-11-06',
    author: 'Joanna Kruk (rekrutacja)',
  },
  {
    id: 'src-cand-slack',
    kind: 'slack',
    title: '#hiring',
    excerpt: 'Piotr: Technicznie najlepszy z pięciu. Gdyby odpadł, wracamy do sourcingu — realnie 6–8 tygodni.',
    date: '2026-11-07',
    author: 'Piotr Zieliński',
  },
  {
    id: 'src-budget',
    kind: 'document',
    title: 'Budżet zespołu Platformy 2026',
    excerpt: 'Etat senior backend: 23 000 zł brutto miesięcznie, start od 1 grudnia.',
    date: '2026-01-15',
    author: 'Michał Baran',
  },
  {
    id: 'src-hosting-offer',
    kind: 'email',
    title: 'Oferta migracji środowisk stagingowych',
    excerpt: 'Szacowana oszczędność 1 800 zł miesięcznie; migracja 2 tygodnie z przestojem środowisk testowych.',
    date: '2026-10-28',
  },
  {
    id: 'src-edo-meeting',
    kind: 'meeting',
    title: 'Spotkanie zarządu 12 maja 2026 — konektor e-Doręczenia',
    excerpt:
      'Decyzja: pilot z partnerem ConnectorCo. Właściciel: Anna Nowak. KPI: 10 płatnych aktywacji w 6 miesięcy.',
    date: '2026-05-12',
  },
  {
    id: 'src-edo-kpi',
    kind: 'kpi',
    title: 'aktywacje.csv — import z 5 listopada 2026',
    excerpt: '2026-11-05; konektor e-Doręczenia; płatne aktywacje: 6; cel: 10.',
    date: '2026-11-05',
  },
  {
    id: 'src-edo-sales',
    kind: 'slack',
    title: '#sales (maj 2026)',
    excerpt: 'Kasia: dwanaście gmin jest zainteresowanych konektorem.',
    date: '2026-05-04',
    author: 'Katarzyna Wójcik',
  },
]

const alfaTrainingOptions: DecisionOption[] = [
  {
    id: 'opt-a',
    label: 'A. Szkolenie w cenie',
    description: 'Dodatkowe szkolenie w ramach obecnej umowy, bez zmiany ceny.',
    consequences: {
      time: 'ok. 2 dni pracy trenera',
      cost: 'szacowany koszt wewnętrzny 1 200 zł',
      risk: 'niskie — nie wymaga zgody klienta',
    },
    execution: [
      { label: 'Zadanie dla PM (Anna): zaplanować szkolenie w ramach umowy', status: 'done' },
      { label: 'Zespół projektu Alfa poinformowany', status: 'done' },
      { label: 'Szkic potwierdzenia ustaleń dla Alfy przygotowany', status: 'done' },
      { label: 'Oczekiwanie na potwierdzenie klienta', status: 'waiting' },
    ],
  },
  {
    id: 'opt-b',
    label: 'B. Zaproponuj szkolenie płatne',
    description: 'Oferta dodatkowego szkolenia za 2 000 zł.',
    consequences: {
      time: '2–4 dni na odpowiedź klienta',
      cost: 'przychód 2 000 zł, koszt wewnętrzny 1 200 zł',
      risk: 'średnie — klient może odmówić przy napiętym harmonogramie',
    },
    requiresConsent: 'Wymaga zgody klienta (Alfa).',
    execution: [
      { label: 'Szkic oferty szkolenia (2 000 zł) przygotowany', status: 'done' },
      { label: 'PM (Anna) poinformowana o warunkach', status: 'done' },
      { label: 'Oczekiwanie na zgodę klienta', status: 'waiting' },
    ],
  },
  {
    id: 'opt-c',
    label: 'C. Poproś Annę o doprecyzowanie zakresu',
    description: 'Odłóż rozliczenie do czasu ustalenia zakresu i liczby uczestników.',
    consequences: {
      time: 'decyzja przesuwa się o 1–2 dni',
      cost: 'brak',
      risk: 'niskie — szkolenie i tak planowane po 15 listopada',
    },
    execution: [
      { label: 'Pytanie o zakres szkolenia wysłane do Anny', status: 'done' },
      { label: 'Oczekiwanie na odpowiedź Anny', status: 'waiting' },
    ],
  },
]

/** Created when the Alfa voice note is saved and forwarded. Not in the initial queue. */
export function buildAlfaTrainingDecision(
  noteId: Id,
  transcriptSourceId: Id,
  createdAt: string,
): Decision {
  return {
    id: 'dec-alfa-training',
    title: 'Rozliczenie dodatkowego szkolenia dla Alfy',
    projectId: 'prj-alfa',
    why: 'Klient potrzebuje dodatkowego szkolenia. Trzeba ustalić, czy jest w cenie umowy, czy płatne, zanim Anna wyśle harmonogram.',
    dueAt: '2026-11-12T17:00:00',
    status: 'pending',
    createdAt,
    context: [
      'Według relacji CEO Alfa akceptuje start podstawowych funkcji 15 listopada i integrację ERP 8 grudnia.',
      'Wcześniejszy konflikt terminów (umowa vs plan produktu) jest wyjaśniony ustnie — formalne potwierdzenie klienta wciąż do uzyskania.',
    ],
    facts: [
      'Umowa (§4) przewidywała integrację przy starcie produkcyjnym.',
      'Plan produktu zakłada gotowość integracji 8 grudnia.',
      'Anna przygotuje harmonogram do 11 listopada.',
    ],
    unknowns: [
      'Zakres i liczba uczestników szkolenia.',
      'Czy Alfa potwierdzi nowe terminy na piśmie.',
    ],
    assumptions: [
      'Koszt wewnętrzny szkolenia to ok. 1 200 zł (2 dni trenera) — szacunek na danych demo.',
      'Cena rynkowa podobnego szkolenia to ok. 2 000 zł — szacunek na danych demo.',
    ],
    options: alfaTrainingOptions,
    sourceIds: [transcriptSourceId, 'src-alfa-contract', 'src-alfa-roadmap', 'src-alfa-email'],
    agentPlan:
      'Po zatwierdzeniu agent utworzy zadanie dla PM, poinformuje zespół projektu i przygotuje szkic wiadomości do Alfy. Nic nie zostanie wysłane bez Twojej akceptacji.',
    questions: [],
    execution: [],
    originNoteId: noteId,
  }
}

export const INITIAL_DECISIONS: Decision[] = [
  {
    id: 'dec-senior-offer',
    title: 'Odpowiedź dla kandydata na senior backend developera',
    projectId: 'prj-platform',
    why: 'Kandydat ma drugą ofertę i czeka do dziś 16:00. Oczekuje 26 000 zł, budżet zakładał 23 000 zł.',
    dueAt: '2026-11-10T16:00:00',
    status: 'pending',
    createdAt: '2026-11-06T15:20:00',
    context: [
      'Rekrutacja trwa od września; kandydat był najlepszy technicznie z pięciu finalistów.',
      'Etat jest zaplanowany w budżecie od 1 grudnia.',
    ],
    facts: [
      'Oczekiwania kandydata: 26 000 zł brutto (UoP).',
      'Budżet: 23 000 zł brutto miesięcznie.',
      'Ponowny sourcing: 6–8 tygodni według CTO.',
    ],
    unknowns: ['Ile wynosi druga oferta kandydata.', 'Czy kandydat zaakceptuje część wynagrodzenia jako bonus.'],
    assumptions: ['Różnica 3 000 zł miesięcznie to ok. 36 000 zł rocznie — szacunek na danych demo.'],
    options: [
      {
        id: 'opt-accept',
        label: 'A. Zaakceptuj 26 000 zł',
        description: 'Oferta zgodna z oczekiwaniami, start 1 grudnia.',
        consequences: { time: 'start 1 grudnia', cost: '+36 000 zł rocznie ponad budżet', risk: 'niskie' },
        execution: [
          { label: 'Szkic oferty dla kandydata przygotowany', status: 'done' },
          { label: 'CFO poinformowany o odchyleniu od budżetu', status: 'done' },
          { label: 'Oczekiwanie na akceptację kandydata', status: 'waiting' },
        ],
      },
      {
        id: 'opt-counter',
        label: 'B. Kontroferta 24 000 zł + bonus roczny',
        description: 'Podstawa bliżej budżetu, część różnicy jako bonus za wynik.',
        consequences: { time: '1–2 dni na odpowiedź', cost: '+12 000 zł rocznie + bonus', risk: 'średnie — kandydat może wybrać drugą ofertę' },
        requiresConsent: 'Wymaga zgody kandydata.',
        execution: [
          { label: 'Szkic kontroferty przygotowany', status: 'done' },
          { label: 'Oczekiwanie na odpowiedź kandydata', status: 'waiting' },
        ],
      },
      {
        id: 'opt-decline',
        label: 'C. Podziękuj i szukaj dalej',
        description: 'Utrzymanie budżetu kosztem czasu.',
        consequences: { time: '+6–8 tygodni rekrutacji', cost: 'brak dodatkowych kosztów etatu', risk: 'wysokie — opóźnienie roadmapy Platformy' },
        execution: [
          { label: 'Szkic odpowiedzi dla rekrutera przygotowany', status: 'done' },
          { label: 'Zadanie: wznowić sourcing (CTO)', status: 'done' },
        ],
      },
    ],
    sourceIds: ['src-cand-email', 'src-cand-slack', 'src-budget'],
    agentPlan:
      'Agent przygotuje szkic odpowiedzi dla rekrutera i, jeśli trzeba, notatkę dla CFO o odchyleniu od budżetu. Wysyłka po Twojej akceptacji.',
    questions: [],
    execution: [],
  },
  {
    id: 'dec-qa-vendor',
    title: 'Przedłużenie umowy z podwykonawcą QA (Beta Testing)',
    projectId: 'prj-gamma',
    why: 'Umowa wygasa 14 listopada, a potwierdzenie musi trafić 2 dni robocze wcześniej. Bez Bety regresja przed wydaniem 28 listopada jest zagrożona.',
    dueAt: '2026-11-12T12:00:00',
    status: 'pending',
    createdAt: '2026-11-02T10:05:00',
    context: [
      'Beta Testing dostarcza dwóch testerów do projektu Gamma od roku.',
      'Wydanie Gamma 2.0 zaplanowano na 28 listopada.',
    ],
    facts: [
      'Koszt obecnej umowy: 36 000 zł / kwartał.',
      'Wewnętrznie dostępna jest jedna osoba QA.',
      'Termin pisemnego potwierdzenia: 12 listopada.',
    ],
    unknowns: ['Czy Beta zgodzi się na niższą stawkę przy krótszym okresie.'],
    assumptions: ['Rekrutacja własnego testera zajmie ok. 2 miesiące — szacunek na danych demo.'],
    options: [
      {
        id: 'opt-extend',
        label: 'A. Przedłuż na kwartał na obecnych warunkach',
        description: 'Bez negocjacji, ciągłość zespołu do wydania.',
        consequences: { time: 'natychmiast', cost: '36 000 zł', risk: 'niskie' },
        execution: [
          { label: 'Szkic potwierdzenia przedłużenia dla Bety przygotowany', status: 'done' },
          { label: 'CTO poinformowany', status: 'done' },
          { label: 'Oczekiwanie na podpis Bety', status: 'waiting' },
        ],
      },
      {
        id: 'opt-negotiate',
        label: 'B. Przedłuż o 2 miesiące i renegocjuj stawkę',
        description: 'Zabezpiecza wydanie, otwiera rozmowę o −10%.',
        consequences: { time: '3–5 dni negocjacji', cost: 'ok. 21 600 zł za 2 miesiące', risk: 'średnie — Beta może odmówić rabatu' },
        requiresConsent: 'Wymaga zgody Beta Testing.',
        execution: [
          { label: 'Szkic propozycji nowych warunków przygotowany', status: 'done' },
          { label: 'Oczekiwanie na odpowiedź Bety', status: 'waiting' },
        ],
      },
      {
        id: 'opt-end',
        label: 'C. Zakończ współpracę i przenieś QA do zespołu',
        description: 'Oszczędność kosztem terminu wydania.',
        consequences: { time: 'wydanie +2–3 tygodnie', cost: '0 zł zewnętrznie, rekrutacja ~2 mies.', risk: 'wysokie — przesunięcie Gamma 2.0' },
        execution: [
          { label: 'Zadanie dla CTO: plan przejęcia regresji', status: 'done' },
          { label: 'Szkic informacji dla Bety przygotowany', status: 'done' },
        ],
      },
    ],
    sourceIds: ['src-qa-email', 'src-qa-slack', 'src-qa-contract'],
    agentPlan:
      'Agent przygotuje szkic odpowiedzi dla Beta Testing i zaktualizuje plan wydania Gamma 2.0. Bez wysyłki do czasu akceptacji.',
    questions: [],
    execution: [],
  },
  {
    id: 'dec-hosting',
    title: 'Zmiana dostawcy hostingu środowisk stagingowych',
    projectId: 'prj-infra',
    why: 'Oferta obiecuje 1 800 zł oszczędności miesięcznie, ale migracja to 2 tygodnie przestoju testów.',
    dueAt: '2026-11-20T12:00:00',
    status: 'snoozed',
    snoozedUntil: '2026-11-17T09:00:00',
    createdAt: '2026-10-28T13:00:00',
    context: ['Środowiska stagingowe są używane przez wszystkie projekty.'],
    facts: ['Oszczędność: 1 800 zł miesięcznie według oferty.', 'Migracja: ok. 2 tygodnie.'],
    unknowns: ['Czy przestój testów da się zaplanować po wydaniu Gamma 2.0.'],
    assumptions: ['Migracja po 28 listopada nie koliduje z wydaniami — założenie.'],
    options: [
      {
        id: 'opt-migrate-dec',
        label: 'A. Migracja w grudniu',
        description: 'Po wydaniu Gamma 2.0.',
        consequences: { time: '2 tygodnie w grudniu', cost: 'oszczędność od stycznia', risk: 'niskie' },
        execution: [{ label: 'Zadanie dla CTO: plan migracji', status: 'done' }],
      },
      {
        id: 'opt-stay',
        label: 'B. Zostań u obecnego dostawcy',
        description: 'Bez zmian w tym roku.',
        consequences: { time: 'brak', cost: 'brak oszczędności', risk: 'niskie' },
        execution: [{ label: 'Oferta odrzucona, dostawca poinformowany', status: 'done' }],
      },
    ],
    sourceIds: ['src-hosting-offer'],
    agentPlan: 'Agent przygotuje plan migracji lub odpowiedź dla dostawcy.',
    questions: [],
    execution: [],
  },
  {
    id: 'dec-edoreczenia',
    title: 'Konektor e-Doręczenia: budować czy pilot z partnerem',
    projectId: 'prj-edoreczenia',
    why: 'Gminy pytały o zintegrowany obieg dokumentów przed końcem okresu przejściowego.',
    dueAt: '2026-05-12T12:00:00',
    status: 'completed',
    createdAt: '2026-04-20T09:00:00',
    decidedAt: '2026-05-12T11:30:00',
    chosenOptionId: 'opt-partner',
    rationale:
      'Szybkość wdrożenia, cztery potwierdzone zapytania klientów i możliwość sprawdzenia popytu bez angażowania dwóch inżynierów na 16 tygodni.',
    context: ['Cztery gminy przesłały zapytania mailem; sprzedaż mówiła o dwunastu zainteresowanych.'],
    facts: ['Budowa własna: 16 tygodni.', 'Partner ConnectorCo: 6 tygodni.'],
    unknowns: [],
    assumptions: ['Prognoza 10 płatnych aktywacji w 6 miesięcy — założenie z maja 2026.'],
    options: [
      {
        id: 'opt-build',
        label: 'A. Budowa własna',
        description: '16 tygodni, pełna kontrola.',
        consequences: { time: '16 tygodni', cost: '220 000 zł', risk: 'odciągnięcie inżynierów od roadmapy' },
        execution: [],
      },
      {
        id: 'opt-partner',
        label: 'B. Pilot z partnerem ConnectorCo',
        description: '6 tygodni, zależność od partnera.',
        consequences: { time: '6 tygodni', cost: '110 000 zł', risk: 'zależność od partnera' },
        execution: [],
      },
      {
        id: 'opt-postpone',
        label: 'C. Odłożyć',
        description: 'Zachowanie mocy zespołu.',
        consequences: { time: 'brak', cost: 'brak', risk: 'utracone zapytania klientów' },
        execution: [],
      },
    ],
    sourceIds: ['src-edo-meeting', 'src-edo-sales', 'src-edo-kpi'],
    agentPlan: '',
    questions: [],
    execution: [
      { id: 'ex-edo-1', label: 'Pilot uruchomiony (czerwiec 2026)', status: 'done' },
      { id: 'ex-edo-2', label: 'Przegląd po 6 miesiącach — KPI zaimportowany', status: 'done' },
    ],
    outcome: {
      metric: 'Płatne aktywacje po 6 miesiącach',
      forecast: '10',
      actual: '6',
      measuredAt: '2026-11-05T17:30:00',
      lesson:
        'Wczesne deklaracje zainteresowania przeszacowały gotowość do zakupu. Przed prognozą wymagaj nazwanych zobowiązań klientów.',
    },
  },
]

export const INITIAL_TASKS: DemoState['tasks'] = [
  {
    id: 'task-qa-eval',
    title: 'Ocena oferty Beta Testing i alternatyw',
    ownerId: 'p-piotr',
    dueAt: '2026-11-11T12:00:00',
    status: 'open',
    projectId: 'prj-gamma',
  },
]

export const INITIAL_ACTIVITIES: DemoState['activities'] = [
  {
    id: 'act-brief',
    at: '2026-11-10T08:40:00',
    actor: 'agent',
    text: 'Przygotowano briefing na spotkanie z Alfą o 11:00.',
    link: { type: 'meeting', id: 'meet-alfa' },
  },
  {
    id: 'act-qa-sources',
    at: '2026-11-10T08:15:00',
    actor: 'agent',
    text: 'Zebrano 3 źródła do sprawy podwykonawcy QA.',
    link: { type: 'decision', id: 'dec-qa-vendor' },
  },
  {
    id: 'act-kpi',
    at: '2026-11-09T17:30:00',
    actor: 'system',
    text: 'Zaimportowano wynik KPI pilota e-Doręczenia (6 z 10).',
    link: { type: 'decision', id: 'dec-edoreczenia' },
  },
]

export const INITIAL_CHANGES: DemoState['changes'] = [
  {
    id: 'ch-alfa-conflict',
    at: '2026-11-03T14:10:00',
    text: 'Alfa oczekuje integracji ERP 15 listopada. Plan produktu zakłada 8 grudnia.',
    detail: 'Sprzeczność między mailem klienta z 3 listopada a planem produktu. Do wyjaśnienia na spotkaniu o 11:00.',
    link: { type: 'meeting', id: 'meet-alfa' },
  },
  {
    id: 'ch-candidate',
    at: '2026-11-06T15:20:00',
    text: 'Kandydat na senior backend czeka na odpowiedź do dziś 16:00.',
    detail: 'Oczekiwania 26 000 zł wobec 23 000 zł w budżecie.',
    link: { type: 'decision', id: 'dec-senior-offer' },
  },
  {
    id: 'ch-pilot',
    at: '2026-11-09T17:30:00',
    text: 'Pilot e-Doręczenia: 6 płatnych aktywacji wobec celu 10.',
    detail: 'Wynik przeglądu po 6 miesiącach. Lekcja zapisana przy decyzji.',
    link: { type: 'decision', id: 'dec-edoreczenia' },
  },
]

export const INITIAL_MEETINGS: DemoState['meetings'] = [
  {
    id: 'meet-alfa',
    title: 'Alfa — przegląd statusu wdrożenia',
    at: '2026-11-10T11:00:00',
    projectId: 'prj-alfa',
    participantIds: ['p-tomasz', 'p-anna', 'p-marek', 'p-ewa'],
    goal: 'Uzgodnić termin startu i zakres pierwszego wydania oraz potwierdzić plan integracji ERP.',
    priorAgreements: [
      'Umowa z 2 czerwca: integracja ERP przy starcie produkcyjnym (§4).',
      'Plan produktu z 20 października: integracja gotowa 8 grudnia.',
      'Mail Alfy z 3 listopada: klient oczekuje startu 15 listopada wraz z integracją.',
    ],
    openIssues: [
      'Konflikt terminu integracji: 15 listopada (umowa, klient) vs 8 grudnia (plan produktu).',
      'Zakres szkoleń dla użytkowników Alfy nie został ustalony.',
    ],
    sourceIds: ['src-alfa-contract', 'src-alfa-roadmap', 'src-alfa-email'],
  },
]

/** Scripted voice note for the demo. Timestamps are seconds into the recording. */
export const SCRIPTED_TRANSCRIPT: TranscriptSegment[] = [
  { id: 'seg-1', at: 0, text: 'Rozmawiałem z Alfą.' },
  { id: 'seg-2', at: 3, text: 'Akceptują start podstawowych funkcji 15 listopada,' },
  { id: 'seg-3', at: 7, text: 'a integrację możemy dostarczyć 8 grudnia.' },
  { id: 'seg-4', at: 11, text: 'Potrzebują jeszcze dodatkowego szkolenia.' },
  { id: 'seg-5', at: 15, text: 'Anna ma przygotować harmonogram do jutra.' },
  {
    id: 'seg-6',
    at: 19,
    text: 'Nie zdecydowałem jeszcze, czy szkolenie robimy w cenie, czy dodatkowo płatnie.',
  },
]

export const SCRIPTED_SUMMARY =
  'Rozmowa z Alfą: klient akceptuje start podstawowych funkcji 15 listopada i dostarczenie integracji ERP 8 grudnia, co według relacji CEO wyjaśnia wcześniejszy konflikt terminów. Alfa potrzebuje dodatkowego szkolenia; Anna przygotuje harmonogram do jutra. Otwarte pozostaje rozliczenie szkolenia.'

export const SCRIPTED_ITEMS: ExtractedItem[] = [
  {
    id: 'item-start',
    kind: 'agreement',
    text: 'Alfa akceptuje start podstawowych funkcji 15 listopada.',
    segmentId: 'seg-2',
    included: true,
    note: 'Ustalenie ustne — do potwierdzenia przez klienta na piśmie.',
  },
  {
    id: 'item-integration',
    kind: 'agreement',
    text: 'Integracja ERP zostanie dostarczona 8 grudnia.',
    segmentId: 'seg-3',
    included: true,
    note: 'Wyjaśnia konflikt z umową (§4) według relacji CEO. Formalne potwierdzenie Alfy nadal do uzyskania.',
  },
  {
    id: 'item-training-need',
    kind: 'proposal',
    text: 'Alfa potrzebuje dodatkowego szkolenia dla użytkowników.',
    segmentId: 'seg-4',
    included: true,
    note: 'Potrzeba zgłoszona przez klienta; zakres nieustalony. To nie jest jeszcze zobowiązanie.',
  },
  {
    id: 'item-task-schedule',
    kind: 'task',
    text: 'Anna Nowak przygotuje harmonogram wdrożenia do 11 listopada.',
    segmentId: 'seg-5',
    included: true,
  },
  {
    id: 'item-decision-training',
    kind: 'decision',
    text: 'Rozliczenie dodatkowego szkolenia: w cenie umowy czy płatne dodatkowo.',
    segmentId: 'seg-6',
    included: true,
    note: 'Sam fakt rozważania opcji nie oznacza zatwierdzenia wydatku ani oferty.',
  },
  {
    id: 'item-missing-scope',
    kind: 'missing',
    text: 'Zakres, liczba uczestników i termin szkolenia.',
    segmentId: 'seg-4',
    included: true,
  },
  {
    id: 'item-missing-confirmation',
    kind: 'missing',
    text: 'Pisemne potwierdzenie nowych terminów przez Alfę.',
    segmentId: 'seg-3',
    included: true,
  },
]

export function newSessionId(): Id {
  return `session-${Math.random().toString(36).slice(2, 8)}`
}

export function createSession(mode: SessionState['mode'] = 'note'): SessionState {
  return {
    id: newSessionId(),
    mode,
    phase: 'idle',
    elapsedSec: 0,
    revealed: 0,
    summary: '',
    items: [],
  }
}

export function createSeedState(): DemoState {
  return {
    version: STATE_VERSION,
    now: DEMO_NOW,
    userId: USER_ID,
    people: [...PEOPLE],
    projects: [...PROJECTS],
    sources: structuredClone(SOURCES),
    decisions: structuredClone(INITIAL_DECISIONS),
    tasks: structuredClone(INITIAL_TASKS),
    activities: structuredClone(INITIAL_ACTIVITIES),
    changes: structuredClone(INITIAL_CHANGES),
    meetings: structuredClone(INITIAL_MEETINGS),
    notes: [],
    session: createSession(),
  }
}
