/**
 * Server-only: one thin door to the language model, through OpenRouter.
 * Every Bolek action that needs prose goes through here, so model choice,
 * web-search variant and JSON parsing live in one place.
 */

export interface WebSource {
  title: string
  url: string
}

export interface ChatResult<T> {
  data: T
  model: string
  latencyMs: number
  /** Web citations when the `:online` variant was used. */
  sources: WebSource[]
}

export function openrouterKey(): string | null {
  const explicit = process.env.OPENROUTER_API_KEY?.trim()
  if (explicit) return explicit
  const typesafe = process.env.TYPESAFE_API_KEY?.trim()
  return typesafe?.startsWith('sk-or-') ? typesafe : null
}

export const answerModel = (): string => process.env.ANSWER_MODEL?.trim() || 'anthropic/claude-haiku-4.5'

/** Pulls the first JSON object out of a model reply, tolerating code fences and chatter around it. */
export function parseJsonObject<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned) as T
}

interface Annotation {
  type?: string
  url_citation?: { url?: string; title?: string }
}

/** Asks for a JSON answer. `web: true` switches to OpenRouter's `:online` variant, which searches first. */
export async function chatJson<T>(opts: {
  system: string
  user: string
  web?: boolean
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
  model?: string
}): Promise<ChatResult<T>> {
  const key = openrouterKey()
  if (!key) throw new Error('Brak klucza OpenRouter (OPENROUTER_API_KEY).')
  const started = performance.now()
  const base = opts.model ?? answerModel()
  const model = opts.web && !base.endsWith(':online') ? `${base}:online` : base

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Bolek meeting assistant' },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.1,
      max_tokens: opts.maxTokens ?? 700,
      // The web plugin injects search results as text; JSON mode still works on top.
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 25000),
  })
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const body = (await res.json()) as { model?: string; choices?: { message?: { content?: string; annotations?: Annotation[] } }[] }
  const message = body.choices?.[0]?.message
  const sources: WebSource[] = []
  const seen = new Set<string>()
  for (const a of message?.annotations ?? []) {
    const url = a.url_citation?.url
    if (a.type === 'url_citation' && url && !seen.has(url)) {
      seen.add(url)
      sources.push({ url, title: a.url_citation?.title || url })
    }
  }
  return {
    data: parseJsonObject<T>(message?.content ?? '{}'),
    model: body.model ?? model,
    latencyMs: Math.round(performance.now() - started),
    sources,
  }
}
