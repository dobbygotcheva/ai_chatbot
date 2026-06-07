import { CONTEXT_WINDOW_INPUT, SYSTEM_OVERHEAD_TOKENS } from "@/lib/constants";
import type { ChatMessage } from "@/lib/types";

export type ContextUsageInfo = {
  /**
   * Most up-to-date context window percentage we can extract from message parts.
   * Returns the final value when available, otherwise falls back to the last seen
   * context usage percentage (typically the early estimate).
   */
  contextPercentage: number | null;
  hasAnyContextUsage: boolean;
  /**
   * Whether we can consider the context percentage "final" (early estimate + final
   * value have both arrived, or the final part exposes `outputTokens > 0`).
   */
  hasFinalContextUsage: boolean;
  contextUsagePartsCount: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function getContextUsageInfoFromMessageParts(
  message: ChatMessage
): ContextUsageInfo {
  const parts = message.parts ?? [];

  let lastPct: number | null = null;
  let hasFinalByOutputTokens = false;
  let contextUsagePartsCount = 0;

  for (const part of parts) {
    if (
      part == null ||
      part.type !== "data-contextUsage" ||
      !("data" in part)
    ) {
      continue;
    }

    const data = part.data as unknown;
    if (typeof data !== "object" || data === null) {
      continue;
    }

    const pct = (data as { contextPercentage?: unknown }).contextPercentage;
    if (!isFiniteNumber(pct)) {
      continue;
    }

    contextUsagePartsCount += 1;
    lastPct = pct;

    const outputTokens = (data as { outputTokens?: unknown }).outputTokens;
    if (isFiniteNumber(outputTokens) && outputTokens > 0) {
      hasFinalByOutputTokens = true;
    }
  }

  const hasAnyContextUsage = contextUsagePartsCount > 0;
  const hasFinalByCount = contextUsagePartsCount >= 2;

  return {
    contextPercentage: lastPct,
    hasAnyContextUsage,
    hasFinalContextUsage:
      hasAnyContextUsage && (hasFinalByOutputTokens || hasFinalByCount),
    contextUsagePartsCount,
  };
}

function getInputMessagesForContextEstimation(
  messages: ChatMessage[],
  lastAssistantIdx: number
): ChatMessage[] {
  if (lastAssistantIdx === -1) {
    return messages;
  }

  return messages.filter((_, idx) => idx !== lastAssistantIdx);
}

function estimateInputCharsFromMessages(messages: ChatMessage[]): number {
  let chars = 0;

  for (const m of messages) {
    for (const p of m.parts ?? []) {
      if (p.type === "text") {
        chars += p.text?.length ?? 0;
      }
    }
  }

  return chars;
}

export type ContextUsageEstimate = {
  inputTokens: number;
  contextPercentage: number;
};

export function estimateContextUsageFromMessages(
  messages: ChatMessage[],
  lastAssistantIdx: number
): ContextUsageEstimate {
  const inputMsgs = getInputMessagesForContextEstimation(
    messages,
    lastAssistantIdx
  );

  const chars = estimateInputCharsFromMessages(inputMsgs);

  const inputTokens = Math.max(
    1,
    SYSTEM_OVERHEAD_TOKENS + Math.round(chars / 4)
  );

  return {
    inputTokens,
    contextPercentage: Math.min(
      100,
      Math.round((inputTokens / CONTEXT_WINDOW_INPUT) * 100)
    ),
  };
}

export function estimateContextUsagePercentageFromMessages(
  messages: ChatMessage[],
  lastAssistantIdx: number
): number {
  return estimateContextUsageFromMessages(messages, lastAssistantIdx)
    .contextPercentage;
}
