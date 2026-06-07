import { describe, expect, it } from "vitest";
import { filterBase64FromToolResults } from "@/lib/ai/filter-base64-from-llm";
import type { ChatMessage } from "@/lib/types";

describe("filterBase64FromToolResults", () => {
  it("should filter base64 images from executeCode tool results", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [
          {
            type: "tool-executeCode",
            state: "output-available",
            toolCallId: "call-1",
            input: {
              code: "print('hello')",
              language: "python",
            },
            output: {
              success: true,
              stdout: "hello",
              stderr: "",
              exit_code: 0,
              execution_id: "exec-1",
              duration_ms: 100,
              files: [],
              images: [
                {
                  name: "plot.png",
                  content_type: "image/png",
                  content:
                    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                },
              ],
            },
          } as any,
          {
            type: "text",
            text: "Here's the result",
          },
        ],
        metadata: {
          createdAt: new Date().toISOString(),
        },
      },
    ];

    const filtered = filterBase64FromToolResults(messages);

    expect(filtered[0].parts[0]).toMatchObject({
      type: "tool-executeCode",
      state: "output-available",
    });

    const output = (filtered[0].parts[0] as any).output;
    expect(output.images).toHaveLength(1);
    expect(output.images[0].content).toBe("");
  });

  it("should preserve URL images from executeCode tool results", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [
          {
            type: "tool-executeCode",
            state: "output-available",
            toolCallId: "call-1",
            input: {
              code: "print('hello')",
              language: "python",
            },
            output: {
              success: true,
              stdout: "hello",
              stderr: "",
              exit_code: 0,
              execution_id: "exec-1",
              duration_ms: 100,
              files: [],
              images: [
                {
                  name: "plot.png",
                  content_type: "image/png",
                  content: "https://example.com/blob/plot.png",
                },
              ],
            },
          } as any,
        ],
        metadata: {
          createdAt: new Date().toISOString(),
        },
      },
    ];

    const filtered = filterBase64FromToolResults(messages);

    const output = (filtered[0].parts[0] as any).output;
    expect(output.images[0].content).toBe("https://example.com/blob/plot.png");
  });

  it("should handle messages without tool results", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-1",
        role: "user",
        parts: [
          {
            type: "text",
            text: "Hello",
          },
        ],
        metadata: {
          createdAt: new Date().toISOString(),
        },
      },
    ];

    const filtered = filterBase64FromToolResults(messages);

    expect(filtered).toEqual(messages);
  });

  it("should handle executeCode tool results without images", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [
          {
            type: "tool-executeCode",
            state: "output-available",
            toolCallId: "call-1",
            input: {
              code: "print('hello')",
              language: "python",
            },
            output: {
              success: true,
              stdout: "hello",
              stderr: "",
              exit_code: 0,
              execution_id: "exec-1",
              duration_ms: 100,
              files: [{ name: "output.txt", content: "hello", size: 5 }],
            },
          } as any,
        ],
        metadata: {
          createdAt: new Date().toISOString(),
        },
      },
    ];

    const filtered = filterBase64FromToolResults(messages);

    const output = (filtered[0].parts[0] as any).output;
    expect(output.images).toBeUndefined();
    expect(output.files).toHaveLength(1);
  });

  it("should handle incomplete tool calls", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [
          {
            type: "tool-executeCode",
            state: "invoked",
            toolCallId: "call-1",
            input: {
              code: "print('hello')",
              language: "python",
            },
          } as any,
        ],
        metadata: {
          createdAt: new Date().toISOString(),
        },
      },
    ];

    const filtered = filterBase64FromToolResults(messages);

    expect(filtered).toEqual(messages);
  });

  it("should filter raw base64 images from executeCode tool results", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [
          {
            type: "tool-executeCode",
            state: "output-available",
            toolCallId: "call-1",
            input: {
              code: "print('hello')",
              language: "python",
            },
            output: {
              success: true,
              stdout: "hello",
              stderr: "",
              exit_code: 0,
              execution_id: "exec-1",
              duration_ms: 100,
              files: [],
              images: [
                {
                  name: "plot.png",
                  content_type: "image/png",
                  content:
                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                },
              ],
            },
          } as any,
        ],
        metadata: {
          createdAt: new Date().toISOString(),
        },
      },
    ];

    const filtered = filterBase64FromToolResults(messages);

    const output = (filtered[0].parts[0] as any).output;
    expect(output.images).toHaveLength(1);
    expect(output.images[0].content).toBe("");
  });

  it("should handle mixed base64 and URL images", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [
          {
            type: "tool-executeCode",
            state: "output-available",
            toolCallId: "call-1",
            input: {
              code: "print('hello')",
              language: "python",
            },
            output: {
              success: true,
              stdout: "hello",
              stderr: "",
              exit_code: 0,
              execution_id: "exec-1",
              duration_ms: 100,
              files: [],
              images: [
                {
                  name: "plot1.png",
                  content_type: "image/png",
                  content: "data:image/png;base64,ABC123",
                },
                {
                  name: "plot2.png",
                  content_type: "image/png",
                  content: "https://example.com/blob/plot2.png",
                },
              ],
            },
          } as any,
        ],
        metadata: {
          createdAt: new Date().toISOString(),
        },
      },
    ];

    const filtered = filterBase64FromToolResults(messages);

    const output = (filtered[0].parts[0] as any).output;
    expect(output.images).toHaveLength(2);
    expect(output.images[0].content).toBe("");
    expect(output.images[1].content).toBe("https://example.com/blob/plot2.png");
  });
});
