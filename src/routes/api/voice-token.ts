import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

const XAI_CLIENT_SECRETS = 'https://api.x.ai/v1/realtime/client_secrets'
const TOKEN_TTL_SEC = 300

/**
 * Mints a short-lived xAI client secret so the browser can open the realtime
 * WebSocket itself. The long-lived API key never leaves the server.
 * Responds 503 when no key is configured; the UI then falls back to the script.
 */
export const Route = createFileRoute('/api/voice-token')({
  server: {
    handlers: {
      POST: async () => {
        const apiKey = process.env.XAI_API_KEY
        if (!apiKey) return json({ error: 'XAI_API_KEY is not configured' }, { status: 503 })

        const res = await fetch(XAI_CLIENT_SECRETS, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ expires_after: { seconds: TOKEN_TTL_SEC } }),
        })
        if (!res.ok) {
          const detail = await res.text()
          console.error('[voice-token] xAI responded', res.status, detail)
          return json({ error: `xAI token request failed (${res.status})` }, { status: 502 })
        }

        const data = (await res.json()) as Record<string, unknown>
        const token = extractToken(data)
        if (!token) {
          console.error('[voice-token] unexpected token payload', data)
          return json({ error: 'xAI returned no token' }, { status: 502 })
        }
        return json({ token, expiresInSec: TOKEN_TTL_SEC })
      },
    },
  },
})

/** The docs do not pin the field name, so accept the shapes seen in the wild. */
function extractToken(data: Record<string, unknown>): string | undefined {
  const direct = data.value ?? data.token ?? data.client_secret
  if (typeof direct === 'string') return direct
  if (direct && typeof direct === 'object' && typeof (direct as { value?: unknown }).value === 'string') {
    return (direct as { value: string }).value
  }
  return undefined
}
