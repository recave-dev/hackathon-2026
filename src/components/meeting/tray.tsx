import { BarChart3Icon, DatabaseIcon, FileTextIcon, GlobeIcon, ImageIcon, LayersIcon, MailIcon, NotebookPenIcon, SparklesIcon, UserIcon } from 'lucide-react'
import type { ComponentType } from 'react'

import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export type TrayKind = 'person' | 'card' | 'answer' | 'data' | 'web' | 'note' | 'report' | 'screenshot' | 'chart' | 'document' | 'email'

export interface TrayItem {
  key: string
  kind: TrayKind
  title: string
  /** One line under the title: the question, or the person's role. */
  subtitle?: string
  /** running: still working in the background. fresh: finished, not yet looked at. */
  status: 'running' | 'fresh' | 'done'
  /** Seconds elapsed for running items. */
  seconds?: number
}

const ICON: Record<TrayKind, ComponentType<{ className?: string }>> = {
  person: UserIcon,
  card: LayersIcon,
  answer: SparklesIcon,
  data: DatabaseIcon,
  web: GlobeIcon,
  note: NotebookPenIcon,
  report: FileTextIcon,
  screenshot: ImageIcon,
  chart: BarChart3Icon,
  document: FileTextIcon,
  email: MailIcon,
}

const KIND_LABEL: Record<TrayKind, string> = {
  person: 'Osoba',
  card: 'Temat',
  answer: 'Odpowiedź',
  data: 'Dane firmy',
  web: 'Internet',
  note: 'Notatka',
  report: 'Raport',
  screenshot: 'Strona',
  chart: 'Wykres',
  document: 'Dokument',
  email: 'Mail',
}

/**
 * Small cards on the left for everything that is not on the main screen:
 * background work in progress, and results the room may want back.
 */
export function Tray({ items, onOpen, className }: { items: TrayItem[]; onOpen: (item: TrayItem) => void; className?: string }) {
  if (items.length === 0) return null
  return (
    <aside aria-label="W tle" className={cn('flex flex-col gap-2', className)}>
      {items.map((item) => {
        const Icon = ICON[item.kind]
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onOpen(item)}
            className={cn(
              'group flex w-full items-start gap-2.5 rounded-xl border bg-card p-3 text-left transition-all outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 animate-in fade-in slide-in-from-left-2 duration-300',
              item.status === 'fresh' ? 'border-primary/60 shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary),transparent_85%)]' : 'border-border',
              item.status === 'running' && 'border-dashed',
            )}
          >
            <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg', item.status === 'fresh' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              {item.status === 'running' ? <Spinner className="size-3.5" /> : <Icon className="size-3.5" aria-hidden />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {KIND_LABEL[item.kind]}
                {item.status === 'running' && <span className="normal-case tracking-normal">· w tle{item.seconds !== undefined ? ` ${item.seconds}s` : ''}</span>}
                {item.status === 'fresh' && <span className="rounded bg-primary/15 px-1 py-px text-primary normal-case tracking-normal">gotowe</span>}
              </span>
              <span className="line-clamp-2 text-sm leading-snug font-medium">{item.title}</span>
              {item.subtitle && <span className="line-clamp-1 text-xs text-muted-foreground">{item.subtitle}</span>}
            </span>
          </button>
        )
      })}
    </aside>
  )
}
