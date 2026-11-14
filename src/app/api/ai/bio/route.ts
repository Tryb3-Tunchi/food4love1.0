import { generateAiText } from '@/lib/ai/providers'
import { guardAiRequest } from '@/lib/ai/auth'
export async function POST(req: Request) {
  const denied = await guardAiRequest(req)
  if (denied) return denied
  try {
    const { name, cuisines, location } = await req.json()
    const text = await generateAiText({
      prompt: `Write a warm 2-sentence first-person bio for home chef ${name} in ${location} who specializes in ${cuisines}. Max 60 words.`,
    })
    return Response.json({ bio: text.trim() })
  } catch {
    return Response.json({ bio: '' })
  }
}
