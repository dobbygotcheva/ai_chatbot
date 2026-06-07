import equal from "fast-deep-equal";
import { FileDown } from "lucide-react";
import { memo } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useCopyToClipboard } from "usehooks-ts";
import type { Vote } from "@/lib/db/schema";
import { generatePrintHtml } from "@/lib/generate-print-html";
import { t } from "@/lib/i18n";
import type { ChatMessage } from "@/lib/types";
import { Action, Actions } from "./elements/actions";
import { CopyIcon, PencilEditIcon, ThumbDownIcon, ThumbUpIcon } from "./icons";
import { useLanguage } from "./language-selector";

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
  setMode,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMode?: (mode: "view" | "edit") => void;
}) {
  const { lang } = useLanguage();
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();

  const textFromParts = message.parts
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

  const handleCopy = async () => {
    if (!textFromParts) {
      toast.error("There's no text to copy!");
      return;
    }

    await copyToClipboard(textFromParts);
    toast.success("Copied to clipboard!");
  };

  const handleSavePdf = () => {
    if (!textFromParts) {
      toast.error(t(lang, "chat.pdf_empty"));
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.title = "Print preview";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";

    let cleanupTimeout: NodeJS.Timeout;

    const cleanup = () => {
      if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
      }
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    iframe.addEventListener("load", () => {
      iframe.contentWindow?.addEventListener("afterprint", cleanup);
    });

    iframe.addEventListener("error", cleanup);

    cleanupTimeout = setTimeout(cleanup, 60_000); // Fallback cleanup

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      toast.error("Print failed");
      cleanup();
      return;
    }

    try {
      const messageHtml = generatePrintHtml({ content: textFromParts });
      doc.write(messageHtml);
      doc.close();
    } catch {
      toast.error("Print failed");
      cleanup();
    }
  };

  const pdfAction = (
    <Action
      data-testid="message-print"
      label={t(lang, "chat.print")}
      onClick={handleSavePdf}
      tooltip={t(lang, "chat.print")}
    >
      <FileDown aria-hidden className="size-4" />
    </Action>
  );

  // User messages get edit (on hover), copy, and PDF
  if (message.role === "user") {
    return (
      <Actions
        className={`message-actions -mr-0.5 justify-end ${isLoading ? "pointer-events-none invisible" : "visible"}`}
      >
        <div className="relative">
          {setMode && (
            <Action
              className="absolute top-0 -left-10 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/message:opacity-100"
              data-testid="message-edit-button"
              onClick={() => setMode("edit")}
              tooltip="Edit"
            >
              <PencilEditIcon />
            </Action>
          )}
          <Action label="Copy" onClick={handleCopy} tooltip="Copy">
            <CopyIcon />
          </Action>
          {pdfAction}
        </div>
      </Actions>
    );
  }

  return (
    <Actions
      className={`message-actions -ml-0.5 ${isLoading ? "pointer-events-none invisible" : "visible"}`}
    >
      <Action
        data-testid="message-copy-assistant"
        label="Copy"
        onClick={handleCopy}
        tooltip="Copy"
      >
        <CopyIcon />
      </Action>

      {pdfAction}

      <Action
        data-testid="message-upvote"
        disabled={vote?.isUpvoted}
        onClick={() => {
          const upvote = fetch("/api/vote", {
            method: "PATCH",
            body: JSON.stringify({
              chatId,
              messageId: message.id,
              type: "up",
            }),
          });

          toast.promise(upvote, {
            loading: "Upvoting Response...",
            success: () => {
              mutate<Vote[]>(
                `/api/vote?chatId=${chatId}`,
                (currentVotes) => {
                  if (!currentVotes) {
                    return [];
                  }

                  const votesWithoutCurrent = currentVotes.filter(
                    (currentVote) => currentVote.messageId !== message.id
                  );

                  return [
                    ...votesWithoutCurrent,
                    {
                      chatId,
                      messageId: message.id,
                      isUpvoted: true,
                    },
                  ];
                },
                { revalidate: false }
              );

              return "Upvoted Response!";
            },
            error: "Failed to upvote response.",
          });
        }}
        tooltip="Upvote Response"
      >
        <ThumbUpIcon />
      </Action>

      <Action
        data-testid="message-downvote"
        disabled={vote && !vote.isUpvoted}
        onClick={() => {
          const downvote = fetch("/api/vote", {
            method: "PATCH",
            body: JSON.stringify({
              chatId,
              messageId: message.id,
              type: "down",
            }),
          });

          toast.promise(downvote, {
            loading: "Downvoting Response...",
            success: () => {
              mutate<Vote[]>(
                `/api/vote?chatId=${chatId}`,
                (currentVotes) => {
                  if (!currentVotes) {
                    return [];
                  }

                  const votesWithoutCurrent = currentVotes.filter(
                    (currentVote) => currentVote.messageId !== message.id
                  );

                  return [
                    ...votesWithoutCurrent,
                    {
                      chatId,
                      messageId: message.id,
                      isUpvoted: false,
                    },
                  ];
                },
                { revalidate: false }
              );

              return "Downvoted Response!";
            },
            error: "Failed to downvote response.",
          });
        }}
        tooltip="Downvote Response"
      >
        <ThumbDownIcon />
      </Action>
    </Actions>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (!equal(prevProps.message, nextProps.message)) {
      return false;
    }

    return true;
  }
);
