"use client";

import * as React from "react";
import { UploadPanel } from "@/components/upload-panel";
import { ChatPanel } from "@/components/chat-panel";
import type { UploadSuccessResponse } from "@/lib/types";

export function PdfRagApp() {
  const [uploadedDocument, setUploadedDocument] =
    React.useState<UploadSuccessResponse | null>(null);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 p-3 sm:p-4 md:p-6">
      <div className="grid min-h-[calc(100dvh-7rem)] w-full grid-cols-1 grid-rows-[auto_minmax(28rem,1fr)] gap-4 md:h-[calc(100dvh-7rem)] md:min-h-[30rem] md:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] md:grid-rows-1">
        <UploadPanel onUploadSuccess={setUploadedDocument} />
        <ChatPanel uploadedDocument={uploadedDocument} />
      </div>
    </main>
  );
}
