"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { askQuestion } from "@/lib/api";
import { validateQuestion, MAX_QUESTION_LENGTH } from "@/lib/validation";
import type { ChatMessage, UploadSuccessResponse } from "@/lib/types";
import { ChatMessageItem } from "@/components/chat-message";

interface ChatPanelProps {
  uploadedDocument: UploadSuccessResponse | null;
}

export function ChatPanel({ uploadedDocument }: ChatPanelProps) {
  const { getToken } = useAuth();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = input.trim();
    const result = validateQuestion(trimmed);
    if (!result.valid) {
      setError(result.error ?? "Invalid question.");
      return;
    }

    // Obtain Clerk session token
    const token = await getToken();

    // Append user message and clear input
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await askQuestion(trimmed, token ?? "");
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } 
    catch {
      // Preserve the user's entered question on error
      setInput(trimmed);
      setError("A connection error occurred. Please try again.");
    } 
    finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="size-5" />
          Ask Questions
        </CardTitle>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        {/* Messages */}
        <div
          ref={scrollRef}
          className="chat-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto pr-1"
        >
          {messages.length === 0 && !isLoading ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <p className="text-sm">
                {uploadedDocument
                  ? `Ask a question about "${uploadedDocument.source}"`
                  : "Upload a PDF, then ask questions about its content."}
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessageItem key={msg.id} message={msg} />
            ))
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Thinking…
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your PDF…"
            maxLength={MAX_QUESTION_LENGTH}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || input.trim().length === 0}
          >
            <Send />
          </Button>
        </form>

        {/* Character count */}
        <div
          className={cn(
            "text-right text-xs text-muted-foreground",
            input.length > MAX_QUESTION_LENGTH * 0.9 && "text-destructive",
          )}
        >
          {input.length} / {MAX_QUESTION_LENGTH}
        </div>
      </CardContent>
    </Card>
  );
}
