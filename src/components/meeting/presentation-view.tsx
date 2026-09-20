import { ChevronLeftIcon, ChevronRightIcon, PresentationIcon, XIcon } from 'lucide-react'

import { Markdown } from '@/components/meeting/markdown'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ASSISTANT_NAME } from '@/lib/wake-word'
import type { Deck } from '@/lib/slides'
import { cn } from '@/lib/utils'

/**
 * Focus mode for a presentation: one big slide, steered by voice ("następny",
 * "poprzedni", "slajd trzeci") or keyboard. Fills the meeting screen.
 */
export function PresentationView({ deck, slide, onMove, onClose, className }: { deck: Deck | undefined; slide: number; onMove: (index: number) => void; onClose: () => void; className?: string }) {
  const total = deck?.slides.length ?? 0
  const current = deck?.slides[Math.min(slide, Math.max(0, total - 1))]
  const isFirst = slide <= 0
  const isLast = total === 0 || slide >= total - 1
  const isTitle = current?.index === 0

  return (
    <section className={cn('flex h-full min-h-0 flex-col', className)} aria-label={deck ? `Prezentacja: ${deck.title}` : 'Prezentacja'}>
      <header className="flex shrink-0 items-center gap-3 px-1 text-sm text-muted-foreground">
        <PresentationIcon className="size-4" />
        <span className="truncate font-medium text-foreground/80">{deck?.title ?? 'Otwieram prezentację…'}</span>
        {total > 0 && (
          <span className="tabular-nums">
            {slide + 1} / {total}
          </span>
        )}
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onClose} title={`Albo powiedz „${ASSISTANT_NAME}, zamknij”`}>
          <XIcon /> Zamknij
        </Button>
      </header>

      <div className="relative mt-3 flex min-h-0 flex-1 items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => onMove(slide - 1)} disabled={isFirst} aria-label="Poprzedni slajd" className="hidden shrink-0 md:inline-flex">
          <ChevronLeftIcon className="size-6" />
        </Button>

        <div className="relative min-h-0 flex-1 self-stretch">
          {current ? (
            <article
              key={current.index}
              className={cn(
                'absolute inset-0 flex flex-col overflow-y-auto rounded-3xl border border-border bg-card px-10 py-9 shadow-lg animate-in fade-in slide-in-from-right-2 duration-300 md:px-16 md:py-12',
                isTitle && 'items-center justify-center text-center',
              )}
            >
              <h1 className={cn('font-semibold tracking-tight text-balance', isTitle ? 'text-5xl md:text-6xl' : 'text-4xl md:text-5xl')}>{current.title}</h1>
              {current.body && (
                <div className={cn('mt-8 max-w-4xl [&_li]:text-2xl [&_ol]:gap-3 [&_p]:text-2xl [&_table]:text-xl [&_td]:py-2.5 [&_th]:text-sm [&_ul]:gap-3', isTitle && 'text-muted-foreground [&_li]:justify-center')}>
                  <Markdown text={current.body} />
                </div>
              )}
            </article>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center rounded-3xl border border-dashed border-border text-muted-foreground">
              <Spinner className="mr-2 size-4" /> Otwieram prezentację…
            </div>
          )}
        </div>

        <Button variant="ghost" size="icon" onClick={() => onMove(slide + 1)} disabled={isLast} aria-label="Następny slajd" className="hidden shrink-0 md:inline-flex">
          <ChevronRightIcon className="size-6" />
        </Button>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-4 px-1 pt-3 text-xs text-muted-foreground">
        <div className="flex gap-1" aria-hidden>
          {deck?.slides.map((s) => (
            <button key={s.index} type="button" onClick={() => onMove(s.index)} title={s.title} className={cn('h-1.5 rounded-full transition-all', s.index === slide ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground')} />
          ))}
        </div>
        <p className="truncate">
          Powiedz „następny”, „poprzedni”, „slajd trzeci” albo „{ASSISTANT_NAME}, zamknij”. Strzałki też działają.
        </p>
      </footer>
    </section>
  )
}
