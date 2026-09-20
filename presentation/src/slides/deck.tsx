import type { ComponentType } from 'react'
import {
  ArrowRight,
  BarChart3,
  BotMessageSquare,
  Braces,
  Calendar,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  GitBranch,
  Mail,
  MessageSquare,
  Mic,
  Network,
  Quote,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  TestTube2,
  Waypoints,
  Workflow,
} from 'lucide-react'

import { Cue } from '@/components/stage'
import { CENTER_HOME, DEFAULT_HOME, type OrbHome } from '@/components/orb-pointer'
import { Bullets, Card, Mono, Pill, SlideFrame, Stat } from './ui'

export interface SlideDef {
  id: string
  /** Short label for the progress bar and the browser tab. */
  title: string
  orb?: OrbHome
  Component: ComponentType
}

/* 1 ─────────────────────────────────────────────────────────────────────── */

const Title = () => (
  <div className="slide-enter absolute inset-0 flex flex-col items-center justify-end px-24 pb-24 text-center">
    <Cue id="brand" className="flex flex-col items-center gap-4 rounded-3xl border border-transparent px-10 py-6">
      <span className="text-[13px] font-semibold tracking-[0.28em] text-accent uppercase">Hackathon 2026 · Temat #1 · Zanim zdecydujesz</span>
      <h1 className="m-0 text-[104px] leading-none font-semibold tracking-tighter">Droker</h1>
    </Cue>
    <Cue id="tagline" className="mt-2 max-w-[1100px] rounded-3xl border border-transparent px-10 py-4">
      <p className="m-0 text-[30px] leading-snug text-muted text-balance">
        Firmowy graf decyzji i asystent zarządu, który <span className="text-foreground">pamięta, co ustaliliście</span>, i sprawdza, czy to zadziałało.
      </p>
    </Cue>
  </div>
)

/* 2 ─────────────────────────────────────────────────────────────────────── */

const Problem = () => (
  <SlideFrame kicker="Problem" title="Zarząd decyduje codziennie. Rzadko z pełnym kontekstem." lede="Cena, zatrudnienie, budżet marketingowy, który produkt rozwijać. Dane o poprzednich decyzjach są w firmie, ale nie tam, gdzie zapada kolejna.">
    <div className="grid grid-cols-3 gap-7">
      <Card cue="scattered" icon={<Network />} title="Wiedza jest rozproszona">
        Slack, mail, notatki ze spotkań, arkusze KPI. Każdy widzi swój fragment, nikt nie widzi całości.
      </Card>
      <Card cue="claims" icon={<Quote />} title="Opinie udają fakty" tone="warm">
        <div className="flex items-baseline gap-6">
          <Stat value="12" label="„zainteresowanych gmin” — Slack, sprzedaż" tone="warm" />
          <span className="text-[28px] text-muted">vs</span>
          <Stat value="4" label="pisemne prośby — e-mail" tone="ok" />
        </div>
      </Card>
      <Card cue="loop" icon={<Workflow />} title="Nikt nie sprawdza skutków" tone="danger">
        Po decyzji nikt nie porównuje celu z wynikiem. Ta sama pomyłka wraca po roku, w nowym wątku.
      </Card>
    </div>
  </SlideFrame>
)

/* 3 ─────────────────────────────────────────────────────────────────────── */

const STEPS = [
  { id: 's1', n: '01', title: 'Dane o decyzjach i KPI', text: 'Import z narzędzi, które już macie.' },
  { id: 's2', n: '02', title: 'Scenariusze i skutki', text: 'Opcje, ryzyka, zależności, jawna arytmetyka.' },
  { id: 's3', n: '03', title: 'Decyzja z uzasadnieniem', text: 'Kto, dlaczego, jaki wynik i kiedy sprawdzamy.' },
  { id: 's4', n: '04', title: 'Monitoring efektów', text: 'Rzeczywisty KPI kontra oczekiwany.' },
  { id: 's5', n: '05', title: 'Nauka do kolejnej decyzji', text: 'Lekcja wraca, gdy pytanie się powtarza.' },
]

