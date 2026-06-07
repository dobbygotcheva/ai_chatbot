"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { assistantBubbleMarkdownClassNameForPdf } from "@/components/assistant-bubble-content";
import { cn, sanitizeText } from "@/lib/utils";

export type PdfExportItem = {
  body: string;
  role: "assistant" | "user";
  roleLabel: string;
};

/** Fallback when html2canvas/jsPDF fails (e.g. tainted canvas): plain text only. */
export function PdfExportPlainText({
  documentTitle,
  htmlLang,
  items,
}: {
  documentTitle: string;
  htmlLang: string;
  items: PdfExportItem[];
}) {
  return (
    <div
      className="pdf-export-root box-border w-[800px] max-w-[min(800px,100vw)] bg-white p-7 font-sans text-[14px] text-foreground leading-[1.55]"
      lang={htmlLang}
    >
      <h1 className="m-0 mb-5 font-semibold text-[18px] text-foreground">
        {documentTitle}
      </h1>
      {items.map((item, index) => (
        <section className="mb-5" key={`pdf-plain-${String(index)}`}>
          <h2 className="m-0 mb-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
            {item.roleLabel}
          </h2>
          <div
            className="rounded-2xl px-4 py-3 text-[15px] text-foreground shadow-sm"
            style={{
              backgroundColor:
                item.role === "user"
                  ? "var(--user-message-bg)"
                  : "var(--assistant-message-bg)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {item.body}
          </div>
        </section>
      ))}
    </div>
  );
}

export function PdfExportRoot({
  documentTitle,
  htmlLang,
  items,
}: {
  documentTitle: string;
  htmlLang: string;
  items: PdfExportItem[];
}) {
  return (
    <div
      className="pdf-export-root box-border w-[800px] max-w-[min(800px,100vw)] bg-white p-7 font-sans text-[14px] text-foreground leading-[1.55]"
      lang={htmlLang}
    >
      <h1 className="m-0 mb-5 font-semibold text-[18px] text-foreground">
        {documentTitle}
      </h1>
      {items.map((item, index) => (
        <section className="mb-5" key={`pdf-msg-${String(index)}`}>
          <h2 className="m-0 mb-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
            {item.roleLabel}
          </h2>
          <div
            className={cn(
              "flex",
              item.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "wrap-break-word rounded-2xl px-4 text-[15px] text-foreground shadow-sm",
                item.role === "user"
                  ? "max-w-[min(100%,42rem)] py-3 text-right leading-relaxed"
                  : "w-full max-w-[min(100%,42rem)] py-3.5 text-left"
              )}
              style={{
                backgroundColor:
                  item.role === "user"
                    ? "var(--user-message-bg)"
                    : "var(--assistant-message-bg)",
              }}
            >
              {item.role === "assistant" ? (
                <div
                  className={cn(
                    assistantBubbleMarkdownClassNameForPdf,
                    "size-full"
                  )}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {sanitizeText(item.body)}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="wrap-break-word text-[15px] leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {sanitizeText(item.body)}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
