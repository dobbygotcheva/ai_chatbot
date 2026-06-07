import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/types";
import {
  assistantMessageHasVisibleActivity,
  cn,
  generateUUID,
  getTextFromMessage,
  sanitizeText,
  shouldHideAssistantStreamingPlaceholder,
} from "@/lib/utils";

describe("utils", () => {
  describe("sanitizeText", () => {
    it("removes has_function_call tags", () => {
      expect(sanitizeText("Hello<has_function_call>")).toBe("Hello");
      expect(sanitizeText("<has_function_call>test")).toBe("test");
      expect(sanitizeText("a<has_function_call>b")).toBe("ab");
    });

    it("returns unchanged text without tags", () => {
      expect(sanitizeText("Hello world")).toBe("Hello world");
      expect(sanitizeText("")).toBe("");
    });
  });

  describe("generateUUID", () => {
    it("generates a valid UUID format", () => {
      const uuid = generateUUID();
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidRegex);
    });

    it("generates unique UUIDs", () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe("cn", () => {
    it("merges class names correctly", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
      expect(cn("foo bar", "baz")).toBe("foo bar baz");
    });

    it("handles conditional classes", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
      expect(cn("foo")).toBe("foo");
    });

    it("preserves duplicate classes (clsx behavior)", () => {
      expect(cn("foo", "foo")).toBe("foo foo");
    });

    it("handles tailwind conflicts", () => {
      expect(cn("text-left", "text-right")).toBe("text-right");
    });
  });

  describe("getTextFromMessage", () => {
    it("extracts text from message parts", () => {
      const message: ChatMessage = {
        id: "1",
        role: "assistant",
        parts: [
          { type: "text", text: "Hello" },
          { type: "text", text: " World" },
        ],
      };
      expect(getTextFromMessage(message)).toBe("Hello World");
    });

    it("filters out non-text parts", () => {
      const message: ChatMessage = {
        id: "1",
        role: "assistant",
        parts: [
          { type: "text", text: "Hello" },
          {
            type: "tool-getWeather",
            toolCallId: "w1",
            state: "input-available",
            input: { city: "Sofia" },
          },
          { type: "text", text: " World" },
        ],
      };
      expect(getTextFromMessage(message)).toBe("Hello World");
    });

    it("returns empty string for message without text parts", () => {
      const message: ChatMessage = {
        id: "1",
        role: "assistant",
        parts: [],
      };
      expect(getTextFromMessage(message)).toBe("");
    });
  });

  describe("assistantMessageHasVisibleActivity", () => {
    it("is false for empty assistant parts", () => {
      const message: ChatMessage = {
        id: "1",
        role: "assistant",
        parts: [],
      };
      expect(assistantMessageHasVisibleActivity(message)).toBe(false);
    });

    it("is true when reasoning is streaming", () => {
      const message: ChatMessage = {
        id: "1",
        role: "assistant",
        parts: [{ type: "reasoning", text: "", state: "streaming" }],
      };
      expect(assistantMessageHasVisibleActivity(message)).toBe(true);
    });

    it("is true for dynamic-tool", () => {
      const message: ChatMessage = {
        id: "1",
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolName: "jira_search",
            toolCallId: "d1",
            state: "input-available",
            input: {},
          },
        ],
      };
      expect(assistantMessageHasVisibleActivity(message)).toBe(true);
    });
  });

  describe("shouldHideAssistantStreamingPlaceholder", () => {
    it("is true for streaming last assistant message with no visible parts yet", () => {
      const message: ChatMessage = {
        id: "1",
        role: "assistant",
        parts: [{ type: "text", text: "" }],
      };
      expect(
        shouldHideAssistantStreamingPlaceholder(message, "streaming", true)
      ).toBe(true);
    });

    it("is false once assistant text is non-empty", () => {
      const message: ChatMessage = {
        id: "1",
        role: "assistant",
        parts: [{ type: "text", text: "Hi" }],
      };
      expect(
        shouldHideAssistantStreamingPlaceholder(message, "streaming", true)
      ).toBe(false);
    });

    it("is false when not the last message", () => {
      const message: ChatMessage = {
        id: "1",
        role: "assistant",
        parts: [{ type: "text", text: "" }],
      };
      expect(
        shouldHideAssistantStreamingPlaceholder(message, "streaming", false)
      ).toBe(false);
    });
  });
});
