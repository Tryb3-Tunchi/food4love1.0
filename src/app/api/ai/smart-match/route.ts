import { google } from "@ai-sdk/google";
import { generateText } from "ai";
export async function POST(req: Request) {
  try {
    const { userProfile, chefProfiles } = await req.json();
    const { text } = await generateText({
      model: google("gemini-1.5-flash") as any,
      prompt: `You are a food matching AI. Rank these chefs for this user.
User taste profile: ${JSON.stringify(userProfile)}
Chefs: ${JSON.stringify(chefProfiles.map((c: any) => ({ id: c.id, cuisines: c.cuisines, priceMin: c.price_min, rating: c.rating })))}
Return ONLY a JSON array of chef IDs sorted best-match first.`,
    });
    return Response.json({ ranked: JSON.parse(text.replace(/```json|```/g, "").trim()) });
  } catch { return Response.json({ ranked: [] }); }
}