const Topic = () => (
  <SlideFrame kicker="Temat #1 · Zanim zdecydujesz" title="Jedna pętla: od danych, przez decyzję, do lekcji." lede="Dokładnie sekwencja z zadania. Każdy krok to działający ekran, nie slajd.">
    <div className="grid grid-cols-5 gap-5">
      {STEPS.map((s, i) => (
        <Cue key={s.id} id={s.id} className="relative flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
          <span className="font-mono text-[13px] tracking-[0.2em] text-accent">{s.n}</span>
          <span className="text-[22px] leading-tight font-semibold tracking-tight">{s.title}</span>
          <span className="text-[17px] leading-snug text-muted">{s.text}</span>
          {i < STEPS.length - 1 && <ArrowRight className="absolute top-1/2 -right-[22px] size-5 -translate-y-1/2 text-muted/60" />}
        </Cue>
      ))}
    </div>
    <div className="mt-10 flex items-center gap-4 text-[20px] text-muted">
      <Sparkles className="size-5 text-accent" />
      Im więcej decyzji i ich efektów zna, tym lepiej rozumie organizację.
    </div>
  </SlideFrame>
)

/* 4 ─────────────────────────────────────────────────────────────────────── */

const NODE_KINDS = ['osoba', 'produkt', 'decyzja', 'twierdzenie', 'opcja', 'metryka', 'obserwacja', 'akcja']

