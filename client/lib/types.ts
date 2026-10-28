export type ChatRole = "user" | "assistant";

export interface SourceReference {
  documentId: string;
  source: string;
  page: number;
  chunkIndex: number;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  sources?: SourceReference[];
  timestamp: number;
}

// Response shapes returned by the API stubs (and by the real backend later)
export interface UploadSuccessResponse {
  message: string;
  documentId: string;
  source: string;
}

export interface ChatAnswerResponse {
  answer: string;
  sources: SourceReference[];
}

export interface ChatNoInfoResponse {
  answer: null;
  message: string;
  sources: SourceReference[];
}
