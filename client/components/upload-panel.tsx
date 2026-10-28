"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { uploadPdf } from "@/lib/api";
import { validatePdfFile } from "@/lib/validation";
import type { UploadSuccessResponse } from "@/lib/types";

interface UploadPanelProps {
  onUploadSuccess?: (response: UploadSuccessResponse) => void;
}

export function UploadPanel({ onUploadSuccess }: UploadPanelProps) {
  const { getToken } = useAuth();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const handleFile = React.useCallback(async (file: File) => {
      // Validate before any action
      const result = validatePdfFile(file);
      if (!result.valid) {
        setError(result.error ?? "Invalid file.");
        setSuccess(null);
        return;
      }

      // Obtain Clerk session token
      const token = await getToken();

      setIsUploading(true);
      setError(null);
      setSuccess(null);

      try {
        const response = await uploadPdf(file, token ?? "");
        setSuccess(`${response.message} - ${response.source}`);
        onUploadSuccess?.(response);
      } 
      catch {
        setError("An error occurred while uploading the file. Please try again.");
      } 
      finally {
        setIsUploading(false);
      }
    },
    [getToken, onUploadSuccess],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const openFilePicker = () => inputRef.current?.click();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="size-5" />
          Upload PDF
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openFilePicker();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50",
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="size-10 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Processing PDF…</p>
            </>
          ) : (
            <>
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <FileText className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF files only · max 10 MB
                </p>
              </div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            onChange={handleInputChange}
            className="hidden"
            disabled={isUploading}
          />
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mt-4 border-green-500/50 bg-green-500/10">
            <CheckCircle2 className="text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              {success}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
