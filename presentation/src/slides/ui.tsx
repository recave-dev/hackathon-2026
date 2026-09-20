import type { ReactNode } from 'react'

import { Cue } from '@/components/stage'

const cx = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(' ')

export interface SlideFrameProps {
  kicker?: string
  title: ReactNode
  lede?: ReactNode
  className?: string
  children?: ReactNode
}

/** Standard content slide: kicker, title, optional lede, then the body. */
export const SlideFrame = ({ kicker, title, lede, className, children }: SlideFrameProps) => (
  <div className={cx('slide-enter absolute inset-0 flex flex-col px-24 pt-20 pb-16', className)}>
    <header className="flex flex-col gap-3 pr-[220px]">
      {kicker && <span className="text-[13px] font-semibold tracking-[0.22em] text-accent uppercase">{kicker}</span>}
      <h1 className="m-0 text-[54px] leading-[1.05] font-semibold tracking-tight text-balance">{title}</h1>
      {lede && <p className="m-0 mt-1 max-w-[1100px] text-[22px] leading-snug text-muted">{lede}</p>}
    </header>
    <div className="relative mt-12 flex-1">{children}</div>
  </div>
)

export interface CardProps {
  cue?: string
  title?: ReactNode
  icon?: ReactNode
  tone?: 'default' | 'accent' | 'warm' | 'danger' | 'ok'
  className?: string
  children?: ReactNode
}

const TONE_RING: Record<NonNullable<CardProps['tone']>, string> = {
  default: 'border-line',
  accent: 'border-accent/40',
  warm: 'border-warm/40',
  danger: 'border-danger/40',
  ok: 'border-ok/40',
}

const TONE_TEXT: Record<NonNullable<CardProps['tone']>, string> = {
  default: 'text-foreground',
  accent: 'text-accent',
  warm: 'text-warm',
  danger: 'text-danger',
  ok: 'text-ok',
}

/** A panel the orb can point at when `cue` is given. */
export const Card = ({ cue, title, icon, tone = 'default', className, children }: CardProps) => {
  const body = (
    <>
      {(icon || title) && (
        <div className={cx('flex items-center gap-3 text-[22px] font-semibold tracking-tight', TONE_TEXT[tone])}>
          {icon && <span className="grid size-10 place-items-center rounded-xl bg-white/6 [&>svg]:size-5">{icon}</span>}
          {title}
        </div>
      )}
      {children && <div className={cx('text-[19px] leading-snug text-muted', Boolean(icon || title) && 'mt-4')}>{children}</div>}
    </>
  )
  const classes = cx('rounded-2xl border bg-surface p-7', TONE_RING[tone], className)
  return cue ? (
    <Cue id={cue} className={classes}>
      {body}
    </Cue>
  ) : (
    <div className={classes}>{body}</div>
  )
}

export interface StatProps {
  value: ReactNode
  label: ReactNode
  tone?: CardProps['tone']
  className?: string
}

export const Stat = ({ value, label, tone = 'default', className }: StatProps) => (
  <div className={cx('flex flex-col gap-1', className)}>
    <span className={cx('text-[44px] leading-none font-semibold tracking-tight tabular-nums', TONE_TEXT[tone])}>{value}</span>
    <span className="text-[16px] text-muted">{label}</span>
  </div>
)

export const Pill = ({ children, tone = 'default', className }: { children: ReactNode; tone?: CardProps['tone']; className?: string }) => (
  <span
    className={cx(
      'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[14px] font-medium tracking-tight',
      TONE_RING[tone],
      TONE_TEXT[tone],
      'bg-white/4',
      className,
    )}
  >
    {children}
  </span>
)

export const Mono = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cx('font-mono text-[0.92em] tracking-tight text-foreground/90', className)}>{children}</span>
)

/** Bulleted list with restrained styling for slide bodies. */
export const Bullets = ({ items, className }: { items: ReactNode[]; className?: string }) => (
  <ul className={cx('m-0 flex list-none flex-col gap-2.5 p-0', className)}>
    {items.map((item, i) => (
      <li key={i} className="flex items-start gap-3">
        <span className="mt-[11px] size-1.5 flex-none rounded-full bg-accent/80" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
)
