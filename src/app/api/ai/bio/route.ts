import { google } from "@ai-sdk/google";
import { generateText } from "ai";
export async function POST(req: Request) {
  try {
    const { name, cuisines, location, specialty } = await req.json();
    const { text } = await generateText({
      model: google("gemini-1.5-flash"),
      prompt: `Write a warm 2-sentence first-person bio for home chef ${name} in ${location} who specializes in ${cuisines}. Max 60 words.`,
    });
    return Response.json({ bio: text.trim() });
  } catch { return Response.json({ bio: "" }); }
}
