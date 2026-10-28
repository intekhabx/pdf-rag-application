# Implementation Plan: PDF RAG System

## Overview

This plan implements a two-tier PDF RAG (Retrieval-Augmented Generation) system: an Express 5 backend that runs a LangChain RAG pipeline powered by Google Gemini, and a Next.js 16 frontend with upload and chat interfaces. The backend owns PDF loading, text chunking, embedding, in-memory vector storage, similarity retrieval, and LLM answer generation. The frontend provides client-side file validation, a chat interface with session-scoped history, and Clerk-based cross-origin Bearer token authentication. The existing multer middleware (PDF-only, 10 MB limit) and Clerk frontend integration are reused.

## Tasks

- [ ] 1. Backend setup: dependencies, configuration, and shared types
  - [ ] 1.1 Install backend dependencies and configure test runner
    - Install runtime deps: `@langchain/google-genai`, `@langchain/community`, `langchain`, `@clerk/express`, `cors`, `dotenv`
    - Install dev deps: `vitest`, `fast-check`, `supertest`, `@types/cors`, `@types/supertest`
    - Add `test` script (`vitest run`) to `package.json`
    - Create `vitest.config.ts` with node environment and TypeScript path aliases
    - Note: server uses ESM (`"type": "module"`, `module: "nodenext"`) with `.js` import extensions and `verbatimModuleSyntax` — use `import type` for type-only imports
    - _Requirements: 2.1–2.4, 4.1–4.6, 5.2, 6.1 (foundational)_

  - [ ] 1.2 Create backend shared types, domain error classes, and Clerk request typing
    - Create `src/types/index.ts` with `ChunkMetadata`, `SourceReference`, `UploadSuccessResponse`, `ChatAnswerResponse`, `ChatNoInfoResponse`, `ErrorResponse`, `DocumentRecord`
    - Create domain error classes: `ExtractionError`, `EmbeddingError`, `StorageError`, `LLMError`, `AuthError`
    - Create `src/types/globals.d.ts` to type `req.auth` (Clerk `Auth` object with `userId`) on Express requests
    - _Requirements: 2.4, 4.5, 6.1, 6.3_

  - [ ] 1.3 Create backend environment config loader
    - Create `src/config/env.ts` that loads and validates `GOOGLE_API_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `PORT`, `CLIENT_URL`
    - Fail fast at startup (throw) if any required variable is missing or empty
    - Export a typed `env` object consumed by services and middleware
    - _Requirements: 5.2, 6.1_

- [ ] 2. Backend middleware: auth and error handling
  - [ ] 2.1 Implement Clerk auth middleware and requireAuth guard
    - Create `src/middleware/auth.middleware.ts`
    - Mount `clerkMiddleware` from `@clerk/express` (reads session JWT from both cookies and `Authorization` header)
    - Export `requireAuth` middleware that checks `req.auth?.userId`; if absent, return `401` with `{ error: "unauthenticated", message: "Authentication required" }` and do not call `next()` to the route handler
    - _Requirements: 5.2_

  - [ ] 2.2 Implement centralized error handler middleware
    - Create `src/middleware/error.middleware.ts`
    - Map `ExtractionError` → `400` `{ error: "invalid_file", message: "PDF is not processable" }`
    - Map `EmbeddingError`, `StorageError`, `LLMError`, `AuthError` (missing/invalid Gemini key) → `500` with fixed generic message `"An unexpected server error occurred"`
    - Map unknown errors → `500` with the same fixed generic message
    - Never include stack traces, file paths, database identifiers, or raw error text in the response body
    - Log full error details server-side only (console.error)
    - _Requirements: 6.1, 6.4_

- [ ] 3. Backend Gemini services: embeddings and LLM
  - [ ] 3.1 Implement embeddings service singleton
    - Create `src/services/embeddings.service.ts`
    - Export a singleton `GoogleGenerativeAIEmbeddings` instance from `@langchain/google-genai`, configured with `GOOGLE_API_KEY` from env
    - _Requirements: 2.3, 6.1_

  - [ ] 3.2 Implement LLM service singleton
    - Create `src/services/llm.service.ts`
    - Export a singleton `ChatGoogleGenerativeAI` instance from `@langchain/google-genai`, configured with `GOOGLE_API_KEY` from env
    - _Requirements: 4.3, 6.1_

- [ ] 4. Backend vector store and PDF processing services
  - [ ] 4.1 Implement vector store service with document registry
    - Create `src/services/vector-store.service.ts`
    - Singleton `MemoryVectorStore` (cosine similarity) initialized with the embeddings service singleton
    - In-memory `DocumentRegistry` (`Map<string, DocumentRecord>`) alongside the store
    - Expose `addDocuments(chunks, metadata)` that stores chunks with metadata `{ documentId, source, page, chunkIndex, userId }`
    - Expose `search(question, { userId, k, threshold })` using `similaritySearchWithScore` with a per-user metadata filter, returning scored documents scoped to the user
    - Expose registry helpers: `registerDocument(record)`, `getDocument(id)`
    - _Requirements: 2.4, 4.1, 5.2_

  - [ ] 4.2 Implement PDF loading and splitting service
    - Create `src/services/pdf.service.ts`
    - `loadAndSplit(filePath, source)`: use `PDFLoader` from `@langchain/community/document_loaders/fs/pdf` to extract page-aware text, then `RecursiveCharacterTextSplitter` from `langchain/text_splitter` to chunk
    - Throw `ExtractionError` when PDFLoader fails or extracted text is empty/whitespace-only
    - Return `Document[]` (LangChain) with page metadata preserved for source references
    - _Requirements: 2.1, 2.2, 2.6, 6.3_

  - [ ]\* 4.3 Write property test for vector store metadata round-trip
    - **Property 4: Vector store metadata round-trip**
    - **Validates: Requirements 2.4**
    - For any set of chunks added with metadata, a subsequent similarity search returns documents whose metadata equals the inserted metadata. Use mock embeddings to avoid external calls. At least 100 randomized iterations.

  - [ ]\* 4.4 Write property test for chunking invariants
    - **Property 3: Chunking invariants**
    - **Validates: Requirements 2.2**
    - For any non-empty extracted text, the splitter produces at least one non-empty chunk whose length does not exceed `chunkSize`, and the union of chunk contents covers the original text. For any empty/whitespace-only input, no usable chunks are produced. At least 100 randomized iterations.

- [ ] 5. Backend retrieval and RAG orchestration
  - [ ] 5.1 Implement retrieval service
    - Create `src/services/retrieval.service.ts`
    - `retrieve(question, userId)`: call `vectorStore.search` scoped to `userId`, filter results to similarity score `>= 0.3`, take at most 5 chunks ordered by descending score
    - Return `null` when no chunks qualify (all below threshold or store is empty)
    - Return `{ chunks: Document[], scores: number[] }` when chunks qualify
    - _Requirements: 4.1, 4.4_

  - [ ] 5.2 Implement RAG orchestration service
    - Create `src/services/rag.service.ts`
    - `processUpload(filePath, userId, source)`: call `pdf.service.loadAndSplit` → generate embeddings for all chunks → if embedding fails, throw `EmbeddingError` and do NOT add any documents to the store (transactional boundary) → on success, add chunks to vector store with metadata, register document, return `{ documentId, source, chunkCount }`
    - `answerQuestion(question, userId)`: call `retrieval.service.retrieve` → if null, return `{ answer: null, message: "No information was found for your question.", sources: [] }` → otherwise build a RAG prompt with retrieved context + question, call Gemini LLM → on LLM failure throw `LLMError` → on success return `{ answer, sources }` with one `SourceReference` per retrieved chunk
    - Generate unique `documentId` (e.g., `doc_{timestamp}_{random}`)
    - _Requirements: 2.1–2.8, 4.1–4.6, 6.1_

  - [ ]\* 5.3 Write property test for retrieval threshold and top-k limit
    - **Property 6: Retrieval threshold and top-k limit**
    - **Validates: Requirements 4.1**
    - For any set of similarity-scored candidate chunks, the retrieval service returns at most 5 chunks, every returned chunk has a score at or above 0.3, and results are ordered by descending score. Use a mock vector store. At least 100 randomized iterations.

  - [ ]\* 5.4 Write property test for no relevant chunks yields a no-information response
    - **Property 7: No relevant chunks yields a no-information response**
    - **Validates: Requirements 4.4**
    - For any candidate set where every chunk has a similarity score below 0.3, the backend returns a response with `answer` set to `null`, a no-information message, and an empty `sources` array. Use mock store and mock LLM. At least 100 randomized iterations.

  - [ ]\* 5.5 Write property test for source references match retrieved chunks
    - **Property 8: Source references match retrieved chunks**
    - **Validates: Requirements 4.5**
    - For any retrieval that passes N chunks to the LLM, the response contains exactly N source references, each matching the `documentId`, `source`, `page`, and `chunkIndex` of one of the passed chunks. Use mock LLM. At least 100 randomized iterations.

  - [ ]\* 5.6 Write property test for per-user retrieval isolation
    - **Property 9: Per-user retrieval isolation**
    - **Validates: Requirements 5.2**
    - For any retrieval performed for a given user, no returned chunk carries metadata belonging to a different user. Chunks uploaded by other users never appear in that user's answer sources. Use mock store with multi-user data. At least 100 randomized iterations.

  - [ ]\* 5.7 Write property test for embedding failure leaves store unchanged
    - **Property 5: Embedding failure leaves the store unchanged**
    - **Validates: Requirements 2.7, 6.1**
    - For any upload attempt in which the embeddings step fails, the vector store contains no new documents afterward and the backend returns an error response rather than a success response. Use mock embeddings that throw. At least 100 randomized iterations.

- [ ] 6. Backend routes and app wiring
  - [ ] 6.1 Implement health, upload, and chat routes
    - Create `src/routes/health.routes.ts`: unauthenticated `GET /health` returning `{ status: "Server is healthy" }`
    - Create `src/routes/upload.routes.ts`: apply `requireAuth` + multer single("pdf") → call `rag.service.processUpload(req.file.path, req.auth.userId, req.file.originalname)` → return `200` with `{ message, documentId, source, chunkCount }` on success; errors propagate to error middleware
    - Create `src/routes/chat.routes.ts`: apply `requireAuth` + `express.json()` → validate body `question` is non-empty and at most 1000 chars (else `400` `{ error: "invalid_question", message: "Question must be non-empty and at most 1000 characters" }`) → call `rag.service.answerQuestion(question, req.auth.userId)` → return `200` with answer or no-info response
    - _Requirements: 2.5, 2.6, 2.7, 2.8, 4.4, 4.5, 4.6, 5.2_

  - [ ] 6.2 Wire routes, middleware, and CORS into Express app
    - Update `src/app.ts`: add `cors({ origin: env.CLIENT_URL, credentials: true })`, mount `clerkMiddleware` from auth middleware, keep `express.json()`, mount health/upload/chat route modules, attach error handler middleware as the last middleware
    - Remove the existing stub `/upload` route and `/health` inline handler; replace with the route modules
    - Ensure multer middleware remains in place for the upload route
    - _Requirements: 5.2, 6.4_

  - [ ]\* 6.3 Write property test for unauthenticated requests rejected
    - **Property 10: Unauthenticated requests rejected**
    - **Validates: Requirements 5.2**
    - For any request to `/upload` or `/chat` that lacks a valid Clerk session token, the backend returns a `401` status code with an authentication error message and does not execute the route's core handler. Use `supertest` with a mock Clerk middleware or no token. At least 100 randomized iterations.

  - [ ]\* 6.4 Write property test for error responses never leak internals
    - **Property 11: Error responses never leak internals**
    - **Validates: Requirements 6.4**
    - For any error that produces a 500-level response, the response body contains only a generic message and does not contain stack traces, file paths, database identifiers, or other internal implementation details. Trigger via mock service that throws errors containing internal-looking strings and verify they are absent from the response. At least 100 randomized iterations.

- [ ] 7. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Frontend foundation: types, validation, API client, and UI setup
  - [ ] 8.1 Create frontend shared types
    - Create `client/lib/types.ts` with `ChatRole` (`"user" | "assistant"`), `ChatMessage` (`id`, `role`, `content`, `sources?`, `timestamp`), and `SourceReference` (`documentId`, `source`, `page`, `chunkIndex`)
    - _Requirements: 3.5, 4.5_

  - [ ] 8.2 Implement validation helpers
    - Create `client/lib/validation.ts`
    - `validatePdfFile(file: File): { valid: boolean; error?: string }` — accept iff `file.type === "application/pdf"` and `file.size <= 10 * 1024 * 1024`; return descriptive error otherwise
    - `validateQuestion(question: string): { valid: boolean; error?: string }` — accept iff `question.trim()` is non-empty and `question.length <= 1000`; return descriptive error otherwise
    - Pure functions with no side effects, testable in isolation
    - _Requirements: 1.2, 1.3, 1.6, 3.1, 3.2_

  - [ ] 8.3 Implement API client
    - Create `client/lib/api.ts`
    - `uploadPdf(file: File, token: string)`: `POST {NEXT_PUBLIC_API_URL}/upload` with `multipart/form-data` (field `pdf`) and `Authorization: Bearer <token>` header; parse JSON response; throw on non-2xx
    - `askQuestion(question: string, token: string)`: `POST {NEXT_PUBLIC_API_URL}/chat` with `Content-Type: application/json`, `Authorization: Bearer <token>`, body `{ question }`; parse JSON response; throw on non-2xx
    - Read `NEXT_PUBLIC_API_URL` from env (fallback to `http://localhost:8000`)
    - _Requirements: 1.1, 1.4, 1.5, 3.3, 5.2_

  - [ ]\* 8.4 Write property test for PDF file validation gate
    - **Property 1: PDF file validation gate**
    - **Validates: Requirements 1.2, 1.3, 1.6**
    - For any file, `validatePdfFile` accepts it iff MIME type is `application/pdf` and byte size is at most 10 MB. Every rejected file prevents the upload request from being sent. At least 100 randomized iterations over arbitrary MIME types and sizes.

  - [ ]\* 8.5 Write property test for question validation gate
    - **Property 2: Question validation gate**
    - **Validates: Requirements 3.1, 3.2**
    - For any string, `validateQuestion` accepts it iff it is non-empty after trimming and its length is at most 1000. Every failing string is rejected with a validation error and is not sent. At least 100 randomized iterations over arbitrary strings.

