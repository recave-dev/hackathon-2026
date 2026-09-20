import type { ReactNode } from 'react'

/** Just enough Markdown for a board memo: headings, paragraphs, bullets, numbered lists, tables, rules, bold. */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  const lines = text.replace(/\r/g, '').split('\n')
  let i = 0
  let key = 0
  const inline = (s: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, idx) => (part.startsWith('**') && part.endsWith('**') ? <strong key={idx}>{part.slice(2, -2)}</strong> : part))
  const isBlockStart = (l: string) => /^(#{1,4}\s|\s*[-*]\s|\s*\d+[.)]\s|\||\s*(?:-{3,}|\*{3,}|_{3,})\s*$)/.test(l)

  while (i < lines.length) {
    const line = lines[i]!
    if (!line.trim()) {
      i++
      continue
    }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="border-border" />)
      i++
      continue
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1]!.length
      blocks.push(
        <p key={key++} className={level <= 2 ? 'mt-2 text-xl font-semibold tracking-tight' : 'mt-1 text-base font-semibold'}>
          {inline(heading[2]!)}
        </p>,
      )
      i++
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) items.push(lines[i]!.replace(/^\s*[-*]\s+/, '')), i++
      blocks.push(
        <ul key={key++} className="flex flex-col gap-1 pl-1 text-base leading-relaxed">
          {items.map((it, idx) => (
            <li key={idx} className="flex gap-2.5">
              <span aria-hidden className="mt-[0.65em] size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>{inline(it)}</span>
            </li>
          ))}
        </ul>,
      )
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]!)) items.push(lines[i]!.replace(/^\s*\d+[.)]\s+/, '')), i++
      blocks.push(
        <ol key={key++} className="flex list-decimal flex-col gap-1 pl-6 text-base leading-relaxed">
          {items.map((it, idx) => (
            <li key={idx}>{inline(it)}</li>
          ))}
        </ol>,
      )
      continue
    }
    if (line.trim().startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        const cells = lines[i]!.trim().slice(1, -1).split('|').map((c) => c.trim())
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells)
        i++
      }
      const [head, ...body] = rows
      blocks.push(
        <div key={key++} className="overflow-x-auto">
          <table className="w-full text-sm">
            {head && (
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {head.map((c, idx) => (
                    <th key={idx} className="py-1.5 pr-4">
                      {inline(c)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="border-b border-border/60 last:border-0">
                  {r.map((c, ci) => (
                    <td key={ci} className="py-1.5 pr-4 align-top tabular-nums">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    const para: string[] = [line]
    i++
    while (i < lines.length && lines[i]!.trim() && !isBlockStart(lines[i]!)) para.push(lines[i]!), i++
    blocks.push(
      <p key={key++} className="text-base leading-relaxed">
        {inline(para.join(' '))}
      </p>,
    )
  }
  return <div className="flex flex-col gap-3">{blocks}</div>
}
