import { useEffect, useState } from 'react'
import { ArrowRight, FileText, Mail, MessageSquare } from 'lucide-react'

import { NebulaOrb } from '@/orb/nebula-orb'

export interface SlideDef {
  id: string
  title: string
  kind?: 'video'
  Component: () => React.JSX.Element
}

const Frame = ({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) => (
  <div className="slide-enter absolute inset-0 flex flex-col px-[116px] pt-[86px] pb-[90px]">
    <div className="text-[18px] font-semibold tracking-[0.2em] text-accent uppercase">{eyebrow}</div>
    {children}
  </div>
)

const Title = () => (
  <Frame eyebrow="HackBB 2026 / Wsparcie C-Level">
    <div className="flex flex-1 items-center justify-between gap-20">
      <div className="max-w-[940px]">
        <h1 className="m-0 text-[152px] leading-[0.94] font-semibold tracking-[-0.075em]">Droker</h1>
        <p className="mt-10 max-w-[880px] text-[43px] leading-[1.18] tracking-[-0.035em] text-foreground/90">
          Bolek wnosi kontekst firmy do rozmowy zarządu.
        </p>
      </div>
      <div className="flex-none" aria-hidden="true">
        <NebulaOrb state="idle" size={360} colorFrom="#9db0ea" colorTo="#bfe6e6" label="Bolek" />
      </div>
    </div>
    <p className="m-0 text-[23px] text-muted">Odpowiedź w trakcie spotkania. Dalsze działanie po nim.</p>
  </Frame>
)

const Problem = () => (
  <Frame eyebrow="Problem">
    <div className="flex flex-1 flex-col justify-center">
      <p className="m-0 text-[29px] font-medium text-muted">Na spotkaniu pada proste pytanie:</p>
      <h1 className="m-0 mt-5 text-[91px] leading-[1.04] font-semibold tracking-[-0.065em]">
        „Ile płacimy za Pipedrive?”
      </h1>
      <div className="mt-15 grid grid-cols-[0.9fr_1.1fr] gap-18">
        <section className="border-t border-accent/75 pt-6" aria-label="Fragmenty faktur Pipedrive">
          <div className="font-mono text-[19px] tracking-[0.12em] text-accent uppercase">Faktury / Pipedrive</div>
          <div className="mt-7 flex items-baseline justify-between gap-6 border-b border-line pb-5">
            <div>
              <div className="text-[27px] font-medium">Czerwiec 2025</div>
              <div className="mt-1 font-mono text-[17px] text-muted">PD-2025-06-0417 · 5 × Advanced</div>
            </div>
            <div className="text-[34px] font-semibold tabular-nums whitespace-nowrap">170 EUR</div>
          </div>
          <div className="mt-5 flex items-baseline justify-between gap-6">
            <div>
              <div className="text-[27px] font-medium">Lipiec 2025</div>
              <div className="mt-1 font-mono text-[17px] text-muted">PD-2025-07-0522 · 5 × Advanced</div>
            </div>
            <div className="text-[34px] font-semibold tabular-nums whitespace-nowrap">170 EUR</div>
          </div>
        </section>
        <section className="border-t border-accent/75 pt-6" aria-label="Fragment wątku Slack o decyzji zakupowej">
          <div className="font-mono text-[19px] tracking-[0.12em] text-accent">SLACK / #purchase-requests</div>
          <div className="mt-7 border-l-2 border-accent/45 pl-7">
            <div className="text-[23px] font-semibold">Karol Bąk <span className="ml-3 font-mono text-[17px] font-normal text-muted">15 maja · 09:12</span></div>
            <p className="m-0 mt-4 max-w-[640px] text-[27px] leading-[1.3] text-foreground/90">
              „Zatwierdzone: Pipedrive Advanced, 5 miejsc, płatność miesięczna. Limit 200 EUR miesięcznie.”
            </p>
            <div className="mt-4 text-[20px] text-muted">Właściciel miejsc: Tomasz Nowak. Przegląd po pilocie.</div>
          </div>
        </section>
      </div>
    </div>
  </Frame>
)

const Value = () => (
  <Frame eyebrow="Rozwiązanie">
    <div className="flex flex-1 flex-col justify-center">
      <h1 className="m-0 max-w-[1280px] text-[91px] leading-[1.04] font-semibold tracking-[-0.06em]">
        Bolek pracuje
        <br />
        <span className="text-accent">w trakcie spotkania.</span>
      </h1>
      <p className="mt-16 max-w-[1120px] text-[35px] leading-[1.28] text-muted">
        Tworzy notatki i raporty z rozmowy oraz przygotowuje szkice maili. Zespół zatwierdza wysyłkę.
      </p>
    </div>
  </Frame>
)

const Architecture = () => (
  <Frame eyebrow="Architektura / 01">
    <h1 className="m-0 mt-4 text-[72px] leading-[1.07] font-semibold tracking-[-0.055em]">
      Wiedza firmy jako warstwa dla agenta.
    </h1>
    <div className="mt-12 grid min-h-0 flex-1 grid-cols-[340px_56px_444px_56px_1fr] items-center gap-4">
      <div className="flex h-[430px] flex-col justify-between">
        <div className="font-mono text-[17px] tracking-[0.13em] text-muted uppercase">Źródła danych</div>
        {[
          { label: 'Slack', detail: 'rozmowy i ustalenia', Icon: MessageSquare },
          { label: 'E-mail', detail: 'oferty i faktury', Icon: Mail },
          { label: 'Dokumenty', detail: 'notatki i decyzje', Icon: FileText },
        ].map(({ label, detail, Icon }) => (
          <div key={label} className="flex h-[105px] items-center gap-5 rounded-2xl border border-line bg-surface/75 px-6">
            <Icon size={31} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
            <div>
              <div className="text-[28px] font-semibold leading-none">{label}</div>
              <div className="mt-2 text-[19px] text-muted">{detail}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-4 text-center text-muted">
        <ArrowRight size={43} strokeWidth={1.4} className="text-accent" aria-hidden="true" />
        <span className="font-mono text-[14px] leading-[1.4]">import<br />+ ekstrakcja</span>
      </div>
      <div className="relative flex h-[430px] flex-col rounded-[26px] border border-accent/40 bg-[linear-gradient(145deg,rgba(124,155,214,0.17),rgba(20,25,36,0.7)_65%)] p-9">
        <div className="font-mono text-[17px] tracking-[0.13em] text-accent uppercase">Warstwa wiedzy</div>
        <h2 className="m-0 mt-6 text-[52px] leading-[1.03] font-semibold tracking-[-0.05em]">Company<br />Graph</h2>
        <div className="mt-auto border-t border-white/15 pt-6">
          <div className="text-[24px] font-medium">Encje → relacje → dowody</div>
          <p className="m-0 mt-2 text-[18px] leading-[1.35] text-muted">Koszt, właściciel i decyzja połączone z cytatem oraz plikiem źródłowym.</p>
          <div className="mt-5 font-mono text-[17px] text-accent-2">SQLite · FTS5 · cytowania</div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-4 text-center text-muted">
        <ArrowRight size={43} strokeWidth={1.4} className="text-accent" aria-hidden="true" />
        <span className="font-mono text-[14px] leading-[1.4]">retrieval<br />+ narzędzia</span>
      </div>
      <div className="flex h-[430px] flex-col rounded-[26px] border border-line bg-surface/75 p-9">
        <div className="font-mono text-[17px] tracking-[0.13em] text-muted uppercase">Interfejs działania</div>
        <div className="mt-8 flex items-center gap-5">
          <div className="h-16 w-16 flex-none rounded-full bg-[radial-gradient(circle_at_35%_30%,#c8e4f2,#859ad0_45%,#354369_78%)] shadow-[0_0_35px_rgba(143,174,225,0.25)]" aria-hidden="true" />
          <h2 className="m-0 text-[57px] font-semibold tracking-[-0.06em]">Bolek</h2>
        </div>
        <p className="mt-auto mb-0 text-[25px] leading-[1.25] text-foreground/90">Agent odpowiada w kontekście spotkania i uruchamia narzędzia.</p>
        <div className="mt-5 font-mono text-[17px] text-accent-2">odpowiedź · szkic · raport</div>
      </div>
    </div>
    <div className="mt-5 flex items-baseline gap-10 border-t border-line pt-5">
      <div className="shrink-0 text-[34px] font-semibold tracking-[-0.04em]">Jev <span className="text-accent">jako router intencji</span></div>
      <p className="m-0 text-[22px] leading-[1.25] text-muted">Nowe podejście: model wybiera ścieżkę. Karta z grafu odpowiada, agent wykonuje zadanie.</p>
    </div>
    <p className="m-0 mt-5 font-mono text-[16px] text-muted">Demo: import przygotowanych plików Slack / e-mail / dokumentów; nie są to konektory live.</p>
  </Frame>
)

const Execution = () => (
  <Frame eyebrow="Architektura / 02">
    <h1 className="m-0 mt-4 text-[72px] leading-[1.07] font-semibold tracking-[-0.055em]">
      Jedna wypowiedź. Dwie ścieżki wykonania.
    </h1>
    <div className="mt-14 flex items-stretch gap-5">
      <div className="flex-1 rounded-2xl border border-line bg-surface/75 p-7">
        <div className="font-mono text-[16px] text-muted">01 / SYGNAŁ</div>
        <div className="mt-3 text-[27px] font-medium">Transkrypt spotkania</div>
        <div className="mt-2 text-[20px] text-muted">„Bolek, ile płacimy za Pipedrive?”</div>
      </div>
      <ArrowRight size={38} strokeWidth={1.4} className="self-center text-accent" aria-hidden="true" />
      <div className="flex-1 rounded-2xl border border-accent/35 bg-accent/10 p-7">
        <div className="font-mono text-[16px] text-accent">02 / ROUTING</div>
        <div className="mt-3 text-[27px] font-medium">Wake word + intencja</div>
        <div className="mt-2 text-[20px] text-muted">Jev lub lokalny fallback wybiera temat i typ akcji.</div>
      </div>
    </div>
    <div className="mt-12 grid min-h-0 flex-1 grid-cols-2 gap-8">
      <div className="flex flex-col rounded-[25px] border border-line bg-surface/55 p-9">
        <div className="font-mono text-[17px] tracking-[0.12em] text-accent uppercase">A / Pytanie o firmę</div>
        <h2 className="m-0 mt-6 text-[38px] leading-[1.09] font-semibold tracking-[-0.035em]">Deterministyczna<br />karta z grafu</h2>
        <p className="mt-5 mb-0 text-[23px] leading-[1.27] text-muted">Wyszukanie encji i relacji → wyliczenie z faktur → odpowiedź z cytowaniem.</p>
        <div className="mt-auto border-t border-line pt-5 font-mono text-[17px] text-accent-2">graf + kod, bez wymyślania liczby przez model</div>
      </div>
      <div className="flex flex-col rounded-[25px] border border-line bg-surface/55 p-9">
        <div className="font-mono text-[17px] tracking-[0.12em] text-accent uppercase">B / Zadanie do wykonania</div>
        <h2 className="m-0 mt-6 text-[38px] leading-[1.09] font-semibold tracking-[-0.035em]">Bolek + pętla<br />narzędzi</h2>
        <p className="mt-5 mb-0 text-[23px] leading-[1.27] text-muted">Odczyt wiedzy firmy → szkic maila, dokument lub raport → wynik na ekranie.</p>
        <div className="mt-auto border-t border-line pt-5 font-mono text-[17px] text-accent-2">wysłanie maila dopiero po potwierdzeniu</div>
      </div>
    </div>
  </Frame>
)

function DemoVideo({ number, title, file }: { number: string; title: string; file: string }) {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void fetch(file, { method: 'HEAD', signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setAvailable(response.ok && (response.headers.get('content-type') ?? '').startsWith('video/'))
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailable(false)
      })
    return () => controller.abort()
  }, [file])

  return (
    <Frame eyebrow={`Demo ${number}`}>
      <h1 className="m-0 mt-4 text-[58px] font-semibold tracking-[-0.045em]">{title}</h1>
      <div className="relative mt-11 min-h-0 flex-1 overflow-hidden rounded-[24px] border border-line bg-[#080b12]">
        {available ? (
          <video
            className="absolute inset-0 h-full w-full object-contain"
            src={file}
            controls
            preload="metadata"
            playsInline
            onError={() => setAvailable(false)}
            aria-label={`Nagranie demonstracyjne ${number}`}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center">
            <span className="font-mono text-[104px] leading-none tracking-[-0.08em] text-foreground/12">{number.padStart(2, '0')}</span>
            <p className="m-0 text-[30px] font-medium text-foreground/85">Miejsce na film demonstracyjny</p>
            <p className="m-0 font-mono text-[19px] text-muted">Dodaj plik: presentation/public{file}</p>
          </div>
        )}
      </div>
    </Frame>
  )
}

const DemoOne = () => <DemoVideo number="1" title="Produkt w praktyce" file="/demos/demo-1.mp4" />
const DemoTwo = () => <DemoVideo number="2" title="Produkt w praktyce, część druga" file="/demos/demo-2.mp4" />

const Closing = () => (
  <Frame eyebrow="Wartość i następny krok">
    <div className="flex flex-1 flex-col justify-center">
      <h1 className="m-0 max-w-[1310px] text-[87px] leading-[1.06] font-semibold tracking-[-0.06em]">
        Mniej szukania.
        <br />
        <span className="text-accent">Więcej czasu na decyzję.</span>
      </h1>
      <div className="mt-20 grid max-w-[1280px] grid-cols-2 gap-20 border-t border-line pt-10">
        <div>
          <h2 className="m-0 text-[23px] font-semibold text-foreground">Działa dziś</h2>
          <p className="mt-4 text-[27px] leading-[1.3] text-muted">Ekran spotkania, graf ze źródłami, odpowiedzi i przygotowanie dalszych działań.</p>
        </div>
        <div>
          <h2 className="m-0 text-[23px] font-semibold text-foreground">Droga do pilota</h2>
          <p className="mt-4 text-[27px] leading-[1.3] text-muted">Autoryzowane źródła, uprawnienia i pomiar czasu potrzebnego na uzyskanie odpowiedzi.</p>
        </div>
      </div>
    </div>
  </Frame>
)

export const SLIDES: SlideDef[] = [
  { id: 'title', title: 'Droker', Component: Title },
  { id: 'problem', title: 'Problem', Component: Problem },
  { id: 'value', title: 'Rozwiązanie', Component: Value },
  { id: 'architecture', title: 'Architektura', Component: Architecture },
  { id: 'execution', title: 'Wykonanie', Component: Execution },
  { id: 'demo-1', title: 'Demo 1', kind: 'video', Component: DemoOne },
  { id: 'demo-2', title: 'Demo 2', kind: 'video', Component: DemoTwo },
  { id: 'closing', title: 'Wartość', Component: Closing },
]