- [ ] 9. Frontend components
  - [ ] 9.1 Install shadcn UI primitives and frontend test dependencies
    - Add shadcn components via CLI: `button`, `input`, `card`, `scroll-area`, `alert` (and any others the panels need)
    - Install frontend test deps: `vitest`, `fast-check`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@vitejs/plugin-react`
    - Create `vitest.config.ts` with jsdom environment for component tests
    - Per `client/AGENTS.md`: read relevant Next.js 16 docs in `node_modules/next/dist/docs/` before writing any Next.js code in subsequent tasks
    - _Requirements: 1.1–1.6, 3.1–3.6 (UI foundational)_

  - [ ] 9.2 Implement chat message component
    - Create `client/components/chat-message.tsx`
    - Render a single conversation turn (`ChatMessage`) with role-based styling (user vs assistant)
    - Render source references (`SourceReference[]`) for assistant messages that include them — display `source` filename, `page` number, and `chunkIndex`
    - _Requirements: 3.4, 4.5_

  - [ ] 9.3 Implement upload panel
    - Create `client/components/upload-panel.tsx` (`"use client"`)
    - File input with accept `application/pdf` + drag-and-drop dropzone
    - Client-side validation via `validatePdfFile` before any network call: show error for non-PDF or >10 MB, do not upload
    - Obtain Clerk session token via `useAuth().getToken()` and attach as `Authorization: Bearer <token>`
    - Call `uploadPdf(file, token)`; on success display confirmation message; on failure display error describing the reason
    - Show loading state while upload is in flight
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 5.1, 5.3_

  - [ ] 9.4 Implement chat panel
    - Create `client/components/chat-panel.tsx` (`"use client"`)
    - In-memory conversation history via `useState<ChatMessage[]>` (resets on page reload — no persistence)
    - Text input field capped at `maxLength={1000}` with `validateQuestion` on submit; show validation error and do not send if invalid
    - Append user question to history, set loading state, call `askQuestion(question, token)` with Bearer token from `useAuth().getToken()`
    - On success: hide loading, append assistant answer with source references to history, clear input
    - On network error: hide loading, display connection-error message, preserve user's entered question in the input field unchanged
    - Render message list using `ChatMessage` component in a scroll area
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.4, 6.2_

  - [ ] 9.5 Implement app container
    - Create `client/components/pdf-rag-app.tsx` (`"use client"`)
    - Compose `UploadPanel` and `ChatPanel` in a shared layout (e.g., side-by-side or stacked card layout)
    - Own shared state if needed (e.g., last uploaded document info passed to chat panel)
    - _Requirements: 5.1, 5.3_

  - [ ] 9.6 Update page.tsx to mount the app container
    - Update `client/app/page.tsx` to render `<PdfRagApp />` as the main content (Server Component shell mounting the client container)
    - Per `client/AGENTS.md`: verify Next.js 16 conventions in `node_modules/next/dist/docs/` (e.g., `cacheComponents` behavior) before modifying
    - _Requirements: 5.1, 5.3_

  - [ ]\* 9.7 Write property test for user input preserved on network error
    - **Property 12: User input preserved on network error**
    - **Validates: Requirements 6.2**
    - For any chat submission where the request to the backend fails due to a network error, the frontend displays a connection-error message and preserves the user's entered question unchanged in the input field. Use `@testing-library/react` with a mocked `askQuestion` that rejects. At least 100 randomized iterations over arbitrary question strings.

  - [ ]\* 9.8 Write property test for conversation history reflects the session
    - **Property 13: Conversation history reflects the session**
    - **Validates: Requirements 3.5**
    - For any sequence of submitted questions and received answers within a session, the conversation history contains every submitted question and every received answer in submission order. The history is not persisted across page reloads (component remount yields empty history). Use `@testing-library/react` with a mocked API. At least 100 randomized iterations over arbitrary Q&A sequences.

- [ ] 10. Create environment configuration files
  - [ ] 10.1 Create backend and frontend .env templates
    - Create `server/.env` with: `GOOGLE_API_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `PORT=8000`, `CLIENT_URL=http://localhost:3000`
    - Update `client/.env` to add `NEXT_PUBLIC_API_URL=http://localhost:8000` alongside existing Clerk keys
    - Update `server/package.json` dev script to load env (e.g., `tsx watch --env-file=.env src/server.ts` or add `dotenv` import in `server.ts`)
    - _Requirements: 5.2, 6.1_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. Core implementation tasks (no `*`) must be implemented.
