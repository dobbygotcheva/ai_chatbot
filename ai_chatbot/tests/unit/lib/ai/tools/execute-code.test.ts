import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeCodeService } from "@/lib/ai/tools/execute-code.client";
import { ChatSDKError } from "@/lib/errors";

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

vi.mock("@/shared/config", () => ({
  config: {
    codeExecution: {
      serviceUrl: "http://localhost:8080",
      timeout: 30_000,
      memoryLimit: "512m",
      cpuLimit: 1.0,
      allowedLanguages: ["python", "javascript", "bash"],
    },
  },
}));

describe("executeCodeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should execute Python code successfully", async () => {
    const mockResponse = {
      execution_id: "exec_123",
      success: true,
      stdout: "Hello\n",
      stderr: "",
      exit_code: 0,
      duration_ms: 234,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await executeCodeService({
      code: "print('Hello')",
      language: "python",
    });

    expect(result.success).toBe(true);
    expect(result.stdout).toBe("Hello\n");
    expect(result.execution_id).toBe("exec_123");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/execute",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })
    );
  });

  it("should execute JavaScript code successfully", async () => {
    const mockResponse = {
      execution_id: "exec_456",
      success: true,
      stdout: "42\n",
      stderr: "",
      exit_code: 0,
      duration_ms: 150,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await executeCodeService({
      code: "console.log(42)",
      language: "javascript",
    });

    expect(result.success).toBe(true);
    expect(result.stdout).toBe("42\n");
  });

  it("should execute Bash code successfully", async () => {
    const mockResponse = {
      execution_id: "exec_789",
      success: true,
      stdout: "file1.txt\nfile2.txt\n",
      stderr: "",
      exit_code: 0,
      duration_ms: 89,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await executeCodeService({
      code: "ls -1",
      language: "bash",
    });

    expect(result.success).toBe(true);
    expect(result.stdout).toBe("file1.txt\nfile2.txt\n");
    expect(result.exit_code).toBe(0);
  });

  it("should handle timeout errors with AbortController", async () => {
    mockFetch.mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          const error = new Error("AbortError");
          error.name = "AbortError";
          reject(error);
        }, 100);
      });
    });

    await expect(
      executeCodeService({
        code: "import time; time.sleep(30)",
        language: "python",
        timeout: 50,
      })
    ).rejects.toThrow(ChatSDKError);
  });

  it("should handle network errors (service unreachable)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(
      executeCodeService({
        code: "print('test')",
        language: "python",
      })
    ).rejects.toThrow(ChatSDKError);
  });

  it("should handle HTTP 400 validation errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "Invalid syntax in code" }),
    });

    try {
      await executeCodeService({
        code: "print(invalid",
        language: "python",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ChatSDKError);
      expect((error as ChatSDKError).type).toBe("bad_request");
      expect((error as ChatSDKError).surface).toBe("api");
      expect((error as ChatSDKError).cause).toBe("Invalid syntax in code");
    }

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should handle HTTP 500 server errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal server error" }),
    });

    try {
      await executeCodeService({
        code: "print('test')",
        language: "python",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ChatSDKError);
      expect((error as ChatSDKError).type).toBe("offline");
      expect((error as ChatSDKError).surface).toBe("chat");
      expect((error as ChatSDKError).cause).toContain(
        "Failed to call execution service after 2 retries"
      );
    }

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("should retry on 5xx errors (max 2 retries)", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Server error" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ error: "Service unavailable" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            execution_id: "exec_retry",
            success: true,
            stdout: "Success after retry\n",
            stderr: "",
            exit_code: 0,
            duration_ms: 300,
          }),
      });

    const result = await executeCodeService({
      code: "print('test')",
      language: "python",
    });

    expect(result.success).toBe(true);
    expect(result.stdout).toBe("Success after retry\n");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("should throw after max retries if all attempts fail", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Server error 1" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Server error 2" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Server error 3" }),
      });

    await expect(
      executeCodeService({
        code: "print('test')",
        language: "python",
      })
    ).rejects.toThrow(ChatSDKError);
  });

  it("should NOT retry on 4xx errors (client errors)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "Bad request" }),
    });

    try {
      await executeCodeService({
        code: "invalid",
        language: "python",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ChatSDKError);
      expect((error as ChatSDKError).type).toBe("bad_request");
      expect((error as ChatSDKError).surface).toBe("api");
    }

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should format error messages in user-friendly way", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "Access denied" }),
    });

    try {
      await executeCodeService({
        code: "print('test')",
        language: "python",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ChatSDKError);
      expect((error as ChatSDKError).type).toBe("unauthorized");
      expect((error as ChatSDKError).surface).toBe("api");
      expect((error as ChatSDKError).cause).toBe("Access denied");
    }
  });

  it("should handle response with stderr output", async () => {
    const mockResponse = {
      execution_id: "exec_stderr",
      success: true,
      stdout: "",
      stderr: "Warning: deprecated function\n",
      exit_code: 0,
      duration_ms: 120,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await executeCodeService({
      code: "deprecated_func()",
      language: "python",
    });

    expect(result.success).toBe(true);
    expect(result.stderr).toBe("Warning: deprecated function\n");
    expect(result.stdout).toBe("");
  });

  it("should handle response with files and images", async () => {
    const mockResponse = {
      execution_id: "exec_files",
      success: true,
      stdout: "Generated output\n",
      stderr: "",
      exit_code: 0,
      duration_ms: 500,
      files: [
        { name: "output.csv", content: "a,b,c\n1,2,3", size: 12 },
        { name: "data.json", content: '{"key":"value"}', size: 15 },
      ],
      images: [
        {
          name: "plot.png",
          content_type: "image/png",
          content: "base64encodeddata",
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await executeCodeService({
      code: "generate_plot()",
      language: "python",
    });

    expect(result.success).toBe(true);
    expect(result.files).toHaveLength(2);
    expect(result.files?.[0].name).toBe("output.csv");
    expect(result.images).toHaveLength(1);
    expect(result.images?.[0].name).toBe("plot.png");
    expect(result.images?.[0].content_type).toBe("image/png");
  });

  it("should handle HTTP 429 rate limit errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: "Rate limit exceeded" }),
    });

    try {
      await executeCodeService({
        code: "print('test')",
        language: "python",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ChatSDKError);
      expect((error as ChatSDKError).type).toBe("offline");
      expect((error as ChatSDKError).surface).toBe("chat");
      expect((error as ChatSDKError).cause).toContain(
        "Failed to call execution service after 2 retries"
      );
    }

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("should handle unknown error responses", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 418,
      json: () => Promise.resolve({ error: "Unknown error" }),
    });

    try {
      await executeCodeService({
        code: "print('test')",
        language: "python",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ChatSDKError);
      expect((error as ChatSDKError).type).toBe("bad_request");
      expect((error as ChatSDKError).surface).toBe("api");
    }
  });

  it("should handle malformed JSON response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("Invalid JSON")),
    });

    try {
      await executeCodeService({
        code: "print('test')",
        language: "python",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ChatSDKError);
      expect((error as ChatSDKError).type).toBe("offline");
    }
  });

  it("should handle HTTP 401 unauthorized errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Invalid API key" }),
    });

    try {
      await executeCodeService({
        code: "print('test')",
        language: "python",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ChatSDKError);
      expect((error as ChatSDKError).type).toBe("unauthorized");
      expect((error as ChatSDKError).surface).toBe("api");
      expect((error as ChatSDKError).cause).toBe("Invalid API key");
    }

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should handle HTTP 403 forbidden errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: "Access forbidden" }),
    });

    try {
      await executeCodeService({
        code: "print('test')",
        language: "python",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ChatSDKError);
      expect((error as ChatSDKError).type).toBe("unauthorized");
      expect((error as ChatSDKError).surface).toBe("api");
      expect((error as ChatSDKError).cause).toBe("Access forbidden");
    }

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should handle HTTP 502 bad gateway errors with retry", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ error: "Bad gateway" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            execution_id: "exec_502",
            success: true,
            stdout: "Success after 502\n",
            stderr: "",
            exit_code: 0,
            duration_ms: 200,
          }),
      });

    const result = await executeCodeService({
      code: "print('test')",
      language: "python",
    });

    expect(result.success).toBe(true);
    expect(result.stdout).toBe("Success after 502\n");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should handle HTTP 504 gateway timeout errors with retry", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 504,
        json: () => Promise.resolve({ error: "Gateway timeout" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 504,
        json: () => Promise.resolve({ error: "Gateway timeout" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            execution_id: "exec_504",
            success: true,
            stdout: "Success after 504\n",
            stderr: "",
            exit_code: 0,
            duration_ms: 250,
          }),
      });

    const result = await executeCodeService({
      code: "print('test')",
      language: "python",
    });

    expect(result.success).toBe(true);
    expect(result.stdout).toBe("Success after 504\n");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("should handle network errors (offline)", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    try {
      await executeCodeService({
        code: "print('test')",
        language: "python",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ChatSDKError);
      expect((error as ChatSDKError).type).toBe("offline");
      expect((error as ChatSDKError).surface).toBe("chat");
      expect((error as ChatSDKError).cause).toContain(
        "Failed to call execution service after 2 retries"
      );
    }

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("should handle custom timeout configuration", async () => {
    const customTimeout = 100;
    mockFetch.mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          const error = new Error("AbortError");
          error.name = "AbortError";
          reject(error);
        }, customTimeout + 50);
      });
    });

    await expect(
      executeCodeService({
        code: "import time; time.sleep(10)",
        language: "python",
        timeout: customTimeout,
      })
    ).rejects.toThrow(ChatSDKError);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/execute",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("should use default timeout from config when not provided", async () => {
    const mockResponse = {
      execution_id: "exec_default_timeout",
      success: true,
      stdout: "Hello\n",
      stderr: "",
      exit_code: 0,
      duration_ms: 100,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await executeCodeService({
      code: "print('Hello')",
      language: "python",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/execute",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("should include execution_id in successful response", async () => {
    const mockResponse = {
      execution_id: "exec_unique_12345",
      success: true,
      stdout: "Output\n",
      stderr: "",
      exit_code: 0,
      duration_ms: 150,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await executeCodeService({
      code: "print('Output')",
      language: "python",
    });

    expect(result.execution_id).toBe("exec_unique_12345");
    expect(result.duration_ms).toBe(150);
  });

  it("should handle non-Error thrown values", async () => {
    mockFetch.mockRejectedValueOnce("string error");

    try {
      await executeCodeService({
        code: "print('test')",
        language: "python",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ChatSDKError);
      expect((error as ChatSDKError).type).toBe("offline");
      expect((error as ChatSDKError).cause).toContain(
        "Failed to call execution service after 2 retries"
      );
    }

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("should NOT retry on AbortError (timeout)", async () => {
    mockFetch.mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        const error = new Error("AbortError");
        error.name = "AbortError";
        reject(error);
      });
    });

    try {
      await executeCodeService({
        code: "print('test')",
        language: "python",
        timeout: 50,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ChatSDKError);
      expect((error as ChatSDKError).type).toBe("bad_request");
      expect((error as ChatSDKError).surface).toBe("chat");
      expect((error as ChatSDKError).cause).toBe("Request timeout");
    }

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should include all request body fields", async () => {
    const mockResponse = {
      execution_id: "exec_body_check",
      success: true,
      stdout: "OK\n",
      stderr: "",
      exit_code: 0,
      duration_ms: 50,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    await executeCodeService({
      code: "print('OK')",
      language: "python",
      timeout: 5000,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/execute",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: "print('OK')",
          language: "python",
          timeout: 5000,
        }),
      })
    );
  });
});
