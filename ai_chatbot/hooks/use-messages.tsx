import type { UseChatHelpers } from "@ai-sdk/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { useScrollToBottom } from "./use-scroll-to-bottom";

export function useMessages({
  status,
}: {
  status: UseChatHelpers<ChatMessage>["status"];
}) {
  const {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    scrollToLatestReply,
    onViewportEnter,
    onViewportLeave,
  } = useScrollToBottom();

  const prevStatusRef = useRef(status);

  const [hasSentMessage, setHasSentMessage] = useState(false);

  useEffect(() => {
    if (status === "submitted") {
      setHasSentMessage(true);
    }
  }, [status]);

  useLayoutEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === "submitted" && prev !== "submitted") {
      scrollToLatestReply();
    }
    if (status === "streaming" && prev !== "streaming") {
      scrollToLatestReply();
    }
  }, [status, scrollToLatestReply]);

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
  };
}
