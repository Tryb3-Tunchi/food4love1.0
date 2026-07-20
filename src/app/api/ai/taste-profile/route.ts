import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
export async function POST(req: Request) {
  try {
    const { description } = await req.json()
    const { text } = await generateText({
      model: google('gemini-1.5-flash') as any,
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
