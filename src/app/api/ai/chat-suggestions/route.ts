import { generateAiText } from '@/lib/ai/providers'
import { hasSignedInAiUser } from '@/lib/ai/auth'
export async function POST(req: Request) {
  if (!(await hasSignedInAiUser()))
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
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
