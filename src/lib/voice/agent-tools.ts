import { formatDue } from '@/demo/format'
import { openTasks, pendingDecisions, personName, projectLabel } from '@/demo/selectors'
import type { DemoState, Id } from '@/demo/types'
import type { VoiceTool } from './grok-voice'

/** What the voice agent can put on the screen next to the orb. */
export type ScreenArtifact =
  | { kind: 'decision'; id: Id }
  | { kind: 'decisions' }
  | { kind: 'tasks' }
  | { kind: 'note'; title?: string; text: string }

export const SHOW_ON_SCREEN = 'show_on_screen'

export const VOICE_TOOLS: VoiceTool[] = [
  {
    name: SHOW_ON_SCREEN,
    description:
      'Pokazuje coś na ekranie obok kuli, żeby rozmówcy mogli to zobaczyć. ' +
      'Użyj, gdy ktoś prosi o pokazanie sprawy, listy spraw do decyzji, zadań zespołu, ' +
      'albo gdy chcesz zapisać krótką notatkę na ekranie (np. ustalenia). ' +
      'Dla kind="decision" podaj id sprawy z listy w instrukcjach. Dla kind="note" podaj text.',
    parameters: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['decision', 'decisions', 'tasks', 'note'],
          description: 'decision: jedna sprawa do decyzji; decisions: lista spraw; tasks: otwarte zadania; note: notatka tekstowa',
        },
        id: { type: 'string', description: 'Id sprawy, wymagane dla kind="decision"' },
        title: { type: 'string', description: 'Krótki tytuł notatki dla kind="note"' },
        text: { type: 'string', description: 'Treść notatki dla kind="note", 1-3 zdania' },
      },
      required: ['kind'],
    },
  },
]

/** Parses the model's arguments; returns an error message the model can act on. */
export function parseArtifact(state: DemoState, args: Record<string, unknown>): { artifact: ScreenArtifact } | { error: string } {
  const kind = args.kind
  switch (kind) {
    case 'decisions':
      return { artifact: { kind } }
    case 'tasks':
      return { artifact: { kind } }
    case 'note': {
      const text = typeof args.text === 'string' ? args.text.trim() : ''
      if (!text) return { error: 'Dla kind="note" podaj niepuste pole text.' }
      return { artifact: { kind, text, title: typeof args.title === 'string' ? args.title : undefined } }
    }
    case 'decision': {
      const id = typeof args.id === 'string' ? args.id : ''
      const decision = state.decisions.find((d) => d.id === id)
      if (!decision) {
        const known = pendingDecisions(state).map((d) => `${d.id}: ${d.title}`)
        return { error: `Nie ma sprawy o id "${id}". Dostępne: ${known.join('; ')}` }
      }
      return { artifact: { kind, id } }
    }
    default:
      return { error: `Nieznany kind "${String(kind)}". Użyj decision, decisions, tasks lub note.` }
  }
}

export function describeArtifact(state: DemoState, artifact: ScreenArtifact): string {
  switch (artifact.kind) {
    case 'decision':
      return `Pokazano sprawę: ${state.decisions.find((d) => d.id === artifact.id)?.title ?? artifact.id}`
    case 'decisions':
      return `Pokazano listę ${pendingDecisions(state).length} spraw do decyzji`
    case 'tasks':
      return `Pokazano ${openTasks(state).length} otwartych zadań`
    case 'note':
      return `Pokazano notatkę: ${artifact.title ?? artifact.text.slice(0, 40)}`
  }
}

/** System prompt with the live demo state, so the model can name ids without a lookup tool. */
export function buildInstructions(state: DemoState): string {
  const decisions = pendingDecisions(state)
    .map((d) => `- ${d.id} · "${d.title}" · projekt: ${projectLabel(state, d.projectId)} · termin: ${formatDue(d.dueAt, state.now)}`)
    .join('\n')
  const tasks = openTasks(state)
    .map((t) => `- ${t.id} · "${t.title}" · ${personName(state, t.ownerId)} · termin: ${formatDue(t.dueAt, state.now)}`)
    .join('\n')
  const people = state.people.map((p) => `- ${p.name} (${p.role}${p.company ? `, ${p.company}` : ''})`).join('\n')

  return [
    'Jesteś Droker, asystent zarządu firmy Droker. Rozmawiasz po polsku, jak spokojny współpracownik na spotkaniu.',
    'Odpowiadaj krótko: jedno lub dwa zdania, bez list i bez czytania identyfikatorów na głos.',
    'Gdy ktoś prosi, żeby coś pokazać, wyświetlić albo "rzucić na ekran", wywołaj narzędzie show_on_screen i potwierdź jednym zdaniem, co pokazujesz.',
    'Gdy ktoś podaje ustalenie do zapisania, wywołaj show_on_screen z kind="note".',
    'Nie zmyślaj faktów spoza poniższego stanu. Jeśli czegoś nie ma w stanie, powiedz to wprost.',
    '',
    `Dziś jest ${state.now.slice(0, 10)}.`,
    '',
    'Sprawy do decyzji (id · tytuł · projekt · termin):',
    decisions || '- brak',
    '',
    'Otwarte zadania zespołu:',
    tasks || '- brak',
    '',
    'Osoby:',
    people,
  ].join('\n')
}

/** Names and product words that bias speech recognition. */
export function buildKeyterms(state: DemoState): string[] {
  const names = state.people.flatMap((p) => p.name.split(' '))
  const projects = state.projects.flatMap((p) => [p.name, p.client ?? ''])
  return Array.from(new Set(['Droker', ...names, ...projects].filter(Boolean))).slice(0, 100)
}
