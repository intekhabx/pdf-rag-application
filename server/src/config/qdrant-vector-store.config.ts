import { QdrantVectorStore } from "@langchain/qdrant";
import embeddingModel from "./gemini-embedding.config.js";


const vectorStore = QdrantVectorStore.fromExistingCollection(embeddingModel, {
  url: process.env.QDRANT_ENDPOINT!,
  apiKey: process.env.QDRANT_API_KEY!,
  collectionName: "pdf-collection",
})


export default vectorStore;
