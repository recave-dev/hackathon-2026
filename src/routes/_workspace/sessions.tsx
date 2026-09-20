import { Link, createFileRoute } from '@tanstack/react-router'
import { FileTextIcon, MailCheckIcon, MessagesSquareIcon, PlusIcon } from 'lucide-react'

import { EmptyHint, PageHeader, Pill } from '@/components/desktop/page'
import { Button } from '@/components/ui/button'
import { plural } from '@/demo/format'
import { ASSISTANT_NAME } from '@/lib/wake-word'
import { listSessions, type SessionSummary } from '@/server/meeting-assist'

export const Route = createFileRoute('/_workspace/sessions')({
  head: () => ({ meta: [{ title: `${ASSISTANT_NAME} · Sessions` }] }),
  staticData: { crumb: 'Sessions' },
  loader: () => listSessions(),
  // Sessions change while the room talks; show the current list on every visit.
  staleTime: 0,
  component: Sessions,
})

const dateFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long' })
const timeFmt = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' })

const sameDay = (a: number, b: number): boolean => new Date(a).toDateString() === new Date(b).toDateString()

/** "Dziś 14:32", "wczoraj 09:10", "3 września 11:05". */
function when(ms: number): string {
  const now = Date.now()
  if (sameDay(ms, now)) return `dziś ${timeFmt.format(ms)}`
  if (sameDay(ms, now - 86_400_000)) return `wczoraj ${timeFmt.format(ms)}`
  return `${dateFmt.format(ms)} ${timeFmt.format(ms)}`
}

const isEmpty = (s: SessionSummary): boolean => s.lineCount === 0 && s.documents === 0 && s.drafts === 0

function Sessions() {
  const sessions = Route.useLoaderData()
  const shown = sessions.filter((s) => !isEmpty(s))

  return (
    <>
      <PageHeader
        title="Sessions"
        description={`Każde spotkanie z ${ASSISTANT_NAME}iem to osobna sesja: transkrypcja, kontekst, dokumenty i maile. Otwórz sesję, żeby wrócić do rozmowy, albo zacznij nową z czystym kontekstem.`}
        action={
          <Button nativeButton={false} render={<Link to="/meeting" search={{ new: true }} />}>
            <PlusIcon /> Nowa sesja
          </Button>
        }
      />

      {shown.length === 0 ? (
        <EmptyHint>Nie było jeszcze żadnej sesji. Kliknij orb na dashboardzie albo „Nowa sesja”.</EmptyHint>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {shown.map((s) => (
            <li key={s.id}>
              <Link
                to="/meeting"
                search={{ session: s.id }}
                className="grid gap-x-6 gap-y-2 p-5 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 md:grid-cols-[minmax(0,1fr)_12rem]"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{when(s.createdAt)}</p>
                  <p className="text-base font-semibold leading-snug">{s.title}</p>
                  <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{s.summary ?? (s.firstLine ? `„${s.firstLine}”` : 'Bez transkrypcji.')}</p>
                </div>
                <div className="flex flex-col gap-1.5 text-xs text-muted-foreground md:items-end md:text-right">
                  <Pill tone={sameDay(s.updatedAt, Date.now()) ? 'accent' : 'muted'}>ostatnio {when(s.updatedAt)}</Pill>
                  <span className="inline-flex items-center gap-1">
                    <MessagesSquareIcon className="size-3.5" /> {s.lineCount} {plural(s.lineCount, 'wypowiedź', 'wypowiedzi', 'wypowiedzi')}
                    {s.askedCount > 0 && ` · ${s.askedCount} do ${ASSISTANT_NAME}a`}
                  </span>
                  {s.documents > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <FileTextIcon className="size-3.5" /> {s.documents} {plural(s.documents, 'dokument', 'dokumenty', 'dokumentów')}
                    </span>
                  )}
                  {s.sent > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <MailCheckIcon className="size-3.5" /> {s.sent} {plural(s.sent, 'mail wysłany', 'maile wysłane', 'maili wysłanych')}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
