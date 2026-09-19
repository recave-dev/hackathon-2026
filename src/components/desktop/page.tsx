import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  action,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  meta?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          {eyebrow && <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{eyebrow}</p>}
          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">{title}</h1>
          {description && <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {meta && <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">{meta}</div>}
    </header>
  )
}

export function Panel({
  title,
  caption,
  action,
  children,
  className,
  id,
}: {
  title: ReactNode
  caption?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cn('flex flex-col gap-4 rounded-2xl border border-border bg-card p-5', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Pill({ children, tone = 'muted', className }: { children: ReactNode; tone?: 'muted' | 'accent' | 'destructive'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium',
        tone === 'accent' && 'bg-accent text-accent-foreground',
        tone === 'muted' && 'bg-muted text-muted-foreground',
        tone === 'destructive' && 'bg-destructive/10 text-destructive',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Figure({ label, value, hint, size = 'md' }: { label: string; value: string; hint?: string; size?: 'md' | 'lg' }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn('font-semibold tabular-nums', size === 'lg' ? 'text-2xl' : 'text-base')}>{value}</dd>
      {hint && <dd className="text-[11px] text-muted-foreground">{hint}</dd>}
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

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

export const initials = (name: string): string =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
