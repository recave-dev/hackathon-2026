import { Link } from '@tanstack/react-router'
import { ChevronLeftIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type BackTarget = '/app/home' | '/app/decisions' | '/app/session'

export function Screen({
  title,
  eyebrow,
  description,
  back,
  action,
  children,
  className,
}: {
  title: ReactNode
  eyebrow?: ReactNode
  description?: ReactNode
  back?: { to: BackTarget; label: string }
  action?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex flex-1 flex-col gap-6 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]', className)}>
      <header className="flex flex-col gap-2">
        {back && (
          <Link
            to={back.to}
            className="-ml-1.5 inline-flex w-fit items-center gap-0.5 rounded-lg py-1 pr-2 pl-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
          >
            <ChevronLeftIcon className="size-4" />
            {back.label}
          </Link>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            {eyebrow && <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{eyebrow}</p>}
            <h1 className="text-[1.6rem] leading-tight font-semibold tracking-tight text-balance">{title}</h1>
            {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      </header>
      {children}
    </section>
  )
}

export function Section({
  title,
  hint,
  action,
  children,
  className,
  id,
}: {
  title: ReactNode
  hint?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cn('flex flex-col gap-3 scroll-mt-4', className)}>
      <div className="flex items-baseline justify-between gap-3 px-0.5">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {hint && <p className="-mt-2 px-0.5 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </section>
  )
}

export function EmptyHint({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-2xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function BulletList({ items, className }: { items: string[]; className?: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Brak.</p>
  return (
    <ul className={cn('flex flex-col gap-2 text-sm leading-relaxed', className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function DemoTag({ children = 'Szacunek na danych demo' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  )
}
