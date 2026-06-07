/**
 * Generic MCP Client
 *
 * Handles communication with any MCP server using the MCP protocol.
 * Session IDs are managed in-memory and tied to the server process lifetime.
 *
 * This is a generic implementation that works with any MCP server.
 * The MCP server URL and name should be passed from the route handlers.
 */

export interface McpInitializeRequest {
  jsonrpc: "2.0";
  id: number;
  method: "initialize";
  params: {
    protocolVersion: string;
    capabilities: Record<string, unknown>;
    clientInfo: {
      name: string;
      version: string;
    };
  };
}

export interface McpInitializeResponse {
  jsonrpc: "2.0";
  id: number;
  result?: {
    protocolVersion: string;
    capabilities: Record<string, unknown>;
    serverInfo: {
      name: string;
      version: string;
    };
  };
  error?: {
    code: number;
    message: string;
  };
}

export interface McpNotificationRequest {
  jsonrpc: "2.0";
  method: "notifications/initialized";
}

export interface McpSessionConfig {
  baseUrl: string;
  accessToken: string;
  userId: string;
}

export interface McpSession {
  sessionId: string;
  userId: string;
  createdAt: Date;
  lastUsedAt: Date;
}

/**
 * In-memory session store for MCP sessions.
 * Sessions are NOT persisted to survive server restarts for security reasons.
 * Users must re-authenticate after server restart.
 *
 * Key is sessionId, value is the session with userId for proper isolation.
 */
const sessionStore = new Map<string, McpSession>();

/**
 * User-to-session index for quick lookup by userId.
 */
const userSessionIndex = new Map<string, string>();

/**
 * Initialize a connection with an MCP server.
 *
 * @param config - The session configuration including base URL and access token
 * @returns The session ID if initialization succeeds
 * @throws Error if initialization fails
 */
export async function initializeMcpSession(
  config: McpSessionConfig
): Promise<string> {
  const initializeRequest: McpInitializeRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "ai-chatbot",
        version: "2.1.0",
      },
    },
  };

  // Determine auth type based on token format
  // Atlassian MCP accepts: Bearer (OAuth), Token (PAT), or Basic (email:api_token)
  const authHeader = config.accessToken?.includes(":")
    ? `Basic ${Buffer.from(config.accessToken).toString("base64")}`
    : `Token ${config.accessToken}`;

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: authHeader,
    },
    body: JSON.stringify(initializeRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `MCP initialization failed: ${response.status} ${errorText}`
    );
  }

  // Handle SSE stream response
  const sessionId = await extractSessionIdFromSse(response);

  if (!sessionId) {
    throw new Error("No Mcp-Session-Id header in response");
  }

  // Store session in memory
  const session: McpSession = {
    sessionId,
    userId: config.userId,
    createdAt: new Date(),
    lastUsedAt: new Date(),
  };
  sessionStore.set(sessionId, session);

  // Index by userId for quick lookup
  userSessionIndex.set(config.userId, sessionId);

  return sessionId;
}

/**
 * Extract the Mcp-Session-Id from an SSE stream response.
 *
 * The MCP server typically sends the session ID in the initial response.
 * We need to read the stream and extract the session ID.
 */
async function extractSessionIdFromSse(
  response: Response
): Promise<string | null> {
  // First, check if the header is directly available
  const sessionIdHeader = response.headers.get("Mcp-Session-Id");
  if (sessionIdHeader) {
    return sessionIdHeader;
  }

  // If not in header, try to read from stream
  try {
    const reader = response.body?.getReader();
    if (!reader) {
      return null;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    // Read initial chunk to find session ID
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Look for session ID in the SSE data
      const sessionIdMatch = buffer.match(/Mcp-Session-Id:\s*([^\s\n]+)/i);
      if (sessionIdMatch) {
        reader.cancel();
        return sessionIdMatch[1];
      }

      // Also check for JSON-RPC response that might contain session info
      if (buffer.includes('"result"')) {
        // Session might be established, break and return null
        // The actual session ID should be in headers for subsequent requests
        break;
      }
    }

    reader.cancel();
    return null;
  } catch {
    return null;
  }
}

/**
 * Send the initialized notification to the MCP server.
 *
 * This notifies the server that the client has completed initialization
 * and is ready to use the session.
 *
 * @param config - The session configuration
 * @param sessionId - The session ID from initialization
 */
