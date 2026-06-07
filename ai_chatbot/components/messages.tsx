import type { UseChatHelpers } from "@ai-sdk/react";
import { ArrowDownIcon } from "lucide-react";
import { useMessages } from "@/hooks/use-messages";
import {
  estimateContextUsagePercentageFromMessages,
  getContextUsageInfoFromMessageParts,
} from "@/lib/context-usage";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import {
  assistantMessageHasVisibleActivity,
  shouldHideAssistantStreamingPlaceholder,
} from "@/lib/utils";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";

type MessagesProps = {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  /** Stable context-window percentage (0-100) for the last assistant message. */
  contextPercentage: number | null;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  selectedModelId: string;
  textSpeed: number;
};

function PureMessages({
  addToolApprovalResponse,
  chatId,
  contextPercentage,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  selectedModelId: _selectedModelId,
  textSpeed,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    hasSentMessage,
  } = useMessages({
    status,
  });

  const lastAssistant = messages.findLast((m) => m.role === "assistant");
  const lastAssistantId = lastAssistant?.id ?? null;
  const lastAssistantIdx = messages.findLastIndex(
    (m) => m.role === "assistant"
  );

  const isMessageStreaming = (message: ChatMessage): boolean => {
    return status === "streaming" && message.id === lastAssistantId;
  };

  const lastAssistantContextUsageInfo = lastAssistant
    ? getContextUsageInfoFromMessageParts(lastAssistant)
    : {
        contextPercentage: null,
        hasAnyContextUsage: false,
        hasFinalContextUsage: false,
        contextUsagePartsCount: 0,
      };

  const shouldShowContextChip =
    lastAssistantContextUsageInfo.hasFinalContextUsage ||
    status !== "streaming";

  function resolveContextPercentage(message: ChatMessage): number {
    return (
      getContextUsageInfoFromMessageParts(message).contextPercentage ??
      contextPercentage ??
      estimateContextUsagePercentageFromMessages(messages, lastAssistantIdx)
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        className="absolute inset-0 touch-pan-y overflow-y-auto overflow-x-hidden"
        ref={messagesContainerRef}
      >
        <div className="mx-auto flex min-w-0 max-w-4xl flex-col gap-4 px-4 py-4 md:gap-6">
          {messages.length === 0 && <Greeting />}

          {messages.map((message) => {
            const isLastMessage = messages.at(-1)?.id === message.id;
            const isLastAssistant =
              message.role === "assistant" && message.id === lastAssistantId;

            if (
              shouldHideAssistantStreamingPlaceholder(
                message,
                status,
                isLastMessage
              )
            ) {
              return null;
            }
            return (
              <PreviewMessage
                addToolApprovalResponse={addToolApprovalResponse}
                chatId={chatId}
                contextPercentage={
                  isLastAssistant && shouldShowContextChip
                    ? resolveContextPercentage(message)
                    : null
                }
                isLoading={
                  status === "streaming" &&
                  (isLastAssistant
                    ? !lastAssistantContextUsageInfo.hasFinalContextUsage
                    : isLastMessage)
                }
                isReadonly={isReadonly}
                isStreaming={isMessageStreaming(message)}
                key={message.id}
                message={message}
                regenerate={regenerate}
                requiresScrollPadding={hasSentMessage && isLastMessage}
                setMessages={setMessages}
                textSpeed={textSpeed}
                vote={
                  votes
                    ? votes.find((vote) => vote.messageId === message.id)
                    : undefined
                }
              />
            );
          })}

          {(status === "submitted" ||
            (status === "streaming" &&
              (() => {
                const last = messages.at(-1);
                return (
                  last?.role !== "assistant" ||
                  !assistantMessageHasVisibleActivity(last)
                );
              })())) &&
            !messages.some((msg) =>
              msg.parts?.some(
                (part) =>
                  part != null &&
                  "state" in part &&
                  part.state === "approval-responded"
              )
            ) && <ThinkingMessage />}

          <div className="h-px" ref={messagesEndRef} />
        </div>
      </div>

      <button
        aria-label="Scroll to bottom"
        className={`absolute bottom-4 left-1/2 z-10 -translate-x-1/2 cursor-pointer rounded-full border bg-background p-2 shadow-lg transition-all hover:bg-muted ${
          isAtBottom
            ? "pointer-events-none scale-0 opacity-0"
            : "pointer-events-auto scale-100 opacity-100"
        }`}
        onClick={() => scrollToBottom("smooth")}
        type="button"
      >
        <ArrowDownIcon className="size-4" />
      </button>
    </div>
  );
}

export const Messages = PureMessages;
