import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface AgentMessageContentProps {
  content: string;
}

export function AgentMessageContent({ content }: AgentMessageContentProps) {
  return (
    <div className="min-w-0 break-words text-sm leading-6 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="my-3 text-lg font-semibold leading-snug">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="my-3 text-base font-semibold leading-snug">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="my-2 font-semibold leading-snug">{children}</h3>
          ),
          p: ({ children }) => <p className="my-2">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          a: ({ children, href }) => (
            <a href={href} className="text-primary underline underline-offset-2">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 pl-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-md border bg-background p-3 text-xs leading-5">
              {children}
            </pre>
          ),
          code: ({ children, className }) => (
            <code
              className={cn(
                "font-mono",
                className
                  ? "text-xs"
                  : "rounded bg-background/70 px-1 py-0.5 text-[0.85em]",
                className,
              )}
            >
              {children}
            </code>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border px-2 py-1 font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border px-2 py-1">{children}</td>,
          hr: () => <hr className="my-3 border-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
