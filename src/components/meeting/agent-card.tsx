import { CheckIcon, ChevronDownIcon, ExternalLinkIcon, FileTextIcon, GlobeIcon, ImageIcon, MailIcon, SendIcon, SparklesIcon, TableIcon, WrenchIcon } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Panel, Pill } from '@/components/desktop/page'
import { Markdown } from '@/components/meeting/markdown'
import { NoteCardView } from '@/components/meeting/note-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { formatDayMonth } from '@/demo/format'
import { ASSISTANT_NAME } from '@/lib/wake-word'
import type { AgentResult, AgentStep, Attachment, ChartSpec, EmailDraft, TranscriptLine } from '@/server/meeting-assist'
import { cn } from '@/lib/utils'

const TOOL_LABEL: Record<string, string> = {
  company_knowledge: 'dane firmy',
  list_entities: 'graf firmy',
  get_entity: 'szczegóły',
  find_contact: 'kontakt',
  search_web: 'internet',
  page_screenshot: 'strona',
  draft_email: 'mail',
  create_document: 'dokument',
  meeting_notes: 'transkrypcja',
  chart: 'wykres',
  write_report: 'raport w tle',
}

function Trigger({ triggeredBy }: { triggeredBy?: { speaker: string; text: string } }) {
  if (!triggeredBy) return null
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground/80">{triggeredBy.speaker}:</span> „{triggeredBy.text}”
    </p>
  )
}

/** While the agent works: the question, what it is doing right now, and the steps done so far. */
export function AgentLoadingView({ question, activity, steps, triggeredBy }: { question: string; activity?: string; steps: AgentStep[]; triggeredBy?: { speaker: string; text: string } }) {
  return (
    <article className="flex min-w-0 flex-col gap-5" aria-busy>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Pill tone="accent">
            <SparklesIcon className="size-3" /> {ASSISTANT_NAME}
          </Pill>
          <span className="inline-flex items-center gap-1.5">
            <Spinner className="size-3" /> {activity || 'Myślę'}…
          </span>
        </div>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">{question}</h1>
        <Trigger triggeredBy={triggeredBy} />
      </header>
      {steps.length > 0 && <Steps steps={steps} open />}
      <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex min-w-[10rem] flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-12 w-40" />
        </div>
        <div className="flex flex-col gap-3 md:border-l md:border-border md:pl-6">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </section>
    </article>
  )
}

export function AgentErrorView({ question, error }: { question: string; error: string }) {
  return (
    <article className="flex min-w-0 flex-col gap-5">
      <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">{question}</h1>
      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="text-base leading-relaxed text-destructive">Nie udało się: {error}</p>
      </section>
    </article>
  )
}

