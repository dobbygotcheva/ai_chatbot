import { describe, expect, it } from "vitest";
import { CONTEXT_WINDOW_INPUT, SYSTEM_OVERHEAD_TOKENS } from "@/lib/constants";
import {
  estimateContextUsageFromMessages,
  getContextUsageInfoFromMessageParts,
} from "@/lib/context-usage";
import type { ChatMessage } from "@/lib/types";

describe("context-usage", () => {
  it("picks the final contextPercentage when the final part has outputTokens > 0", () => {
    const message: ChatMessage = {
      id: "m1",
      role: "assistant",
      parts: [
        {
          type: "data-contextUsage",
          data: {
            inputTokens: 10,
            outputTokens: 0,
            totalTokens: 10,
            contextPercentage: 12,
          },
        },
        {
          type: "data-contextUsage",
          data: {
            inputTokens: 15,
            outputTokens: 50,
            totalTokens: 65,
            contextPercentage: 33,
          },
        },
      ],
    };

    const info = getContextUsageInfoFromMessageParts(message);

    expect(info.hasAnyContextUsage).toBe(true);
    expect(info.hasFinalContextUsage).toBe(true);
    expect(info.contextUsagePartsCount).toBe(2);
    expect(info.contextPercentage).toBe(33);
  });

  it("does not mark final when only the early context usage part exists", () => {
    const message: ChatMessage = {
      id: "m1",
      role: "assistant",
      parts: [
        {
          type: "data-contextUsage",
          data: {
            inputTokens: 10,
            outputTokens: 0,
            totalTokens: 10,
            contextPercentage: 25,
          },
        },
      ],
    };

    const info = getContextUsageInfoFromMessageParts(message);

    expect(info.hasAnyContextUsage).toBe(true);
    expect(info.hasFinalContextUsage).toBe(false);
    expect(info.contextUsagePartsCount).toBe(1);
    expect(info.contextPercentage).toBe(25);
  });

  it("marks final by part count when outputTokens does not exceed 0", () => {
    const message: ChatMessage = {
      id: "m1",
      role: "assistant",
      parts: [
        {
          type: "data-contextUsage",
          data: {
            inputTokens: 10,
            outputTokens: 0,
            totalTokens: 10,
            contextPercentage: 10,
          },
        },
        {
          type: "data-contextUsage",
          data: {
            inputTokens: 15,
            outputTokens: 0,
            totalTokens: 15,
            contextPercentage: 20,
          },
        },
      ],
    };

    const info = getContextUsageInfoFromMessageParts(message);

    expect(info.hasAnyContextUsage).toBe(true);
    expect(info.hasFinalContextUsage).toBe(true);
    expect(info.contextUsagePartsCount).toBe(2);
    expect(info.contextPercentage).toBe(20);
  });

  it("estimates inputTokens and contextPercentage from text parts", () => {
    const messages: ChatMessage[] = [
      {
        id: "m1",
        role: "user",
        parts: [{ type: "text", text: "a".repeat(400) }],
      },
    ];

    const { inputTokens, contextPercentage } = estimateContextUsageFromMessages(
      messages,
      -1
    );

    const expectedInputTokens = SYSTEM_OVERHEAD_TOKENS + Math.round(400 / 4);
    const expectedContextPercentage = Math.min(
      100,
      Math.round((expectedInputTokens / CONTEXT_WINDOW_INPUT) * 100)
    );

    expect(inputTokens).toBe(expectedInputTokens);
    expect(contextPercentage).toBe(expectedContextPercentage);
  });

  it("excludes the last assistant index from estimation when provided", () => {
    const messages: ChatMessage[] = [
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "a".repeat(400) }],
      },
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "b".repeat(100) }],
      },
    ];

    const { inputTokens, contextPercentage } = estimateContextUsageFromMessages(
      messages,
      0
    );

    const expectedInputTokens = SYSTEM_OVERHEAD_TOKENS + Math.round(100 / 4);
    const expectedContextPercentage = Math.min(
      100,
      Math.round((expectedInputTokens / CONTEXT_WINDOW_INPUT) * 100)
    );

    expect(inputTokens).toBe(expectedInputTokens);
    expect(contextPercentage).toBe(expectedContextPercentage);
  });
});
