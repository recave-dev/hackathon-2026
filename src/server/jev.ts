/**
 * Server-only: one place to talk to the TypeSafe Jev model, directly
 * (`TYPESAFE_API_KEY`) or through OpenRouter (`OPENROUTER_API_KEY`, or an
 * `sk-or-` key in either variable).
 */

export type JevTransport = { via: 'openrouter'; apiKey: string; model: string } | { via: 'typesafe'; apiKey: string }

export function jevTransport(): JevTransport | null {
  const openrouter = process.env.OPENROUTER_API_KEY?.trim()
  const typesafe = process.env.TYPESAFE_API_KEY?.trim()
  const model = process.env.JEV_MODEL?.trim() || 'typesafe/jev-1.13'
  if (openrouter) return { via: 'openrouter', apiKey: openrouter, model }
  if (typesafe?.startsWith('sk-or-')) return { via: 'openrouter', apiKey: typesafe, model }
  if (typesafe) return { via: 'typesafe', apiKey: typesafe }
  return null
}

export interface JevChoice {
  type: 'choice'
  choice: string
  confidence?: number
  probabilities?: Record<string, number>
}

export interface JevNoul {
  type: 'noul'
  noul: number
}

/** One System One call; `answers` come back keyed like `questions`. */
export async function askJev<A>(t: JevTransport, state: unknown, questions: Record<string, unknown>, timeoutMs = 6000): Promise<{ answers: A; model: string }> {
  if (t.via === 'openrouter') {
    const res = await fetch('https://openrouter.ai/api/alpha/decisions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${t.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: t.model, state, questions }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const body = (await res.json()) as { model: string; answers: A }
    return { answers: body.answers, model: body.model }
  }
  const { TypeSafeClient } = await import('@typesafe-ai/sdk')
  const client = new TypeSafeClient({ apiKey: t.apiKey, timeout: timeoutMs, retry: { maxRetries: 0 } })
  const res = await client.systemOne({ state: state as never, questions: questions as never })
  return { answers: res.answers as unknown as A, model: res.model }
}
