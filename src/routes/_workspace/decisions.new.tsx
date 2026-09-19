import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, CheckIcon, FilesIcon, GitForkIcon, PlusIcon, SearchIcon, SparklesIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { PageHeader, Panel, Pill } from '@/components/desktop/page'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { buildDraft, type DecisionDraft, type DraftItem, type DraftOption } from '@/demo/draft'
import { plural } from '@/demo/format'
import { actions, useDemoState } from '@/demo/store'
import type { Source } from '@/demo/types'
import { cn } from '@/lib/utils'
import { fetchDraftBundle, type DraftBundle } from '@/server/decision-draft'

export const Route = createFileRoute('/_workspace/decisions/new')({
  staticData: { crumb: 'Nowa sprawa' },
  component: NewDecision,
})

const EXAMPLES = [
  'Czy zostawić Pipedrive na 8 miejscach, czy zmniejszyć liczbę licencji?',
  'Should we build automatic case matching for e-Doręczenia or keep the partner connector?',
  'Czy zatwierdzić Intercom dla Customer Success?',
]

const STEPS = [
  'Szukam pełnotekstowo w Slacku, mailach, notatkach i zgłoszeniach',
  'Rozwijam graf: osoby, decyzje, opcje, metryki w dwóch krokach od trafień',
  'Zbieram cytaty i sprawdzam, które twierdzenia mają źródło',
  'Składam szkic sprawy',
]

type Phase = { kind: 'ask' } | { kind: 'loading'; question: string } | { kind: 'ready'; bundle: DraftBundle; draft: DecisionDraft }

function NewDecision() {
  const state = useDemoState()
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'ask' })
  const [error, setError] = useState<string | null>(null)

  async function ask(q: string) {
    const trimmed = q.trim()
    if (!trimmed) return
    setError(null)
    setPhase({ kind: 'loading', question: trimmed })
    const started = Date.now()
    try {
      const bundle = await fetchDraftBundle({ data: { question: trimmed } })
      // Let the retrieval steps play out so the audience can read what the agent did.
      const wait = Math.max(0, STEPS.length * 650 - (Date.now() - started))
      await new Promise((r) => setTimeout(r, wait))
      setPhase({ kind: 'ready', bundle, draft: buildDraft(bundle, state.now) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się pobrać kontekstu z grafu.')
      setPhase({ kind: 'ask' })
    }
  }

  function create(draft: DecisionDraft) {
    const sources: Source[] = draft.sources
      .filter((s) => s.included)
      .map(({ id, kind, title, excerpt, date }) => ({ id, kind, title, excerpt, date }))
    const text = (items: DraftItem[]) => items.filter((i) => i.included).map((i) => i.text)
    const id = actions.createDecision(
      {
        title: draft.title.trim(),
        why: draft.why.trim(),
        projectId: draft.projectId,
        dueAt: draft.dueAt,
        context: text(draft.context),
        facts: text(draft.facts),
        unknowns: text(draft.unknowns),
        assumptions: text(draft.assumptions),
        options: draft.options
          .filter((o) => o.included && o.label.trim())
          .map((o) => ({ id: o.id, label: o.label.trim(), description: o.description.trim(), consequences: o.consequences, execution: [] })),
        sourceIds: sources.map((s) => s.id),
        agentPlan: draft.agentPlan,
      },
      sources,
    )
    toast.add({ type: 'success', title: 'Sprawa utworzona', description: `${sources.length} ${plural(sources.length, 'źródło', 'źródła', 'źródeł')} z grafu podpięte do sprawy.` })
    void navigate({ to: '/decisions/$decisionId', params: { decisionId: id } })
  }

  if (phase.kind === 'ready') {
    return (
      <DraftEditor
        bundle={phase.bundle}
        initial={phase.draft}
        projects={state.projects}
        onBack={() => setPhase({ kind: 'ask' })}
        onCreate={create}
      />
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Decisions"
        title="Nowa sprawa"
        description="Napisz, co chcesz rozstrzygnąć. Agent przeszuka graf firmy — Slack, maile, notatki ze spotkań, zgłoszenia i wcześniejsze decyzje — i złoży z tego szkic sprawy z cytatami."
      />

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Co chcesz zdecydować?</span>
          <Textarea
            autoFocus
            value={question}
            disabled={phase.kind === 'loading'}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void ask(question)
            }}
            placeholder="np. Czy przedłużyć umowę z ConnectorCo na kolejny rok?"
            className="min-h-28 resize-y text-base"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Przykłady:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={phase.kind === 'loading'}
              onClick={() => {
                setQuestion(ex)
                void ask(ex)
              }}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors outline-none hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-xs text-muted-foreground">⌘ + Enter, żeby wysłać. Graf: {'>'}60 dokumentów, 66 węzłów, cytaty z numerem linii.</span>
          <Button disabled={!question.trim() || phase.kind === 'loading'} onClick={() => void ask(question)}>
            {phase.kind === 'loading' ? <Spinner /> : <SearchIcon />} Zbierz kontekst
          </Button>
        </div>
      </section>

      {phase.kind === 'loading' && <RetrievalProgress question={phase.question} />}
    </>
  )
}

