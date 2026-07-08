import { google } from "@ai-sdk/google";
import { generateText } from "ai";
export async function POST(req: Request) {
  try {
    const { dispute } = await req.json();
    const { text } = await generateText({
      model: google("gemini-1.5-flash") as any,
      prompt: `You are a fair dispute resolution AI for a food marketplace.
Dispute details: ${JSON.stringify(dispute)}
Return ONLY JSON: { "recommendation": "refund_buyer"|"pay_chef"|"partial_refund"|"needs_review", "confidence": number, "reasoning": string, "suggestedAction": string, "fairSplit": number }`,
    });
    return Response.json(JSON.parse(text.replace(/```json|```/g, "").trim()));
  } catch { return Response.json({ recommendation: "needs_review", confidence: 0, reasoning: "Unable to analyze automatically", suggestedAction: "Escalate to human review", fairSplit: 50 }); }
}
