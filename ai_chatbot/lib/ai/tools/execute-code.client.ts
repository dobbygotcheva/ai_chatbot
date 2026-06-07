import { ChatSDKError } from "@/lib/errors";
import { config } from "@/shared/config";

export interface ExecuteCodeInput {
  code: string;
  language: "python" | "javascript" | "bash";
  timeout?: number;
}

export interface ExecuteCodeResult {
  execution_id: string;
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
  files?: Array<{ name: string; content: string; size: number }>;
  images?: Array<{ name: string; content_type: string; content: string }>;
}

const MAX_RETRIES = 2;

function shouldRetry(error: Error): boolean {
  if (error.name === "AbortError") {
    return false;
  }

  if (
    error instanceof ChatSDKError &&
    (error.type === "bad_request" ||
      error.type === "unauthorized" ||
      error.type === "forbidden" ||
      error.message.includes("timeout"))
  ) {
    return false;
  }

  return true;
}

export async function executeCodeService(
  input: ExecuteCodeInput
): Promise<ExecuteCodeResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await executeWithTimeout(input);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      if (attempt < MAX_RETRIES) {
        const delay = 100 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw new ChatSDKError(
        "offline:chat",
        `Failed to call execution service after ${MAX_RETRIES} retries: ${lastError.message}`
      );
    }
  }

  throw lastError || new ChatSDKError("offline:chat", "Unknown error");
}

function handleHttpError(status: number, error: { error?: string }): never {
  const message = error.error || "Code execution failed";

  switch (status) {
    case 400:
      throw new ChatSDKError("bad_request:api", message);
    case 401:
    case 403:
      throw new ChatSDKError("unauthorized:api", message);
    case 429:
      throw new ChatSDKError("rate_limit:chat", message);
    case 500:
    case 502:
    case 503:
    case 504:
      throw new ChatSDKError("offline:chat", message);
    default:
      throw new ChatSDKError("bad_request:api", message);
  }
}

function handleRequestError(error: unknown): never {
  if (error instanceof ChatSDKError) {
    throw error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    throw new ChatSDKError("bad_request:chat", "Request timeout");
  }

  throw new ChatSDKError(
    "offline:chat",
    `Failed to call execution service: ${error instanceof Error ? error.message : "Unknown error"}`
  );
}

async function executeWithTimeout(
  input: ExecuteCodeInput
): Promise<ExecuteCodeResult> {
  const controller = new AbortController();
  const timeout = input.timeout || config.codeExecution.timeout;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(
      `${config.codeExecution.serviceUrl}/api/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: input.code,
          language: input.language,
          timeout: input.timeout,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: "Unknown error",
      }));
      handleHttpError(response.status, error);
    }

    return (await response.json()) as ExecuteCodeResult;
  } catch (error) {
    clearTimeout(timeoutId);
    handleRequestError(error);
  }
}