export async function sendInitializedNotification(
  config: McpSessionConfig,
  sessionId: string
): Promise<void> {
  const notificationRequest: McpNotificationRequest = {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  };

  // Determine auth type based on token format
  const authHeader = config.accessToken?.includes(":")
    ? `Basic ${Buffer.from(config.accessToken).toString("base64")}`
    : `Token ${config.accessToken}`;

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Session-Id": sessionId,
      Authorization: authHeader,
    },
    body: JSON.stringify(notificationRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();

    // Check if response is HTML (likely an error page)
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("text/html")) {
      console.error("[MCP] Server returned HTML instead of JSON/SSE:", {
        status: response.status,
        contentType,
        bodyPreview: errorText.slice(0, 500),
      });
      throw new Error(
        `MCP server returned HTML (status ${response.status}). Check if the MCP server URL (${config.baseUrl}) is correct and the server is running.`
      );
    }

    throw new Error(
      `MCP initialized notification failed: ${response.status} ${errorText}`
    );
  }

  // Update last used time
  const session = sessionStore.get(sessionId);
  if (session) {
    session.lastUsedAt = new Date();
    sessionStore.set(sessionId, session);
  }
}

/**
 * Get a session from the store.
 *
 * @param sessionId - The session ID to retrieve
 * @returns The session if found, null otherwise
 */
export function getSession(sessionId: string): McpSession | null {
  return sessionStore.get(sessionId) ?? null;
}

/**
 * Remove a session from the store.
 *
 * @param sessionId - The session ID to remove
 */
export function removeSession(sessionId: string): void {
  const session = sessionStore.get(sessionId);
  if (session) {
    userSessionIndex.delete(session.userId);
  }
  sessionStore.delete(sessionId);
}

/**
 * Remove a session by userId from the store.
 *
 * @param userId - The user ID to remove
 */
export function removeSessionByUserId(userId: string): void {
  const sessionId = userSessionIndex.get(userId);
  if (sessionId) {
    sessionStore.delete(sessionId);
    userSessionIndex.delete(userId);
  }
}

/**
 * Get a session by userId.
 *
 * @param userId - The user ID to lookup
 * @returns The session if found, null otherwise
 */
export function getSessionByUserId(userId: string): McpSession | null {
  const sessionId = userSessionIndex.get(userId);
  if (sessionId) {
    return sessionStore.get(sessionId) ?? null;
  }
  return null;
}

/**
 * Validate that a session exists and is valid.
 *
 * @param sessionId - The session ID to validate
 * @returns True if the session is valid, false otherwise
 */
export function isValidSession(sessionId: string): boolean {
  const session = sessionStore.get(sessionId);
  if (!session) {
    return false;
  }

  // Optional: Add expiration logic here if needed
  // For now, sessions are valid until server restart or explicit removal
  return true;
}

/**
 * Make an authenticated request to the MCP server.
 * This function handles session recovery - if the session is not in memory
 * but we have the credentials, it will re-initialize the session.
 *
 * @param config - The session configuration
 * @param sessionId - The session ID
 * @param request - The JSON-RPC request body
 * @returns The response from the MCP server
 */
export async function makeMcpRequest(
  config: McpSessionConfig,
  sessionId: string,
  request: Record<string, unknown>
): Promise<Response> {
  // Check if session is in memory, if not, try to recover it
  let session = sessionStore.get(sessionId);
  let activeSessionId = sessionId;

  if (!session) {
    // Session not in memory (server restart), re-initialize
    console.log(`[MCP] Session ${sessionId} not in memory, re-initializing...`);

    try {
      const newSessionId = await initializeMcpSession(config);
      await sendInitializedNotification(config, newSessionId);

      session = sessionStore.get(newSessionId);

      if (!session) {
        throw new Error("Failed to recover MCP session");
      }

      activeSessionId = newSessionId;
      console.log(`[MCP] Session recovered: ${newSessionId}`);
    } catch (error) {
      console.error("[MCP] Failed to recover session:", error);
      throw new Error(
        "Failed to recover MCP session. Please reconnect in Settings > Apps."
      );
    }
  }

  // Determine auth type based on token format
  const authHeader = config.accessToken?.includes(":")
    ? `Basic ${Buffer.from(config.accessToken).toString("base64")}`
    : `Token ${config.accessToken}`;

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "Mcp-Session-Id": activeSessionId,
      Authorization: authHeader,
    },
    body: JSON.stringify(request),
  });

  // Update last used time on successful request
  const updatedSession = sessionStore.get(activeSessionId);
  if (updatedSession && response.ok) {
    updatedSession.lastUsedAt = new Date();
    sessionStore.set(activeSessionId, updatedSession);
  }

  return response;
}
