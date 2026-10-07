import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function main() {
  console.log("Sending request to Gemini...");

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: "Say hello in one sentence.",
    config: {
      maxOutputTokens: 20,
    },
  });

  console.log("Gemini:", response.text);
}

main().catch(console.error);