import { useState } from 'react'

import { formatDayMonth, formatMoney, formatMonthShort } from '@/demo/format'
import { sumInvoices } from '@/demo/selectors'
import type { ContextSpend, Invoice } from '@/demo/types'
import { cn } from '@/lib/utils'

/** Single-series monthly bars. One hue, direct labels only where the amount changes, table beside for exact values. */
export function SpendChart({ spend, invoices }: { spend: ContextSpend; invoices: Invoice[] }) {
  const [active, setActive] = useState<string | null>(null)
  const max = Math.max(...invoices.map((i) => i.amount), 1)
  const current = invoices.find((i) => i.id === active) ?? null

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {invoices.length} faktur · razem{' '}
            <span className="font-semibold tabular-nums text-foreground">{formatMoney(sumInvoices(invoices), spend.currency)}</span>
          </p>
          <p className="min-h-4 text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {current ? `${formatDayMonth(current.date)} · ${formatMoney(current.amount, spend.currency)} · ${current.seats} miejsc` : ''}
          </p>
        </div>
        <div
          role="img"
          aria-label={`Miesięczne faktury: ${invoices.map((i) => `${formatMonthShort(i.date)} ${formatMoney(i.amount, spend.currency)}`).join(', ')}`}
          className="flex h-48 items-end gap-3 border-b border-border"
          onPointerLeave={() => setActive(null)}
        >
          {invoices.map((inv, index) => {
            const prev = invoices[index - 1]
            const changed = !prev || prev.amount !== inv.amount
            const height = Math.max(4, Math.round((inv.amount / max) * 100))
            return (
              <button
                key={inv.id}
                type="button"
                tabIndex={-1}
                aria-hidden
                onPointerEnter={() => setActive(inv.id)}
                onClick={() => setActive((a) => (a === inv.id ? null : inv.id))}
                className="group flex h-full flex-1 flex-col items-center justify-end gap-1 outline-none"
              >
                <span className={cn('text-[11px] tabular-nums text-muted-foreground', changed || active === inv.id ? 'visible' : 'invisible')}>
                  {inv.amount}
                </span>
                <span
                  className={cn('w-full max-w-10 rounded-t-[4px] bg-primary transition-opacity', active && active !== inv.id ? 'opacity-40' : 'opacity-90')}
                  style={{ height: `${height}%` }}
                />
              </button>
            )
          })}
        </div>
        <div className="-mt-1 flex gap-3">
          {invoices.map((inv) => (
            <span key={inv.id} className="flex-1 text-center text-[11px] text-muted-foreground">
              {formatMonthShort(inv.date)}
            </span>
          ))}
        </div>
      </div>

      <table className="w-full self-start text-sm">
        <caption className="sr-only">Faktury w wybranym okresie</caption>
        <thead>
          <tr className="text-[11px] text-muted-foreground">
            <th scope="col" className="pb-2 text-left font-medium">
              Faktura
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Miejsca
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Kwota
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border border-t border-border">
          {invoices.map((inv) => (
            <tr
              key={inv.id}
              className={cn('transition-colors', active === inv.id && 'bg-muted/60')}
              onPointerEnter={() => setActive(inv.id)}
              onPointerLeave={() => setActive(null)}
            >
              <td className="py-1.5">
                <span className="block leading-snug">{formatDayMonth(inv.date)}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{inv.number}</span>
              </td>
              <td className="py-1.5 text-right tabular-nums">{inv.seats}</td>
              <td className="py-1.5 text-right font-medium tabular-nums">{formatMoney(inv.amount, spend.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
