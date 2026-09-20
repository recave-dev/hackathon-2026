import { createServerFn } from '@tanstack/react-start'

import type { RelevanceInput, RelevanceResult } from './relevance.ts'

export type { JudgeMode, RelevanceAction, RelevanceInput, RelevanceResult, RelevanceTarget, TranscriptTurn } from './relevance.ts'

const clean = (value: unknown, max: number): string => String(value ?? '').trim().slice(0, max)

/** Asks Jev (or the offline fallback) whether the latest utterance deserves a card. */
export const judgeUtterance = createServerFn({ method: 'POST' })
  .inputValidator((input: RelevanceInput): RelevanceInput => {
    const recent = (Array.isArray(input?.recent) ? input.recent : [])
      .slice(-6)
      .map((t) => ({ speaker: clean(t?.speaker, 80), text: clean(t?.text, 600) }))
      .filter((t) => t.text)
    if (recent.length === 0) throw new Error('Brak wypowiedzi do oceny.')
    return {
      meeting: {
        title: clean(input?.meeting?.title, 120),
        goal: clean(input?.meeting?.goal, 300),
        participants: (Array.isArray(input?.meeting?.participants) ? input.meeting.participants : []).slice(0, 12).map((p) => clean(p, 80)),
      },
      recent,
      mode: input?.mode === 'command' ? 'command' : 'ambient',
    }
  })
  .handler(async ({ data }): Promise<RelevanceResult> => {
    // Dynamic import keeps the SDK and env access out of the client bundle.
    const { detectRelevance } = await import('./relevance.ts')
    return detectRelevance(data)
  })

export type { Citation, GraphAnswer } from './graph-answer.ts'

/** Answers an open question from the whole company graph with one fast LLM call. */
export const askGraph = createServerFn({ method: 'POST' })
  .inputValidator((input: { question: string; recent?: string[] }) => {
    const question = clean(input?.question, 500)
    if (!question) throw new Error('Pytanie nie może być puste.')
    const recent = (Array.isArray(input?.recent) ? input.recent : []).slice(-4).map((t) => clean(t, 300)).filter(Boolean)
    return { question, recent }
  })
  .handler(async ({ data }): Promise<import('./graph-answer.ts').GraphAnswer> => {
    const { answerFromGraph } = await import('./graph-answer.ts')
    return answerFromGraph(data)
  })

export type { ActionInput, ActionResult, AnswerResult, NoteResult, TaskResult, TranscriptLine } from './actions.ts'

const INTENT_IDS = ['person', 'data', 'meeting', 'general', 'web', 'report'] as const

/** Runs the action Jev picked for an addressed request. Fast ones resolve; background ones return a task to poll. */
export const runAction = createServerFn({ method: 'POST' })
  .inputValidator((input: import('./actions.ts').ActionInput): import('./actions.ts').ActionInput => {
    const intent = (INTENT_IDS as readonly string[]).includes(input?.intent) ? input.intent : 'general'
    const request = clean(input?.request, 600)
    if (!request) throw new Error('Pusta prośba.')
    const transcript = (Array.isArray(input?.transcript) ? input.transcript : [])
      .slice(-120)
      .map((l) => ({ id: clean(l?.id, 40), speaker: clean(l?.speaker, 80), text: clean(l?.text, 800), at: Number(l?.at) || 0, addressed: Boolean(l?.addressed) }))
      .filter((l) => l.id && l.text)
    return { intent, request, transcript }
  })
  .handler(async ({ data }) => {
    const { runAction: run } = await import('./actions.ts')
    return run(data)
  })

/** Polls a background task started by `runAction`. */
export const getTask = createServerFn({ method: 'POST' })
  .inputValidator((input: { taskId: string }) => ({ taskId: clean(input?.taskId, 64) }))
  .handler(async ({ data }) => {
    const { getTask: get } = await import('./actions.ts')
    return get(data.taskId) ?? null
  })
