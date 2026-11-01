// Server only. Talks to Gemini first and falls back to Grok (xAI) so Chef Chi
// keeps answering if one provider is down, rate limited or out of credit.
// Keys come from env vars and never reach the browser:
//   GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY), XAI_API_KEY
// Models can be changed without a deploy of new code: GEMINI_MODEL, XAI_MODEL.

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AiReply {
  text: string
  provider: 'gemini' | 'grok'
}

export class AiUnavailableError extends Error {}

const TIMEOUT_MS = 20_000
const MAX_TOKENS = 1024

// Providers reject two turns in a row from the same side, and a chat must
// start with the user. A failed earlier reply can leave either situation.
function tidy(history: ChatTurn[]) {
  const turns: ChatTurn[] = []
  for (const turn of history) {
    const last = turns[turns.length - 1]
    if (last && last.role === turn.role) last.content += `\n${turn.content}`
    else if (last || turn.role === 'user') turns.push({ ...turn })
  }
  return turns
}

async function askGemini(
  key: string,
  system: string,
  turns: ChatTurn[],
): Promise<string> {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: turns.map((t) => ({
          role: t.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: t.content }],
        })),
        generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.8 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  )
  if (!res.ok) throw new Error(`Gemini responded ${res.status}`)
  const data = await res.json()
  const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? []
  return parts.map((p) => p.text ?? '').join('')
}

async function askGrok(
  key: string,
  system: string,
  turns: ChatTurn[],
): Promise<string> {
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.XAI_MODEL || 'grok-3-mini',
      messages: [{ role: 'system', content: system }, ...turns],
      max_tokens: MAX_TOKENS,
      temperature: 0.8,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Grok responded ${res.status}`)
  const data = await res.json()
  return data?.choices?.[0]?.message?.content ?? ''
}

export function isAiConfigured() {
  return !!(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.XAI_API_KEY
  )
}

export async function generateChiReply({
  system,
  history,
}: {
  system: string
  history: ChatTurn[]
}): Promise<AiReply> {
  const turns = tidy(history)
  const geminiKey =
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const xaiKey = process.env.XAI_API_KEY

  const attempts: {
    provider: AiReply['provider']
    run: () => Promise<string>
  }[] = []
  if (geminiKey)
    attempts.push({
      provider: 'gemini',
      run: () => askGemini(geminiKey, system, turns),
    })
  if (xaiKey)
    attempts.push({
      provider: 'grok',
      run: () => askGrok(xaiKey, system, turns),
    })
  if (!attempts.length) throw new AiUnavailableError('No AI key configured')

  for (const { provider, run } of attempts) {
    try {
      const text = (await run()).trim()
      if (text) return { text, provider }
      console.error(`[chef-chi] ${provider} returned an empty reply`)
    } catch (error) {
      console.error(
        `[chef-chi] ${provider} failed:`,
        error instanceof Error ? error.message : error,
      )
    }
  }
  throw new AiUnavailableError('All AI providers failed')
}
