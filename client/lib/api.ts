import type {
  ChatAnswerResponse,
  UploadSuccessResponse,
} from "./types";



const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";



export async function uploadPdf(file: File, token: string ): Promise<UploadSuccessResponse> {

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

  return {
    message: data.message ?? "File uploaded and processed successfully",
    documentId: data.jobId ?? `doc-${Date.now()}`,
    source: file.name,
  };
}

/**
 * Logs the chat request and returns a mock answer response.
 */
export async function askQuestion(question: string, token: string): Promise<ChatAnswerResponse> {

  console.log("[askQuestion] Would POST to:", `${API_URL}/chat`);
  console.log("[askQuestion] Question:", question);
  console.log("[askQuestion] Authorization: Bearer", token);

  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    body: JSON.stringify({ userPrompt: question }),
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    }
  });

  console.log("Response", res);

  return {
    answer: `Based on the uploaded document, here is a simulated answer to: "${question}". (This is a mock response — connect a real backend to get actual RAG answers.)`,
    sources: [
      {
        documentId: "doc_mock",
        source: "uploaded-document.pdf",
        page: 1,
        chunkIndex: 0,
      },
    ],
  };
}
