"use client";

import * as React from "react";
import { UploadPanel } from "@/components/upload-panel";
import { ChatPanel } from "@/components/chat-panel";
import type { UploadSuccessResponse } from "@/lib/types";

export function PdfRagApp() {
  const [uploadedDocument, setUploadedDocument] =
    React.useState<UploadSuccessResponse | null>(null);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
      <div className="grid h-[calc(100vh-8rem)] gap-4 md:grid-cols-[400px_1fr]">
        <UploadPanel onUploadSuccess={setUploadedDocument} />
        <ChatPanel uploadedDocument={uploadedDocument} />
      </div>
    </main>
  );
}
