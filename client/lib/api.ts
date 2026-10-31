import type {
  ChatAnswerResponse,
  ResponseDocsType,
  UploadProgress,
  UploadSuccessResponse,
} from "./types";



const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function watchUploadProgress( jobId: string, token: string,onProgress?: (progress: UploadProgress) => void ): Promise<void> {

  const res = await fetch(`${API_URL}/upload-events/${encodeURIComponent(jobId)}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Unable to follow PDF processing status.");
  }

  if (!res.body) {
    throw new Error("The server did not provide a PDF processing status stream.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");

        if (!data) continue;

        const progress = JSON.parse(data) as UploadProgress;
        onProgress?.(progress);

        if (progress.status === "failed") {
          throw new Error(progress.message);
        }

        if (progress.status === "completed") {
          return;
        }
      }

      if (done) break;
    }
  } 
  finally {
    reader.releaseLock();
  }

  throw new Error("The PDF processing status stream ended unexpectedly.");
}



export async function uploadPdf( file: File, token: string, onProgress?: (progress: UploadProgress) => void ): Promise<UploadSuccessResponse> {

  // console.log("[uploadPdf] Would POST to:", `${API_URL}/upload`);
  // console.log("[uploadPdf] Form field: pdf");
  // console.log("[uploadPdf] File:", file.name, `(${file.size} bytes, ${file.type})`);
  // console.log("[uploadPdf] Authorization: Bearer", token);


  const formData = new FormData();
  formData.append("pdf", file);

  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: formData,
    headers: {
      "Authorization": `Bearer ${token}`,
    }
  });

  // console.log("Response", res);

  if(!res.ok){
    throw new Error("Failed to upload file");
  }

  const data = await res.json();
  const jobId = data.jobId;

  if (typeof jobId !== "string" && typeof jobId !== "number") {
    throw new Error("The server did not return a PDF processing job ID.");
  }

  await watchUploadProgress(String(jobId), token, onProgress);

  return {
    message: "PDF uploaded and processed successfully",
    documentId: String(jobId),
    source: file.name,
  };
}

/**
 * Logs the chat request and returns a mock answer response.
 */
export async function askQuestion(question: string, token: string): Promise<ChatAnswerResponse> {

  // console.log("[askQuestion] Would POST to:", `${API_URL}/chat`);
  // console.log("[askQuestion] Question:", question);
  // console.log("[askQuestion] Authorization: Bearer", token);

  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    body: JSON.stringify({ userPrompt: question }),
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    }
  });

  // console.log("Response", res);

  if(!res.ok){
    throw new Error("Failed to get answer");
  }

  const data = await res.json();
  const documents = JSON.parse(data.documents) as ResponseDocsType[];
  // console.log("Retrieval Docs Data:", documents);

  const sources = documents.map((item, idx) => ({
    documentId: item.id,
    source: item.metadata.source,
    page: item.metadata.loc.pageNumber,
    chunkIndex: idx,
  }));

  return {
    answer: data.llmResponse ?? `Based on the uploaded document, here is a simulated answer to: "${question}". (This is a mock response — connect a real backend to get actual RAG answers.)`,
    sources: sources,
  };
}
