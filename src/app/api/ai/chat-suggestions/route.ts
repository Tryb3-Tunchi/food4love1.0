import { google } from "@ai-sdk/google";
import { generateText } from "ai";
export async function POST(req: Request) {
  try {
    const { chefName, cuisines } = await req.json();
    const { text } = await generateText({
      model: google("gemini-1.5-flash"),
      prompt: `Generate 3 short warm opening messages (max 12 words each) to send to a home chef named ${chefName} who cooks: ${(cuisines ?? []).join(", ")}. Return ONLY a JSON array of strings.`,
    });
    return Response.json({ suggestions: JSON.parse(text.replace(/```json|```/g, "").trim()) });
  } catch { return Response.json({ suggestions: ["What's your specialty today? 👀", "Are you available this weekend?", "What's your most popular dish?"] }); }
}
