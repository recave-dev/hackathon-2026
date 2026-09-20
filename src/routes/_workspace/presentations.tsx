import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { LayersIcon, PlayIcon, PlusIcon, UploadIcon, XIcon } from 'lucide-react'
import { useState, type ChangeEvent, type FormEvent } from 'react'

import { EmptyHint, PageHeader, Pill } from '@/components/desktop/page'
import { Button } from '@/components/ui/button'
import { plural } from '@/demo/format'
import { ASSISTANT_NAME } from '@/lib/wake-word'
import { listPresentations, savePresentation } from '@/server/meeting-assist'

export const Route = createFileRoute('/_workspace/presentations')({
  head: () => ({ meta: [{ title: `${ASSISTANT_NAME} · Presentations` }] }),
  staticData: { crumb: 'Presentations' },
  loader: () => listPresentations(),
  staleTime: 0,
  component: Presentations,
})

const dateFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })

const EXAMPLE = `# Tytuł prezentacji

Podtytuł albo data

---

## Pierwszy slajd

- punkt
- punkt

---

## Drugi slajd

| Kolumna | Wartość |
| --- | --- |
| A | 1 |
`

function Presentations() {
  const decks = Route.useLoaderData()
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    file
      .text()
      .then((text) => {
        setMarkdown(text)
        if (!title) setTitle(file.name.replace(/\.(md|markdown|txt)$/i, ''))
      })
      .catch(() => setError('Nie udało się odczytać pliku.'))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    savePresentation({ data: { title, markdown } })
      .then(() => {
        setAdding(false)
        setTitle('')
        setMarkdown('')
        return router.invalidate()
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setSaving(false))
  }

  return (
    <>
      <PageHeader
        title="Presentations"
        description={`Prezentacje firmy w Markdown, slajdy oddzielone linią „---”. Na spotkaniu powiedz „${ASSISTANT_NAME}, otwórz prezentację o budżecie”, a potem steruj głosem: „następny”, „poprzedni”, „slajd trzeci”, „${ASSISTANT_NAME}, zamknij”.`}
        action={
          <Button onClick={() => setAdding((a) => !a)} variant={adding ? 'outline' : 'default'}>
            {adding ? <XIcon /> : <PlusIcon />} {adding ? 'Anuluj' : 'Dodaj prezentację'}
          </Button>
        }
      />

      {adding && (
        <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Tytuł</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="np. Przegląd Q4 2026"
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Plik .md</span>
              <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground hover:text-foreground">
                <UploadIcon className="size-4" /> Wybierz plik
                <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={onFile} className="sr-only" />
              </span>
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Treść</span>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder={EXAMPLE}
              rows={14}
              className="rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={saving || !markdown.trim()}>
              {saving ? 'Zapisuję…' : 'Zapisz'}
            </Button>
          </div>
        </form>
      )}

      {decks.length === 0 ? (
        <EmptyHint>Nie ma jeszcze żadnej prezentacji.</EmptyHint>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {decks.map((d) => (
            <li key={d.id}>
              <Link
                to="/meeting"
                search={{ present: d.id }}
                className="grid gap-x-6 gap-y-2 p-5 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 md:grid-cols-[minmax(0,1fr)_12rem]"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{dateFmt.format(d.updatedAt)}</p>
                  <p className="text-base font-semibold leading-snug">{d.title}</p>
                  {d.description && <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{d.description}</p>}
                </div>
                <div className="flex flex-col gap-1.5 text-xs text-muted-foreground md:items-end md:text-right">
                  <Pill tone={d.source === 'added' ? 'accent' : 'muted'}>{d.source === 'added' ? 'dodana' : 'wbudowana'}</Pill>
                  <span className="inline-flex items-center gap-1">
                    <LayersIcon className="size-3.5" /> {d.slides} {plural(d.slides, 'slajd', 'slajdy', 'slajdów')}
                  </span>
                  <span className="inline-flex items-center gap-1 text-primary">
                    <PlayIcon className="size-3.5" /> otwórz na spotkaniu
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
