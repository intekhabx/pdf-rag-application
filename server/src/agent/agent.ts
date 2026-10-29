import { GoogleGenAI } from "@google/genai";
import getSystemPrompt from "./system-prompt.js";



const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY!,
});


const callChatLLM = async (userPrompt: string, retrievedContext: string) => {
  const interaction = await ai.interactions.create({
    model: "gemini-2.5-flash",
    input: userPrompt,
    system_instruction: getSystemPrompt(retrievedContext),
  });

  console.log("🤖 LLM Response Generated");
  return interaction.output_text;
}


export default callChatLLM;