- Each task references specific requirements for traceability to the requirements document.
- Checkpoints (tasks 7 and 11) ensure incremental validation — run the test suite and confirm all tests pass before proceeding.
- Property tests validate the 13 universal correctness properties defined in the design document. Each property test is a separate sub-task with its own test file to avoid file-level conflicts in the dependency graph.
- Unit tests and property tests are complementary: property tests cover universal invariants; unit tests cover specific examples and edge cases.
- Backend testing uses `vitest` + `fast-check` for property-based testing with at least 100 randomized iterations, using mock embeddings/LLM/store where external services are involved.
- Frontend testing uses `vitest` + `@testing-library/react` + `fast-check` with a jsdom environment.
- Per `client/AGENTS.md`: this project uses Next.js 16 with breaking changes. Read the relevant guides in `node_modules/next/dist/docs/` before writing any Next.js frontend code (tasks 9.1–9.6).
- The server uses ESM modules (`"type": "module"`, `module: "nodenext"`) with `.js` import extensions and `verbatimModuleSyntax` enabled — use `import type` for type-only imports.
- The in-memory `MemoryVectorStore` is process-scoped and ephemeral by design — it does not persist across restarts and is append-only for the life of the process. Per-user isolation is achieved via metadata filtering, not separate stores.
- The existing `multer.middleware.ts` (PDF-only filter, 10 MB limit) is reused as-is per the design.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "8.1", "9.1", "10.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "8.2", "8.3", "9.2"] },
    {
      "id": 2,
      "tasks": ["2.1", "2.2", "3.1", "3.2", "4.2", "8.4", "8.5", "9.3", "9.4"]
    },
    { "id": 3, "tasks": ["4.1", "4.4", "9.5", "9.7"] },
    { "id": 4, "tasks": ["4.3", "5.1", "9.6", "9.8"] },
    { "id": 5, "tasks": ["5.2", "5.3"] },
    { "id": 6, "tasks": ["5.4", "5.5", "5.6", "5.7", "6.1"] },
    { "id": 7, "tasks": ["6.2"] },
    { "id": 8, "tasks": ["6.3", "6.4"] }
  ]
}
```