function Steps({ steps, open: initiallyOpen = false }: { steps: AgentStep[]; open?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  if (steps.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
        <WrenchIcon className="size-3.5" />
        {steps.map((s) => TOOL_LABEL[s.tool] ?? s.tool).join(' → ')}
        <ChevronDownIcon className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ol className="flex flex-col gap-1 rounded-xl border border-border bg-background/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
          {steps.map((s, i) => (
            <li key={i} className={cn(s.error && 'text-destructive')}>
              <span className="text-foreground">{s.tool}</span>({s.args.slice(0, 120)}) · {s.ms} ms
              {s.error ? ` · błąd: ${s.error}` : s.summary ? ` · ${s.summary.slice(0, 120)}` : ''}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

const PALETTE = ['oklch(0.72 0.11 235)', 'oklch(0.75 0.1 60)', 'oklch(0.7 0.1 150)', 'oklch(0.7 0.12 320)']

function Chart({ spec }: { spec: ChartSpec }) {
  const labels = [...new Set(spec.series.flatMap((s) => s.data.map((d) => d.label)))]
  const rows = labels.map((label) => Object.fromEntries([['label', label], ...spec.series.map((s) => [s.name, s.data.find((d) => d.label === label)?.value ?? null])]))
  const common = { data: rows, margin: { top: 8, right: 16, bottom: 0, left: 0 } }
  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in oklch, var(--border), transparent 20%)" />
      <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => `${v}${spec.unit ? ` ${spec.unit}` : ''}`} />
      <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--foreground)' }} formatter={(v) => `${String(v ?? '')}${spec.unit ? ` ${spec.unit}` : ''}`} />
      {spec.series.length > 1 && <Legend />}
    </>
  )
  return (
    <Panel title={spec.title} caption={spec.unit ? `Wartości w ${spec.unit}.` : undefined}>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {spec.kind === 'line' ? (
            <LineChart {...common}>
              {axes}
              {spec.series.map((s, i) => (
                <Line key={s.name} type="monotone" dataKey={s.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
              ))}
            </LineChart>
          ) : (
            <BarChart {...common}>
              {axes}
              {spec.series.map((s, i) => (
                <Bar key={s.name} dataKey={s.name} fill={PALETTE[i % PALETTE.length]} radius={[6, 6, 0, 0]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

function EmailDraftCard({ draft, status, onSend, sending }: { draft: Extract<Attachment, { type: 'email_draft' }>; status: EmailDraft['status']; onSend?: (id: string) => void; sending: boolean }) {
  const sent = status === 'sent'
  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <MailIcon className="size-4" /> Szkic maila
        </span>
      }
      caption={sent ? 'Wysłany.' : status === 'failed' ? 'Wysyłka nie powiodła się.' : `Czeka na potwierdzenie: „${ASSISTANT_NAME}, wyślij” albo przycisk.`}
      action={
        onSend && !sent ? (
          <Button size="sm" onClick={() => onSend(draft.id)} disabled={sending || status === 'sending'}>
            {sending || status === 'sending' ? <Spinner /> : <SendIcon />} Wyślij
          </Button>
        ) : sent ? (
          <Pill tone="accent">
            <CheckIcon className="size-3" /> wysłano
          </Pill>
        ) : undefined
      }
      className={cn(sent && 'border-primary/50')}
    >
      <dl className="mb-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Do</dt>
        <dd className="font-medium">{draft.to.join(', ')}</dd>
        <dt className="text-muted-foreground">Temat</dt>
        <dd className="font-medium">{draft.subject}</dd>
      </dl>
      <pre className="rounded-xl bg-background/50 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">{draft.body}</pre>
    </Panel>
  )
}

/** What the agent came back with: the spoken answer plus whatever its tools put on screen. */
export function AgentCardView({
  result,
  transcript,
  drafts,
  onSendDraft,
  sendingDraft,
  triggeredBy,
  debug,
  className,
}: {
  result: AgentResult
  transcript: TranscriptLine[]
  drafts: Record<string, EmailDraft>
  onSendDraft?: (draftId: string) => void
  sendingDraft?: string | null
  triggeredBy?: { speaker: string; text: string }
  debug?: boolean
  className?: string
}) {
  const citations = result.attachments.filter((a): a is Extract<Attachment, { type: 'citations' }> => a.type === 'citations').flatMap((a) => a.items)
  const visual = result.attachments.filter((a) => a.type !== 'citations')
  const usedWeb = result.steps.some((s) => s.tool === 'search_web')
  const usedGraph = result.steps.some((s) => s.tool === 'company_knowledge' || s.tool === 'get_entity' || s.tool === 'list_entities')
  return (
    <article className={cn('flex min-w-0 flex-col gap-5', className)} aria-live="polite">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Pill tone="accent">
            <SparklesIcon className="size-3" /> {ASSISTANT_NAME}
          </Pill>
          {usedGraph && <span>z danych firmy</span>}
          {usedWeb && <span>z internetu</span>}
          {result.needsInput && <Pill tone="destructive">potrzebuję informacji</Pill>}
        </div>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">{result.question}</h1>
        <Trigger triggeredBy={triggeredBy} />
      </header>

      <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 md:grid-cols-[auto_minmax(0,1fr)]">
        {result.headline ? (
          <div className="flex max-w-md min-w-[10rem] flex-col">
            <span className="text-xs text-muted-foreground">Odpowiedź</span>
            <span className="text-5xl font-semibold tracking-tight text-balance tabular-nums">{result.headline}</span>
          </div>
        ) : (
          <div className="hidden md:block" />
        )}
        <div className="flex flex-col gap-4 md:border-l md:border-border md:pl-6">
          <p className="text-xl leading-relaxed text-pretty">{result.answer}</p>
          {result.bullets.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-sm leading-relaxed">
              {result.bullets.map((b) => (
                <li key={b} className="flex gap-2.5">
                  <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          <Steps steps={result.steps} open={debug} />
        </div>
      </section>

      {visual.map((a, i) => {
        switch (a.type) {
          case 'screenshot':
            return (
              <Panel
                key={i}
                title={a.title || a.pageUrl}
                caption={
                  <a href={a.pageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                    <GlobeIcon className="size-3" /> {a.pageUrl}
                  </a>
                }
              >
                <img src={a.url} alt={`Zrzut ekranu: ${a.title || a.pageUrl}`} className="w-full rounded-xl border border-border" />
              </Panel>
            )
          case 'chart':
            return <Chart key={i} spec={a.spec} />
          case 'table':
            return (
              <Panel
                key={i}
                title={
                  <span className="inline-flex items-center gap-2">
                    <TableIcon className="size-4" /> {a.title}
                  </span>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-base">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {a.columns.map((c, ci) => (
                          <th key={ci} className="py-2 pr-4">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {a.rows.map((r, ri) => {
                        const chosen = a.highlight && r[0]?.toLowerCase().includes(a.highlight.toLowerCase())
                        return (
                          <tr key={ri} className={cn('border-b border-border/60 last:border-0', chosen && 'bg-primary/10')}>
                            {r.map((c, ci) => (
                              <td key={ci} className={cn('py-2.5 pr-4 align-top leading-snug', ci === 0 && 'font-semibold', chosen && ci === 0 && 'text-primary')}>
                                {c}
                                {chosen && ci === 0 && <Pill tone="accent" className="ml-2 align-middle">wybór</Pill>}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )
          case 'image':
            return (
              <Panel
                key={i}
                title={
                  <span className="inline-flex items-center gap-2">
                    <ImageIcon className="size-4" /> {a.title}
                  </span>
                }
                caption={a.prompt}
              >
                <img src={a.url} alt={a.title} className="w-full rounded-xl border border-border" />
              </Panel>
            )
          case 'document':
            return (
              <Panel
                key={i}
                title={
                  <span className="inline-flex items-center gap-2">
                    <FileTextIcon className="size-4" /> {a.title}
                  </span>
                }
                caption="Dokument zapisany w sesji spotkania."
              >
                <Markdown text={a.markdown} />
              </Panel>
            )
          case 'email_draft':
            return <EmailDraftCard key={i} draft={a} status={drafts[a.id]?.status ?? 'draft'} onSend={onSendDraft} sending={sendingDraft === a.id} />
          case 'note':
            return (
              <div key={i} className="rounded-2xl border border-border bg-card p-6">
                <NoteCardView note={a.note} transcript={transcript} />
              </div>
            )
          case 'task':
            return (
              <Panel key={i} title="Pracuję w tle" caption="Postęp widać na karcie po lewej; wynik pojawi się, gdy będzie gotowy.">
                <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-3.5" /> {a.task.label}…
                </p>
              </Panel>
            )
          default:
            return null
        }
      })}

      {debug && citations.length > 0 && (
        <Panel title="Na czym to opieram" caption="Fragmenty źródeł z grafu firmy, które agent przeczytał.">
          <ol className="flex flex-col gap-2">
            {citations.slice(0, 8).map((c) => (
              <li key={`${c.id}-${c.path}`} className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted font-mono text-[11px] text-muted-foreground">{c.id}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-xs text-muted-foreground">
                    <span className="truncate">{c.path.replace(/^knowledge\/synthetic\//, '')}</span>
                    {c.date && <span> · {formatDayMonth(c.date)}</span>}
                  </p>
                  <blockquote className="border-l-2 border-border pl-3 text-sm leading-relaxed whitespace-pre-line text-foreground/85">{c.quote}</blockquote>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {result.sources.length > 0 && (
        <Panel title="Źródła w internecie">
          <ul className="flex flex-col gap-1.5">
            {result.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline">
                  <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{s.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{new URL(s.url).hostname}</span>
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {debug && (
        <p className="font-mono text-[11px] text-muted-foreground">
          {result.model} · {result.latencyMs} ms · {result.steps.length} kroków
        </p>
      )}
    </article>
  )
}
