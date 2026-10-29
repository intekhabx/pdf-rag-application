import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";


const embeddingModel = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  apiKey: process.env.GOOGLE_API_KEY!,
});


export default embeddingModel;
