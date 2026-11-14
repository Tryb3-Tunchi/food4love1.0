import { generateAiText } from '@/lib/ai/providers'
import { guardAiRequest } from '@/lib/ai/auth'
export async function POST(req: Request) {
  const denied = await guardAiRequest(req)
  if (denied) return denied
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
