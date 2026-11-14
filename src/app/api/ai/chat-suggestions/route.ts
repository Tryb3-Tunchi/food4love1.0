import { generateAiText } from '@/lib/ai/providers'
import { guardAiRequest } from '@/lib/ai/auth'
export async function POST(req: Request) {
  const denied = await guardAiRequest(req)
  if (denied) return denied
  try {
    const { chefName, cuisines } = await req.json()
    const text = await generateAiText({
      prompt: `Generate 3 short warm opening messages (max 12 words each) to send to a home chef named ${chefName} who cooks: ${(cuisines ?? []).join(', ')}. Return ONLY a JSON array of strings.`,
    })
    return Response.json({
      suggestions: JSON.parse(text.replace(/```json|```/g, '').trim()),
    })
  } catch {
    return Response.json({
      suggestions: [
        "What's your specialty today? 👀",
        'Are you available this weekend?',
        "What's your most popular dish?",
      ],
    })
  }
}
