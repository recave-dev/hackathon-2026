import type { ReactNode } from 'react'

export function Screen({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <section className="flex flex-1 flex-col gap-6 px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </header>
      {children}
    </section>
  )
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}
