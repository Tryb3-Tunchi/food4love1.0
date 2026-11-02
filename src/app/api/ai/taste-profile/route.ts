import { generateAiText } from '@/lib/ai/providers'
import { hasSignedInAiUser } from '@/lib/ai/auth'
export async function POST(req: Request) {
  if (!(await hasSignedInAiUser()))
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { description } = await req.json()
    const text = await generateAiText({
      prompt: `Extract a structured taste profile from this food description: "${description}"
Return ONLY JSON: { "cuisines": string[], "priceRange": "budget"|"mid"|"premium", "spiceLevel": "mild"|"medium"|"hot", "dietaryNeeds": string[], "mealTimes": string[] }`,
    })
    return Response.json(JSON.parse(text.replace(/```json|```/g, '').trim()))
  } catch {
    return Response.json({
      cuisines: [],
      priceRange: 'mid',
      spiceLevel: 'medium',
      dietaryNeeds: [],
      mealTimes: [],
    })
  }
}
