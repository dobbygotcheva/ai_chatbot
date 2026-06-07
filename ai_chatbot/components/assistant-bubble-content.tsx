"use client";

import { WordStream } from "@/components/word-stream";
import { cn, sanitizeText } from "@/lib/utils";

/** Same typography as the chat bubble, for light PDF capture (no `dark:prose-invert`). */
export const assistantBubbleMarkdownClassNameForPdf = cn(
  "max-w-none text-[15px] text-foreground leading-[1.65]",
  "prose prose-sm",
  "prose-headings:font-semibold prose-headings:text-foreground prose-headings:tracking-tight",
  "prose-h1:mt-0 prose-h1:mb-2 prose-h1:text-lg prose-h1:leading-snug",
  "prose-h2:mt-5 prose-h2:mb-2 prose-h2:text-base prose-h2:leading-snug first:prose-h2:mt-0",
  "prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:text-[15px] first:prose-h3:mt-0",
  "prose-p:my-2.5 prose-p:leading-relaxed first:prose-p:mt-0 last:prose-p:mb-0",
  "prose-strong:font-semibold prose-strong:text-foreground",
  "prose-a:font-medium prose-a:text-primary prose-a:underline prose-a:decoration-primary/40 prose-a:underline-offset-2 hover:prose-a:text-primary/90",
  "prose-ul:my-2 prose-ul:ml-0 prose-ul:list-outside prose-ul:pl-5",
  "prose-ol:my-2 prose-ol:ml-0 prose-ol:list-outside prose-ol:pl-6",
  "prose-li:my-1 prose-li:pl-0.5 prose-li:marker:text-foreground/55",
  "[&_ol_ol]:mt-2 [&_ol_ol]:pl-4 [&_ul_ul]:mt-2 [&_ul_ul]:pl-4",
  "prose-blockquote:my-3 prose-blockquote:border-primary/35 prose-blockquote:border-l-[3px] prose-blockquote:pl-3 prose-blockquote:text-foreground/85 prose-blockquote:italic",
  "prose-hr:my-5 prose-hr:border-border/60",
  "prose-pre:my-3 prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:border prose-pre:border-border/50 prose-pre:bg-muted/70 prose-pre:px-3.5 prose-pre:py-3 prose-pre:text-[13px] prose-pre:leading-relaxed",
  "prose-code:rounded-md prose-code:bg-muted/70 prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.9em] prose-code:text-foreground/95 prose-code:before:content-none prose-code:after:content-none",
  "prose-pre:prose-code:bg-transparent prose-pre:prose-code:p-0 prose-pre:prose-code:text-[13px]",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
);

const assistantBubbleMarkdownClassName = cn(
  assistantBubbleMarkdownClassNameForPdf,
  "dark:prose-invert"
);

export function AssistantBubbleContent({
  text,
  className,
  delay,
  isStreaming,
}: {
  text: string;
  className?: string;
  delay?: number;
  isStreaming?: boolean;
}) {
  return (
    <WordStream
      className={cn(assistantBubbleMarkdownClassName, className)}
      delay={delay ?? 0}
      isStreaming={isStreaming}
      text={sanitizeText(text)}
    />
  );
}