function RetrievalProgress({ question }: { question: string }) {
  const [done, setDone] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setDone((d) => Math.min(d + 1, STEPS.length - 1)), 650)
    return () => clearInterval(t)
  }, [])
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-card p-5">
      <p className="text-sm text-muted-foreground">
        Pytanie: <span className="font-medium text-foreground">„{question}”</span>
      </p>
      <ol className="flex flex-col gap-2.5">
        {STEPS.map((step, i) => (
          <li key={step} className={cn('flex items-center gap-2.5 text-sm', i > done && 'text-muted-foreground/60')}>
            {i < done ? (
              <CheckIcon className="size-4 text-primary" />
            ) : i === done ? (
              <Spinner className="size-4 text-primary" />
            ) : (
              <span className="size-4 rounded-full border border-border" />
            )}
            {step}
          </li>
        ))}
      </ol>
    </section>
  )
}

function DraftEditor({
  bundle,
  initial,
  projects,
  onBack,
  onCreate,
}: {
  bundle: DraftBundle
  initial: DecisionDraft
  projects: { id: string; name: string }[]
  onBack: () => void
  onCreate: (draft: DecisionDraft) => void
}) {
  const [draft, setDraft] = useState(initial)
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  const toggle = (key: 'context' | 'facts' | 'unknowns' | 'assumptions') => (id: string, included: boolean) =>
    setDraft((d) => ({ ...d, [key]: d[key].map((i) => (i.id === id ? { ...i, included } : i)) }))
  const setOption = (id: string, patch: Partial<DraftOption>) =>
    setDraft((d) => ({ ...d, options: d.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) }))
  const includedSources = draft.sources.filter((s) => s.included).length
  const includedOptions = draft.options.filter((o) => o.included && o.label.trim()).length
  const valid = draft.title.trim().length > 0 && includedOptions > 0

  return (
    <>
      <PageHeader
        eyebrow="Nowa sprawa · szkic z grafu"
        title={draft.title || 'Bez tytułu'}
        description="Przejrzyj, co agent znalazł. Odznacz to, co nie pasuje, dopisz powód i utwórz sprawę — trafi do kolejki „Do decyzji”."
        meta={
          <>
            <span className="inline-flex items-center gap-1">
              <FilesIcon className="size-3.5" /> {bundle.stats.searchedSources} {plural(bundle.stats.searchedSources, 'dokument trafiony', 'dokumenty trafione', 'dokumentów trafionych')} z {bundle.stats.documents}
            </span>
            <span className="inline-flex items-center gap-1">
              <GitForkIcon className="size-3.5" /> {bundle.stats.nodes} {plural(bundle.stats.nodes, 'węzeł', 'węzły', 'węzłów')}, {bundle.stats.edges} {plural(bundle.stats.edges, 'relacja', 'relacje', 'relacji')}
            </span>
            <span>{draft.sources.length} {plural(draft.sources.length, 'cytat', 'cytaty', 'cytatów')}</span>
          </>
        }
        action={
          <Button variant="outline" onClick={onBack}>
            <ArrowLeftIcon /> Zapytaj inaczej
          </Button>
        }
      />

      {bundle.anchors.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 text-muted-foreground">Zaczepienia w grafie:</span>
          {bundle.anchors.map((a) => (
            <Pill key={a.id} tone={a.kind === 'decision' ? 'accent' : 'muted'}>
              <span className="opacity-70">{a.kind}</span> {a.label}
            </Pill>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Sprawa" caption="Tytuł i powód zobaczy każdy, kto otworzy sprawę.">
            <div className="grid gap-4">
              <Field label="Tytuł">
                <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="text-base" />
              </Field>
              <Field label="Dlaczego teraz">
                <Textarea value={draft.why} onChange={(e) => setDraft({ ...draft, why: e.target.value })} className="min-h-24 resize-y" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Projekt">
                  <NativeSelect value={draft.projectId} onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}>
                    {projects.map((p) => (
                      <NativeSelectOption key={p.id} value={p.id}>
                        {p.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Reakcja do">
                  <Input type="date" value={draft.dueAt.slice(0, 10)} onChange={(e) => e.target.value && setDraft({ ...draft, dueAt: `${e.target.value}T17:00:00` })} />
                </Field>
              </div>
            </div>
          </Panel>

          <Panel title="Kontekst i potwierdzone fakty" caption="Z grafu: wcześniejsze decyzje, osoby, obserwacje i twierdzenia z przypisanym źródłem.">
            <div className="grid gap-6 md:grid-cols-2">
              <ItemList label="Kontekst" items={draft.context} onToggle={toggle('context')} empty="Graf nie zna wcześniejszych decyzji ani osób powiązanych z tym pytaniem." />
              <ItemList label="Potwierdzone w źródłach" items={draft.facts} onToggle={toggle('facts')} empty="Brak twierdzeń z bezpośrednim źródłem." />
            </div>
          </Panel>

          <Panel title="Niewiadome i założenia" caption="To, czego źródła nie potwierdzają, oraz szacunki, które ktoś podał.">
            <div className="grid gap-6 md:grid-cols-2">
              <ItemList label="Niewiadome" items={draft.unknowns} onToggle={toggle('unknowns')} empty="Nie znaleziono luk — sprawdź, czy to nie za dobrze." />
              <ItemList label="Założenia" items={draft.assumptions} onToggle={toggle('assumptions')} empty="Brak szacunków w źródłach." />
            </div>
          </Panel>

          <Panel
            title="Możliwe działania"
            caption={bundle.options.length ? 'Opcje, które firma rozważała już wcześniej w powiązanych sprawach. Zmień lub dopisz własne.' : 'Graf nie zna opcji dla tego pytania — poniżej domyślny zestaw do edycji.'}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    options: [...d.options, { id: `opt-custom-${d.options.length + 1}`, label: '', description: '', consequences: {}, included: true }],
                  }))
                }
              >
                <PlusIcon /> Dodaj opcję
              </Button>
            }
          >
            <ul className="grid gap-3 md:grid-cols-2">
              {draft.options.map((o) => (
                <li key={o.id} className={cn('flex flex-col gap-2 rounded-xl border p-3.5', o.included ? 'border-border bg-background/40' : 'border-dashed border-border opacity-60')}>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={o.included} onCheckedChange={(v) => setOption(o.id, { included: v === true })} aria-label="Uwzględnij opcję" />
                    <Input value={o.label} placeholder="Nazwa opcji" onChange={(e) => setOption(o.id, { label: e.target.value })} className="h-8 font-medium" />
                    <Button variant="ghost" size="icon-sm" aria-label="Usuń opcję" onClick={() => setDraft((d) => ({ ...d, options: d.options.filter((x) => x.id !== o.id) }))}>
                      <Trash2Icon />
                    </Button>
                  </div>
                  <Textarea value={o.description} placeholder="Co to oznacza w praktyce" onChange={(e) => setOption(o.id, { description: e.target.value })} className="min-h-16 resize-y text-sm" />
                  <div className="grid grid-cols-3 gap-2">
                    {(['time', 'cost', 'risk'] as const).map((k) => (
                      <Input
                        key={k}
                        value={o.consequences[k] ?? ''}
                        placeholder={{ time: 'Czas', cost: 'Koszt', risk: 'Ryzyko' }[k]}
                        onChange={(e) => setOption(o.id, { consequences: { ...o.consequences, [k]: e.target.value || undefined } })}
                        className="h-8 text-xs"
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Źródła z grafu"
            caption="Każdy cytat ma plik i numer linii. Odznacz, czego nie chcesz w sprawie."
            action={<span className="text-xs text-muted-foreground tabular-nums">{includedSources}/{draft.sources.length}</span>}
          >
            {draft.sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nic nie pasuje do pytania. Spróbuj nazwać produkt, dostawcę albo osobę.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {draft.sources.map((s) => (
                  <li key={s.id}>
                    <label className={cn('flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/40', s.included ? 'border-border' : 'border-dashed border-border opacity-60')}>
                      <Checkbox
                        checked={s.included}
                        onCheckedChange={(v) => setDraft((d) => ({ ...d, sources: d.sources.map((x) => (x.id === s.id ? { ...x, included: v === true } : x)) }))}
                        className="mt-0.5"
                      />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground/80">{s.title}</span>
                          <span>{s.date}</span>
                          {s.direct && <Pill tone="accent">trafienie</Pill>}
                          {s.role === 'opposes' && <Pill tone="destructive">przeciw</Pill>}
                        </span>
                        <span className="text-sm leading-relaxed">„{s.excerpt}”</span>
                        <span className="truncate font-mono text-[11px] text-muted-foreground">
                          {s.path}:{s.line}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-4 border-t border-border bg-background/85 px-4 py-3 backdrop-blur-xl md:-mx-8 md:px-8">
        <p className="text-xs text-muted-foreground">
          {includedOptions} {plural(includedOptions, 'opcja', 'opcje', 'opcji')} · {includedSources} {plural(includedSources, 'źródło', 'źródła', 'źródeł')} · trafi do kolejki „Do decyzji”
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" nativeButton={false} render={<Link to="/decisions" />}>
            Anuluj
          </Button>
          <Button disabled={!valid} onClick={() => onCreate(draft)}>
            <SparklesIcon /> Utwórz sprawę
          </Button>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function ItemList({ label, items, onToggle, empty }: { label: string; items: DraftItem[]; onToggle: (id: string, included: boolean) => void; empty: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((i) => (
            <li key={i.id}>
              <label className={cn('flex cursor-pointer gap-2.5 rounded-lg px-1.5 py-1 text-sm leading-relaxed transition-colors hover:bg-muted/50', !i.included && 'text-muted-foreground line-through')}>
                <Checkbox checked={i.included} onCheckedChange={(v) => onToggle(i.id, v === true)} className="mt-1" />
                <span className="flex min-w-0 flex-col">
                  <span>{i.text}</span>
                  <span className="text-[11px] text-muted-foreground no-underline">{i.origin}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
