"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useState } from "react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ContextChip } from "./context-chip";
import { MessageContent } from "./elements/message";
import { MessageActions } from "./message-actions";
import { MessagePartBlock } from "./message-part-block";
import { PreviewAttachment } from "./preview-attachment";

const PurePreviewMessage = ({
  addToolApprovalResponse,
  chatId,
  contextPercentage,
  message,
  vote,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding: _requiresScrollPadding,
  textSpeed,
  isStreaming,
}: {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  contextPercentage: number | null;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  textSpeed?: number;
  isStreaming?: boolean;
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  return (
    <div
      className="group/message fade-in w-full animate-in duration-200"
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn("flex w-full items-start", {
          "justify-end": message.role === "user" && mode !== "edit",
          "justify-start": message.role === "assistant",
        })}
      >
        <div
          className={cn("flex min-w-0 flex-col", {
            "gap-3": message.parts?.some((p) => {
              if (p.type === "text" && p.text?.trim()) {
                return true;
              }
              if (p.type === "reasoning") {
                const streaming = "state" in p && p.state === "streaming";
                return Boolean(p.text?.trim() || streaming);
              }
              if (
                p.type === "tool-findWebpages" ||
                p.type === "tool-crawlPages"
              ) {
                return true;
              }
              return false;
            }),
            "w-full":
              mode === "edit" ||
              (message.role === "assistant" &&
                (message.parts?.some(
                  (p) => p.type === "text" && p.text?.trim()
                ) ||
                  message.parts?.some(
                    (p) =>
                      p.type.startsWith("tool-") || p.type === "dynamic-tool"
                  ))),
            "ml-auto w-fit max-w-[min(100%,42rem)]":
              message.role === "user" && mode !== "edit",
          })}
        >
          {attachmentsFromMessage.length > 0 && (
            <div
              className="flex flex-row justify-end gap-2"
              data-testid={"message-attachments"}
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  attachment={{
                    name: attachment.filename ?? "file",
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                  key={attachment.url}
                />
              ))}
            </div>
          )}

          {message.parts?.map((part, index) => {
            const partKey = `message-${message.id}-part-${index}`;
            return (
              <MessagePartBlock
                addToolApprovalResponse={addToolApprovalResponse}
                isLoading={isLoading}
                isReadonly={isReadonly}
                isStreaming={isStreaming}
                key={partKey}
                message={message}
                messageKey={partKey}
                mode={mode}
                part={part}
                partIndex={index}
                regenerate={regenerate}
                setMessages={setMessages}
                setMode={setMode}
                textSpeed={textSpeed}
              />
            );
          })}

          {/* Actions row — same max-width as the bubble, actions left + chip right */}
          {(!isReadonly || message.role === "assistant") && (
            <div className="flex w-full max-w-4xl items-center justify-between">
              {!isReadonly && (
                <MessageActions
                  chatId={chatId}
                  isLoading={isLoading}
                  key={`action-${message.id}`}
                  message={message}
                  setMode={setMode}
                  vote={vote}
                />
              )}
              {message.role === "assistant" && contextPercentage != null && (
                <ContextChip percentage={contextPercentage} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const PreviewMessage = PurePreviewMessage;

export const ThinkingMessage = () => {
  return (
    <div
      className="group/message fade-in w-full animate-in duration-300"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <div className="flex w-full items-start justify-start">
        <div className="flex w-full min-w-0 flex-col">
          <div className="message-bubble w-full min-w-0">
            <MessageContent
              className={cn(
                "wrap-break-word text-[15px] leading-relaxed",
                "w-full max-w-4xl rounded-2xl px-4 py-3.5 text-left text-foreground shadow-sm"
              )}
              data-testid="message-content"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-foreground/90">Thinking</span>
                <span aria-hidden className="inline-flex text-muted-foreground">
                  <span className="animate-bounce [animation-delay:0ms]">
                    .
                  </span>
                  <span className="animate-bounce [animation-delay:150ms]">
                    .
                  </span>
                  <span className="animate-bounce [animation-delay:300ms]">
                    .
                  </span>
                </span>
              </div>
            </MessageContent>
          </div>
        </div>
      </div>
    </div>
  );
};
