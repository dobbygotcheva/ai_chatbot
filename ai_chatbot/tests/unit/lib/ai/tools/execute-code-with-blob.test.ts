import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/metrics", () => ({
  trackToolUsage: vi.fn(),
}));

vi.mock("@/lib/ai/tools/execute-code.client", () => ({
  executeCodeService: vi.fn(),
}));

vi.mock("@/lib/db/artifacts", () => ({
  createArtifact: vi.fn(),
}));

import { executeCode } from "@/lib/ai/tools/execute-code";
import { executeCodeService } from "@/lib/ai/tools/execute-code.client";
import { createArtifact } from "@/lib/db/artifacts";
import { trackToolUsage } from "@/lib/metrics";

describe("executeCode tool", () => {
  const mockSession = { user: { id: "test-user-123" } };
  const mockChatId = "chat-456";
  const mockMessageId = "msg-789";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should save images as artifacts and return artifact IDs", async () => {
    const mockExecutionResult = {
      execution_id: "exec_test_123",
      success: true,
      stdout: "Plot generated\n",
      stderr: "",
      exit_code: 0,
      duration_ms: 450,
      images: [
        {
          name: "plot.png",
          content_type: "image/png",
          content:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        },
        {
          name: "chart.jpg",
          content_type: "image/jpeg",
          content: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD",
        },
      ],
      files: [],
    };

    vi.mocked(executeCodeService).mockResolvedValue(mockExecutionResult);

    vi.mocked(createArtifact)
      .mockResolvedValueOnce({
        id: "artifact-uuid-1",
        userId: mockSession.user.id,
        chatId: mockChatId,
        messageId: mockMessageId,
        filename: "plot.png",
        contentType: "image/png",
        size: 1024,
        data: "base64data",
        kind: "image",
        metadata: {},
        createdAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: "artifact-uuid-2",
        userId: mockSession.user.id,
        chatId: mockChatId,
        messageId: mockMessageId,
        filename: "chart.jpg",
        contentType: "image/jpeg",
        size: 2048,
        data: "base64data",
        kind: "image",
        metadata: {},
        createdAt: new Date(),
      });

    const tool = executeCode({
      session: mockSession as any,
      chatId: mockChatId,
      messageId: mockMessageId,
    });

    const result = await (tool.execute as any)(
      {
        code: "import matplotlib.pyplot as plt\nplt.plot([1,2,3])\nplt.savefig('plot.png')",
        language: "python",
      },
      { messages: [] }
    );

    expect(result.success).toBe(true);
    expect(result.images).toHaveLength(2);
    expect(result.images?.[0].artifactId).toBe("artifact-uuid-1");
    expect(result.images?.[1].artifactId).toBe("artifact-uuid-2");
    expect(result.images?.[0].name).toBe("plot.png");
    expect(result.images?.[0].content_type).toBe("image/png");
    expect(createArtifact).toHaveBeenCalledTimes(2);
  });

  it("should throw when artifact creation fails", async () => {
    const mockExecutionResult = {
      execution_id: "exec_test_456",
      success: true,
      stdout: "Plot generated\n",
      stderr: "",
      exit_code: 0,
      duration_ms: 300,
      images: [
        {
          name: "failed-plot.png",
          content_type: "image/png",
          content:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ",
        },
      ],
      files: [],
    };

    vi.mocked(executeCodeService).mockResolvedValue(mockExecutionResult);
    vi.mocked(createArtifact).mockRejectedValueOnce(
      new Error("Database connection failed")
    );

    const tool = executeCode({
      session: mockSession as any,
      chatId: mockChatId,
      messageId: mockMessageId,
    });

    await expect(
      (tool.execute as any)(
        {
          code: "plt.plot([1,2,3])",
          language: "python",
        },
        { messages: [] }
      )
    ).rejects.toThrow("Failed to save generated image as artifact");
  });

  it("should throw when any artifact creation fails", async () => {
    const mockExecutionResult = {
      execution_id: "exec_test_789",
      success: true,
      stdout: "Multiple plots generated\n",
      stderr: "",
      exit_code: 0,
      duration_ms: 600,
      images: [
        {
          name: "plot1.png",
          content_type: "image/png",
          content: "data:image/png;base64,success1",
        },
        {
          name: "plot2.png",
          content_type: "image/png",
          content: "data:image/png;base64,success2",
        },
        {
          name: "plot3.png",
          content_type: "image/png",
          content: "data:image/png;base64,success3",
        },
      ],
      files: [],
    };

    vi.mocked(executeCodeService).mockResolvedValue(mockExecutionResult);

    vi.mocked(createArtifact)
      .mockResolvedValueOnce({
        id: "artifact-uuid-1",
        userId: mockSession.user.id,
        chatId: mockChatId,
        messageId: mockMessageId,
        filename: "plot1.png",
        contentType: "image/png",
        size: 1024,
        data: "success1",
        kind: "image",
        metadata: {},
        createdAt: new Date(),
      })
      .mockRejectedValueOnce(new Error("Upload failed"))
      .mockResolvedValueOnce({
        id: "artifact-uuid-3",
        userId: mockSession.user.id,
        chatId: mockChatId,
        messageId: mockMessageId,
        filename: "plot3.png",
        contentType: "image/png",
        size: 1024,
        data: "success3",
        kind: "image",
        metadata: {},
        createdAt: new Date(),
      });

    const tool = executeCode({
      session: mockSession as any,
      chatId: mockChatId,
      messageId: mockMessageId,
    });

    await expect(
      (tool.execute as any)(
        {
          code: "plt.plot([1,2,3])",
          language: "python",
        },
        { messages: [] }
      )
    ).rejects.toThrow("Failed to save generated image as artifact");
  });

  it("should track tool usage metrics", async () => {
    const mockExecutionResult = {
      execution_id: "exec_test_metrics",
      success: true,
      stdout: "Success\n",
      stderr: "",
      exit_code: 0,
      duration_ms: 200,
      images: [],
      files: [],
    };

    vi.mocked(executeCodeService).mockResolvedValue(mockExecutionResult);

    const tool = executeCode({
      session: mockSession as any,
      chatId: mockChatId,
      messageId: mockMessageId,
    });

    await (tool.execute as any)(
      {
        code: "print('hello')",
        language: "python",
      },
      { messages: [] }
    );

    expect(trackToolUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockSession.user.id,
        toolName: "executeCode",
        toolType: "base",
        chatId: mockChatId,
        messageId: mockMessageId,
        success: true,
      })
    );
  });

  it("should handle execution errors and track failures", async () => {
    vi.mocked(executeCodeService).mockRejectedValueOnce(
      new Error("Execution timeout")
    );

    const tool = executeCode({
      session: mockSession as any,
      chatId: mockChatId,
      messageId: mockMessageId,
    });

    await expect(
      (tool.execute as any)(
        {
          code: "while True: pass",
          language: "python",
        },
        { messages: [] }
      )
    ).rejects.toThrow("Execution timeout");

    expect(trackToolUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockSession.user.id,
        toolName: "executeCode",
        toolType: "base",
        success: false,
        errorMessage: "Execution timeout",
      })
    );
  });

  it("should handle files in addition to images", async () => {
    const mockExecutionResult = {
      execution_id: "exec_test_files",
      success: true,
      stdout: "Files generated\n",
      stderr: "",
      exit_code: 0,
      duration_ms: 350,
      images: [
        {
          name: "plot.png",
          content_type: "image/png",
          content: "data:image/png;base64,imagedata",
        },
      ],
      files: [
        {
          name: "data.csv",
          content: "Y29sdW1uMSxjb2x1bW4yCjEsMg==",
          size: 100,
        },
      ],
    };

    vi.mocked(executeCodeService).mockResolvedValue(mockExecutionResult);

    vi.mocked(createArtifact).mockResolvedValueOnce({
      id: "artifact-uuid-img",
      userId: mockSession.user.id,
      chatId: mockChatId,
      messageId: mockMessageId,
      filename: "plot.png",
      contentType: "image/png",
      size: 1024,
      data: "imagedata",
      kind: "image",
      metadata: {},
      createdAt: new Date(),
    });

    const tool = executeCode({
      session: mockSession as any,
      chatId: mockChatId,
      messageId: mockMessageId,
    });

    const result = await (tool.execute as any)(
      {
        code: "generate_files()",
        language: "python",
      },
      { messages: [] }
    );

    expect(result.success).toBe(true);
    expect(result.images).toHaveLength(1);
    expect(result.files).toHaveLength(1);
    expect(result.files?.[0].name).toBe("data.csv");
  });
});