const Graph = () => (
  <SlideFrame kicker="Jak to działa" title="Graf firmy: każda liczba ma źródło." lede="Nie chat nad dokumentami. Węzły i relacje z datami, żeby nowsze twierdzenie mogło zastąpić starsze.">
    <div className="grid grid-cols-[380px_1fr_400px] items-start gap-7">
      <Card cue="sources" icon={<Database />} title="Źródła">
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          <li className="flex items-center gap-3"><MessageSquare className="size-5 text-accent" /> Slack: #zarzad, #purchase-requests</li>
          <li className="flex items-center gap-3"><Mail className="size-5 text-accent" /> Gmail: skrzynka CEO, faktury</li>
          <li className="flex items-center gap-3"><Calendar className="size-5 text-accent" /> Google Meet: transkrypcje spotkań</li>
          <li className="flex items-center gap-3"><FileSpreadsheet className="size-5 text-accent" /> KPI: aktywacje, wydatki, cele</li>
        </ul>
      </Card>

      <Cue id="nodes" className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-7">
        <div className="flex items-center gap-3 text-[22px] font-semibold tracking-tight">
          <span className="grid size-10 place-items-center rounded-xl bg-white/6"><Waypoints className="size-5" /></span>
          Węzły i relacje
        </div>
        <div className="flex flex-wrap gap-2.5">
          {NODE_KINDS.map((k) => (
            <Pill key={k}>{k}</Pill>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-[15px] text-muted">
          <span>source <b className="text-foreground">supports</b> claim</span>
          <span>claim <b className="text-foreground">informs</b> decision</span>
          <span>decision <b className="text-foreground">considers</b> option</span>
          <span>decision <b className="text-foreground">targets</b> metric</span>
          <span>observation <b className="text-foreground">measures</b> decision</span>
          <span>claim <b className="text-foreground">contradicts</b> claim</span>
        </div>
      </Cue>

      <div className="flex flex-col gap-6">
        <Card cue="provenance" icon={<Quote />} title="Pochodzenie" tone="accent">
          Autor, data i dokładny cytat ze źródła przy każdym twierdzeniu. Ścieżka do pliku jeden klik dalej.
        </Card>
        <Card cue="review" icon={<ShieldCheck />} title="Przegląd przed zapisem" tone="ok">
          Propozycje z modelu językowego lądują jako <Mono>pending</Mono>. Do grafu trafiają po akceptacji człowieka.
        </Card>
      </div>
    </div>
  </SlideFrame>
)

/* 5 ─────────────────────────────────────────────────────────────────────── */

const OPTIONS = [
  { name: 'A · Budować samemu', time: '16 tyg.', customers: 18, unit: '20 000', fixed: '220 000', result: '140 000' },
  { name: 'B · Partner (ConnectorCo)', time: '6 tyg.', customers: 22, unit: '14 000', fixed: '110 000', result: '198 000', highlight: true },
  { name: 'C · Poczekać', time: '—', customers: 0, unit: '—', fixed: '0', result: '0' },
]

const Decision = () => (
  <SlideFrame kicker="Pokój decyzji · dane syntetyczne, Aster Systems" title="„Budować konektor e-Doręczeń, wziąć partnera, czy poczekać?”">
    <div className="grid grid-cols-[1fr_440px] gap-7">
      <div className="flex flex-col gap-6">
        <Cue id="options" className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="w-full border-collapse text-[18px]">
            <thead>
              <tr className="text-left text-[13px] tracking-[0.16em] text-muted uppercase">
                <th className="px-6 py-4 font-medium">Opcja</th>
                <th className="px-4 py-4 font-medium">Start</th>
                <th className="px-4 py-4 font-medium">Klienci / 12 mies.</th>
                <th className="px-4 py-4 font-medium">Marża / klient</th>
                <th className="px-4 py-4 font-medium">Koszt stały</th>
                <th className="px-6 py-4 text-right font-medium">Wynik rok 1</th>
              </tr>
            </thead>
            <tbody>
              {OPTIONS.map((o) => (
                <tr key={o.name} className={['border-t border-line', o.highlight && 'bg-accent/8'].filter(Boolean).join(' ')}>
                  <td className="px-6 py-4 font-semibold tracking-tight">{o.name}</td>
                  <td className="px-4 py-4 tabular-nums text-muted">{o.time}</td>
                  <td className="px-4 py-4 tabular-nums text-muted">{o.customers}</td>
                  <td className="px-4 py-4 tabular-nums text-muted">{o.unit}</td>
                  <td className="px-4 py-4 tabular-nums text-muted">{o.fixed}</td>
                  <td className={['px-6 py-4 text-right font-semibold tabular-nums', o.highlight ? 'text-accent' : ''].join(' ')}>{o.result} zł</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-line px-6 py-3 font-mono text-[14px] text-muted">wynik = klienci × marża − koszt stały · założenia edytowalne, nie „AI score”</div>
        </Cue>

        <Cue id="assumption" className="flex items-center gap-8 rounded-2xl border border-warm/40 bg-surface px-7 py-5">
          <div className="flex flex-col">
            <span className="text-[13px] tracking-[0.16em] text-warm uppercase">Zmień założenie</span>
            <span className="text-[22px] font-semibold tracking-tight">Klienci partnera: 22 → 14</span>
          </div>
          <div className="ml-auto flex items-baseline gap-4">
            <span className="text-[34px] font-semibold tabular-nums text-muted line-through decoration-2">198 000</span>
            <ArrowRight className="size-6 text-muted" />
            <span className="text-[44px] leading-none font-semibold tabular-nums text-warm">86 000 zł</span>
          </div>
        </Cue>
      </div>

      <Card cue="evidence" icon={<Quote />} title="Dowody obok liczb">
        <ul className="m-0 flex list-none flex-col gap-4 p-0 text-[17px]">
          <li className="rounded-xl bg-white/4 p-4">
            <span className="text-ok font-semibold">4 pisemne prośby</span> gmin o zintegrowany obieg · e-mail, marzec–maj 2025
          </li>
          <li className="rounded-xl bg-white/4 p-4">
            <span className="text-warm font-semibold">„12 gmin zainteresowanych”</span> · Slack #sales, bez listy nazw
          </li>
          <li className="rounded-xl bg-white/4 p-4">
            Poprzednia funkcja (podpis cyfrowy): prognoza <span className="font-semibold text-foreground">25</span>, wynik po roku <span className="font-semibold text-danger">14</span>
          </li>
          <li className="rounded-xl bg-white/4 p-4">Dwóch inżynierów zajętych innym kamieniem milowym · Slack #engineering</li>
        </ul>
      </Card>
    </div>
  </SlideFrame>
)

/* 6 ─────────────────────────────────────────────────────────────────────── */

const Loop = () => (
  <SlideFrame kicker="Pętla wyników" title="Decyzja → wynik → lekcja, która wraca sama." lede="Ta sama karta decyzji pół roku później. Nic nie trzeba pamiętać.">
    <div className="grid grid-cols-4 gap-6">
      <Card cue="decide" title="12 maja 2025" icon={<CheckCircle2 />} tone="accent">
        Wybór: <b className="text-foreground">B, pilot z partnerem</b> z bramką przeglądu.
        <div className="mt-4"><Stat value="10" label="cel: płatne aktywacje w 6 miesięcy" tone="accent" /></div>
      </Card>
      <Card cue="measure" title="19 listopada 2025" icon={<BarChart3 />} tone="warm">
        Import KPI z arkusza aktywacji.
        <div className="mt-4 flex items-baseline gap-2">
          <Stat value="6" label="rzeczywiste" tone="warm" />
          <span className="text-[40px] text-muted">/</span>
          <Stat value="10" label="cel" />
        </div>
      </Card>
      <Card cue="lesson" title="Lekcja" icon={<Quote />}>
        „Deklaracje zainteresowania zawyżają gotowość do zakupu. Przed prognozą wymagaj nazwanych zobowiązań klientów.”
      </Card>
      <Card cue="next" title="Kolejna decyzja" icon={<GitBranch />} tone="ok">
        „Zostać przy partnerze, budować samemu czy wstrzymać?” otwiera się z tą lekcją, wynikiem 6/10 i nową opcją od agenta.
      </Card>
    </div>
  </SlideFrame>
)

/* 7 ─────────────────────────────────────────────────────────────────────── */

const Bolek = () => (
  <SlideFrame kicker="Bolek · asystent w sali spotkań" title="Zapytaj głosem. Odpowiedź przychodzi z grafu, nie z wyobraźni modelu.">
    <div className="grid grid-cols-[520px_1fr] gap-7">
      <div className="flex flex-col gap-6">
        <Cue id="ask" className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-6">
          <span className="grid size-11 flex-none place-items-center rounded-full bg-accent/15 text-accent"><Mic className="size-5" /></span>
          <div className="flex flex-col gap-1">
            <span className="text-[13px] tracking-[0.16em] text-muted uppercase">Ktoś przy stole</span>
            <span className="text-[26px] leading-tight font-semibold tracking-tight">„Bolek, ile płacimy za Pipedrive?”</span>
            <span className="mt-2 text-[15px] text-muted">Grok Voice Transcribe · po polsku · reaguje na imię</span>
          </div>
        </Cue>
        <Card cue="deterministic" icon={<RouteIcon />} title="Bez halucynacji" tone="ok">
          Jev wskazuje encję i aspekt (<Mono>Pipedrive · koszt</Mono>) w ~350 ms. Kartę składa kod z węzłów grafu w kilka milisekund. Model nie pisze ani jednej liczby.
        </Card>
        <Card cue="agent" icon={<BotMessageSquare />} title="Kiedy trzeba coś zrobić">
          „Bolek, przygotuj mail do Alfy”, „zrób wykres wydatków”, „napisz raport”: agent z narzędziami, potwierdzenie przed wysyłką.
        </Card>
      </div>

      <Cue id="card" className="flex flex-col gap-5 rounded-2xl border border-accent/40 bg-surface p-8">
        <div className="flex items-center justify-between">
          <span className="text-[13px] tracking-[0.16em] text-accent uppercase">Karta z grafu · Pipedrive · koszt</span>
          <Pill tone="ok">6 źródeł</Pill>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-[72px] leading-none font-semibold tracking-tighter tabular-nums">1 224 EUR</span>
          <span className="text-[20px] text-muted">za 6 faktur, VI–XI 2025</span>
        </div>
        <p className="m-0 text-[20px] leading-snug text-muted">
          Ostatnio <b className="text-foreground">272 EUR / mies.</b> za 8 miejsc, limit 300 EUR. Zatwierdził <b className="text-foreground">Karol Bąk</b> (15 maja, 3 września), właścicielem jest <b className="text-foreground">Tomasz Nowak</b>.
        </p>
        <div className="grid grid-cols-6 gap-2 pt-2">
          {[170, 170, 170, 170, 272, 272].map((v, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="flex h-[90px] w-full items-end rounded-md bg-white/4">
                <div className="w-full rounded-md bg-accent/70" style={{ height: `${(v / 300) * 100}%` }} />
              </div>
              <span className="font-mono text-[13px] text-muted">{['VI', 'VII', 'VIII', 'IX', 'X', 'XI'][i]}</span>
            </div>
          ))}
        </div>
        <div className="text-[15px] text-muted">Odrzucone po drodze: Intercom (10 VI), LeadBooster (8 VII), oba z uzasadnieniem w Slacku.</div>
      </Cue>
    </div>
  </SlideFrame>
)

/* 8 ─────────────────────────────────────────────────────────────────────── */

const Agents = () => (
  <SlideFrame kicker="Współpracownicy" title="Agenci pracują na grafie między spotkaniami." lede="Reguła nad dowodami, nie chatbot. Każdy wynik można kliknąć z powrotem do zgłoszenia.">
    <div className="grid grid-cols-4 gap-6">
      <Card cue="rule" icon={<Braces />} title="Support pattern watcher">
        Reguła: <Mono>≥ 4 zgłoszenia</Mono> od <Mono>≥ 3 klientów</Mono> w oknie 60 dni. Uruchamiany co tydzień.
        <div className="mt-4 flex flex-col gap-1 font-mono text-[14px]">
          <span>15 VII · 4 zgłoszenia · cicho</span>
          <span>01 IX · 10 zgłoszeń · obserwuje</span>
          <span className="text-warm">17 XI · 24 zgłoszenia · odpala</span>
        </div>
      </Card>
      <Card cue="fires" icon={<BarChart3 />} title="Co znalazł" tone="warm">
        <div className="flex gap-6">
          <Stat value="9" label="zgłoszeń" tone="warm" />
          <Stat value="4" label="gminy" tone="warm" />
        </div>
        <p className="m-0 mt-4">Wiadomości e-Doręczeń trafiają do złej sprawy. Urzędnicy przepinają ręcznie: to praca, którą integracja miała usunąć.</p>
      </Card>
      <Card cue="proposal" icon={<GitBranch />} title="Propozycja do decyzji" tone="accent">
        Nowa opcja „automatyczne dopasowanie sprawy” obok trzech, które zarząd już rozważał. Dwa dni przed spotkaniem 19 XI.
        <p className="m-0 mt-4 border-l-2 border-accent/50 pl-3 text-[16px] italic">„To dokładnie to ręczne kopiowanie, którego chcieliśmy uniknąć.” — Gmina Brzozowa, 28 VIII</p>
      </Card>
      <Card cue="pending" icon={<ShieldCheck />} title="Czeka na akceptację" tone="ok">
        Claim i opcja lądują jako <Mono>pending</Mono>. Agent nigdy sam nie zapisuje faktów. Ten sam bieg powtórzony daje ten sam raport: idempotentnie.
      </Card>
    </div>
  </SlideFrame>
)

/* 9 ─────────────────────────────────────────────────────────────────────── */

const Stack = () => (
  <SlideFrame kicker="Zaawansowanie kodu" title="Działa dziś. Wszystko, co widzieliście, jest w repozytorium.">
    <div className="grid grid-cols-3 gap-6">
      <Card cue="web" icon={<Braces />} title="TanStack Start · React 19">
        Workspace zarządu, ekran <Mono>/meeting</Mono> na wyświetlacz sali, aplikacja mobilna i ta prezentacja.
      </Card>
      <Card cue="graph" icon={<Database />} title="Graf w SQLite">
        Ontologia relacji, FTS po fragmentach, import z przeglądem różnic, snapshoty „as-of” dla replayu w czasie.
      </Card>
      <Card cue="voice" icon={<Mic />} title="xAI Grok Voice">
        STT strumieniowo przez proxy WebSocket (klucz zostaje na serwerze). TTS z timestampami znaków: stąd wiem, kiedy na co wskazać.
      </Card>
      <Card cue="routing" icon={<RouteIcon />} title="TypeSafe Jev">
        Jedno wywołanie: intencja, osoba, temat, aspekt. Wybór z katalogu encji grafu, p50 ≈ 350 ms.
      </Card>
      <Card cue="agent" icon={<BotMessageSquare />} title="Agent z narzędziami">
        Claude przez OpenRouter: kontakty, wiedza firmowa, web, screenshot, mail (SMTP), dokument, wykres, raport w tle.
      </Card>
      <Card cue="tests" icon={<TestTube2 />} title="Testy i ewaluacje">
        <Mono>node --test</Mono> pinuje liczby na kartach. Ewaluacje na żywym modelu: <b className="text-foreground">51/51</b> linii scenariuszy, <b className="text-foreground">24/24</b> intencji.
      </Card>
    </div>
  </SlideFrame>
)

/* 10 ────────────────────────────────────────────────────────────────────── */

const Value = () => (
  <SlideFrame kicker="Wartość i wdrożenie" title="Dla prezesa, który ma dane, ale nie ma czasu ich składać.">
    <div className="grid grid-cols-2 gap-6">
      <Card cue="who" icon={<Sparkles />} title="Dla kogo">
        CEO i zarząd firmy 30–150 osób, B2B, dużo decyzji o narzędziach, ludziach i produkcie. Pierwsza hipoteza: dostawca oprogramowania dla samorządów.
      </Card>
      <Card cue="how" icon={<Workflow />} title="Jak wdrażamy" tone="accent">
        <Bullets items={['Podłączenie Slacka, Gmaila i Google Meet z wyborem kanałów i etykiet', 'Graf w jednym pliku SQLite: dane zostają w firmie, on-prem lub w chmurze klienta', 'Pierwsze karty i decyzje po pierwszym imporcie, bez konfiguracji ontologii']} />
      </Card>
      <Card cue="roadmap" icon={<RouteIcon />} title="Co dalej">
        <Bullets items={['Konektory ERP i CRM, import KPI z arkuszy i BI', 'Agent tygodniowy: cel kontra KPI dla każdej otwartej decyzji', 'Pilot z pierwszą firmą z Bielska-Białej po hackathonie']} />
      </Card>
      <Card cue="moat" icon={<GitBranch />} title="Przewaga rośnie z czasem" tone="ok">
        Każda zapisana decyzja i jej wynik czynią kolejną lepszą. Po roku graf wie o firmie więcej niż każdy pojedynczy członek zarządu.
      </Card>
    </div>
  </SlideFrame>
)

/* 11 ────────────────────────────────────────────────────────────────────── */

const CRITERIA = [
  { id: 'c-value', name: 'Wartość biznesowa', w: '2,0', how: 'Realny problem prezesa: decyzje bez kontekstu. Odpowiedź z dowodami, a nie kolejny dashboard.' },
  { id: 'c-deploy', name: 'Możliwości wdrożeniowe', w: '2,0', how: 'Konektory do narzędzi, których firmy już używają. Dane nie opuszczają firmy.' },
  { id: 'c-innov', name: 'Innowacyjność', w: '1,5', how: 'Pętla decyzja → wynik → lekcja plus agenci, których propozycje przechodzą przegląd.' },
  { id: 'c-code', name: 'Zaawansowanie kodu', w: '1,5', how: 'Graf, głos, routing, agent i testy. Działający produkt, nie makieta.' },
  { id: 'c-creative', name: 'Kreatywność', w: '1,0', how: 'Asystent, który reaguje na imię i nie potrafi zmyślić liczby.' },
  { id: 'c-ux', name: 'Łatwość użytkowania · UX/UI', w: '1,5', how: 'Jedno pytanie głosem, jedna karta. Jeden ekran na wyświetlacz sali.' },
  { id: 'c-pitch', name: 'Prezentacja projektu', w: '0,5', how: 'Prowadzi ją sam produkt: Grok Voice, ten sam orb, te same dane.' },
]

const Criteria = () => (
  <SlideFrame kicker="Kryteria oceny" title="Jak wypadamy na waszej karcie.">
    <div className="grid grid-cols-[1fr_1fr] gap-x-7 gap-y-4">
      {CRITERIA.map((c) => (
        <Cue key={c.id} id={c.id} className="flex items-start gap-5 rounded-2xl border border-line bg-surface px-6 py-4">
          <span className="w-[54px] flex-none font-mono text-[26px] leading-none font-semibold tabular-nums text-accent">{c.w}</span>
          <div className="flex flex-col gap-1">
            <span className="text-[20px] leading-tight font-semibold tracking-tight">{c.name}</span>
            <span className="text-[16px] leading-snug text-muted">{c.how}</span>
          </div>
        </Cue>
      ))}
    </div>
  </SlideFrame>
)

/* 12 ────────────────────────────────────────────────────────────────────── */

const End = () => (
  <div className="slide-enter absolute inset-0 flex flex-col items-center justify-end px-24 pb-24 text-center">
    <Cue id="cta" className="rounded-3xl border border-transparent px-10 py-6">
      <h1 className="m-0 text-[84px] leading-[1.02] font-semibold tracking-tighter text-balance">
        Zanim zdecydujesz, <span className="text-accent">zapytaj Bolka.</span>
      </h1>
    </Cue>
    <Cue id="team" className="mt-6 flex flex-col items-center gap-3 rounded-3xl border border-transparent px-10 py-4">
      <p className="m-0 text-[26px] text-muted">Droker · graf decyzji · asystent zarządu · pętla wyników</p>
      <div className="flex gap-3">
        <Pill>TanStack Start</Pill>
        <Pill>SQLite graph</Pill>
        <Pill>xAI Grok Voice</Pill>
        <Pill>TypeSafe Jev</Pill>
        <Pill>Claude agent</Pill>
      </div>
    </Cue>
  </div>
)

export const SLIDES: SlideDef[] = [
  { id: 'title', title: 'Droker', orb: CENTER_HOME, Component: Title },
  { id: 'problem', title: 'Problem', orb: DEFAULT_HOME, Component: Problem },
  { id: 'topic', title: 'Temat #1', orb: DEFAULT_HOME, Component: Topic },
  { id: 'graph', title: 'Graf firmy', orb: DEFAULT_HOME, Component: Graph },
  { id: 'decision', title: 'Pokój decyzji', orb: DEFAULT_HOME, Component: Decision },
  { id: 'loop', title: 'Pętla wyników', orb: DEFAULT_HOME, Component: Loop },
  { id: 'bolek', title: 'Bolek', orb: DEFAULT_HOME, Component: Bolek },
  { id: 'agents', title: 'Agenci', orb: DEFAULT_HOME, Component: Agents },
  { id: 'stack', title: 'Kod', orb: DEFAULT_HOME, Component: Stack },
  { id: 'value', title: 'Wartość', orb: DEFAULT_HOME, Component: Value },
  { id: 'criteria', title: 'Kryteria', orb: DEFAULT_HOME, Component: Criteria },
  { id: 'end', title: 'Koniec', orb: CENTER_HOME, Component: End },
]
