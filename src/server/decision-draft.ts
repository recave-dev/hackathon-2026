import { createServerFn } from '@tanstack/react-start'

import type { DraftBundle } from './graph-retrieval.ts'

export type { BundleEvidence, BundleNode, DraftBundle } from './graph-retrieval.ts'

/** Retrieves everything the company graph knows that bears on a decision question. */
export const fetchDraftBundle = createServerFn({ method: 'POST' })
  .inputValidator((input: { question: string }) => {
    const question = String(input?.question ?? '').trim().slice(0, 500)
    if (!question) throw new Error('Pytanie nie może być puste.')
    return { question }
  })
  .handler(async ({ data }): Promise<DraftBundle> => {
    // Dynamic import keeps node:sqlite and the graph module out of the client bundle.
    const { retrieveDraftBundle } = await import('./graph-retrieval.ts')
    return retrieveDraftBundle(data.question)
  })
