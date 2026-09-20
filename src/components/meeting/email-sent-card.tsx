import { CheckIcon, ChevronDownIcon, MailCheckIcon } from 'lucide-react'
import { useState } from 'react'

import { Pill } from '@/components/desktop/page'
import { ASSISTANT_NAME } from '@/lib/wake-word'
import type { EmailDraft } from '@/server/meeting-assist'
import { cn } from '@/lib/utils'

const when = (ms: number): string => new Date(ms).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })

/** Shown right after a draft went out: who got what, and when. */
export function EmailSentView({ draft, triggeredBy, className }: { draft: EmailDraft; triggeredBy?: { speaker: string; text: string }; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <article className={cn('flex min-w-0 flex-col gap-5', className)} aria-live="polite">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Pill tone="accent">
            <MailCheckIcon className="size-3" /> Mail
          </Pill>
          <span>skrzynka {ASSISTANT_NAME}</span>
        </div>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">Wysłano</h1>
        {triggeredBy && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">{triggeredBy.speaker}:</span> „{triggeredBy.text}”
          </p>
        )}
      </header>

      <section className="grid gap-6 rounded-2xl border border-primary/50 bg-card p-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex items-center justify-center md:pr-2">
          <span className="flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground animate-in zoom-in-50 duration-500">
            <CheckIcon className="size-12" strokeWidth={2.5} aria-hidden />
          </span>
        </div>
        <div className="flex flex-col gap-4 md:border-l md:border-border md:pl-6">
          <p className="text-xl leading-relaxed text-pretty">
            Mail do <span className="font-semibold">{draft.to.join(', ')}</span> poszedł {draft.sentAt ? `o ${when(draft.sentAt)}` : 'przed chwilą'}.
          </p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Temat</dt>
            <dd className="font-medium">{draft.subject}</dd>
            <dt className="text-muted-foreground">Nadawca</dt>
            <dd>{ASSISTANT_NAME} &lt;bolek@bielsko.ai&gt;</dd>
          </dl>
          <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
            {open ? 'Ukryj treść' : 'Pokaż treść'} <ChevronDownIcon className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
          </button>
          {open && <pre className="rounded-xl bg-background/50 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">{draft.body}</pre>}
        </div>
      </section>
    </article>
  )
}
