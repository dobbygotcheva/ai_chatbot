"use client";

import { Check, Loader2, Plug, PlugZap, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AtlassianSetupProps {
  strings?: {
    title: string;
    description: string;
    jiraTokenLabel: string;
    jiraTokenHelp: string;
    jiraTokenPlaceholder: string;
    confluenceTokenLabel: string;
    confluenceTokenHelp: string;
    confluenceTokenPlaceholder: string;
    connectButton: string;
    reconnectButton: string;
    disconnectButton: string;
    connectedStatus: string;
    notConnectedStatus: string;
    tokensSavedStatus: string;
    connectingStatus: string;
    successMessage: string;
    reconnectMessage: string;
    errorMessage: string;
    disconnectSuccessMessage: string;
    disconnectErrorMessage: string;
  };
}

const DEFAULT_STRINGS = {
  title: "Atlassian",
  description:
    "Connect to your Atlassian instance via MCP to access Confluence and Jira. Provide separate API tokens for each service.",
  jiraTokenLabel: "Jira API Token",
  jiraTokenHelp:
    "Your Jira personal access token. Create one in your Atlassian account settings.",
  jiraTokenPlaceholder: "Enter your Jira API token",
  confluenceTokenLabel: "Confluence API Token",
  confluenceTokenHelp:
    "Your Confluence personal access token. Create one in your Atlassian account settings.",
  confluenceTokenPlaceholder: "Enter your Confluence API token",
  connectButton: "Connect",
  reconnectButton: "Reconnect",
  disconnectButton: "Disconnect",
  connectedStatus: "Connected",
  notConnectedStatus: "Not connected",
  tokensSavedStatus: "Tokens saved - click Reconnect to activate",
  connectingStatus: "Connecting...",
  successMessage: "Connected to Atlassian successfully",
  reconnectMessage: "Reconnected to Atlassian successfully",
  errorMessage: "Failed to connect to Atlassian",
  disconnectSuccessMessage: "Disconnected from Atlassian",
  disconnectErrorMessage: "Failed to disconnect from Atlassian",
};

export function AtlassianSetup({ strings }: AtlassianSetupProps) {
  const t = { ...DEFAULT_STRINGS, ...strings };

  const [jiraToken, setJiraToken] = useState("");
  const [confluenceToken, setConfluenceToken] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasSavedTokens, setHasSavedTokens] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const checkConnection = async () => {
    try {
      const [sessionRes, tokensRes] = await Promise.all([
        fetch("/api/mcp/atlassian/session"),
        fetch("/api/mcp/atlassian/tokens"),
      ]);

      // Check if responses are OK before parsing JSON
      if (!sessionRes.ok || !tokensRes.ok) {
        console.error("[AtlassianSetup] API error:", {
          sessionStatus: sessionRes.status,
          tokensStatus: tokensRes.status,
        });
        setIsConnected(false);
        setHasSavedTokens(false);
        setSessionId(null);
        return;
      }

      // Check content type to ensure we're getting JSON
      const sessionContentType = sessionRes.headers.get("content-type");
      const tokensContentType = tokensRes.headers.get("content-type");

      if (
        !sessionContentType?.includes("application/json") ||
        !tokensContentType?.includes("application/json")
      ) {
        console.error("[AtlassianSetup] Unexpected content type:", {
          sessionContentType,
          tokensContentType,
        });
        setIsConnected(false);
        setHasSavedTokens(false);
        setSessionId(null);
        return;
      }

      const sessionData = await sessionRes.json();
      const tokensData = await tokensRes.json();

      setIsConnected(sessionData.isConnected);
      setHasSavedTokens(tokensData.hasSavedTokens);

      if (sessionData.isConnected) {
        setSessionId(sessionData.sessionId ?? null);
      }
    } catch (error) {
      console.error("[AtlassianSetup] checkConnection error:", error);
      setIsConnected(false);
      setHasSavedTokens(false);
      setSessionId(null);
    }
  };

  // Check connection on mount only
  // biome-ignore lint/correctness/useExhaustiveDependencies: checkConnection is memoized and stable. Intentionally omitting from deps to ensure this effect runs only once on mount, not on every function reference change.
  useEffect(() => {
    checkConnection();
  }, []);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Handles OAuth flow, token exchange, validation, error handling, and connection state management
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();

    // If we have saved tokens, reconnect without requiring new tokens
    if (hasSavedTokens) {
      setIsConnecting(true);

      try {
        const response = await fetch("/api/mcp/atlassian", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        // Check content type before parsing
        const contentType = response.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
          const text = await response.text();
          console.error("[AtlassianSetup] Non-JSON response:", {
            status: response.status,
            contentType,
            body: text.slice(0, 500),
          });
          throw new Error(
            `Server returned ${response.status} with content-type: ${contentType}. Expected JSON.`
          );
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || t.errorMessage);
        }

        setIsConnected(true);
        setHasSavedTokens(false);
        setSessionId(data.sessionId ?? null);
        toast.success(t.reconnectMessage);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : t.errorMessage;
        console.error(
          "[AtlassianSetup] handleConnect (reconnect) error:",
          error
        );
        toast.error(errorMessage);
      } finally {
        setIsConnecting(false);
      }
      return;
    }

    // Otherwise, require new tokens
    if (!jiraToken.trim() && !confluenceToken.trim()) {
      toast.error("Please enter at least one API token (Jira or Confluence)");
      return;
    }

    setIsConnecting(true);

    try {
      const response = await fetch("/api/mcp/atlassian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jiraToken: jiraToken.trim() || undefined,
          confluenceToken: confluenceToken.trim() || undefined,
        }),
      });

      // Check content type before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        const text = await response.text();
        console.error("[AtlassianSetup] Non-JSON response:", {
          status: response.status,
          contentType,
          body: text.slice(0, 500),
        });
        throw new Error(
          `Server returned ${response.status} with content-type: ${contentType}. Expected JSON. Check if ATLASSIAN_MCP URL is correct.`
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t.errorMessage);
      }

      setIsConnected(true);
      setHasSavedTokens(false);
      setSessionId(data.sessionId ?? null);
      setJiraToken("");
      setConfluenceToken("");
      toast.success(t.successMessage);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t.errorMessage;
      console.error("[AtlassianSetup] handleConnect error:", error);
      toast.error(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);

    try {
      const response = await fetch("/api/mcp/atlassian/session", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t.disconnectErrorMessage);
      }

      setIsConnected(false);
      setSessionId(null);
      toast.success(t.disconnectSuccessMessage);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t.disconnectErrorMessage;
      toast.error(errorMessage);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        {isConnected ? (
          <Check className="h-5 w-5 text-green-500" />
        ) : (
          <Plug className="h-5 w-5 text-muted-foreground" />
        )}
        <h3 className="font-semibold text-base">{t.title}</h3>
      </div>

      <p className="mb-4 text-muted-foreground text-sm">{t.description}</p>

      {isConnected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-600 text-sm dark:text-green-400">
            <PlugZap className="h-4 w-4" />
            <span className="font-medium">{t.connectedStatus}</span>
          </div>

          {sessionId && (
            <p className="text-muted-foreground text-xs">
              Session: {sessionId.slice(0, 8)}...
            </p>
          )}

          <Button
            disabled={isDisconnecting}
            onClick={handleDisconnect}
            size="sm"
            type="button"
            variant="destructive"
          >
            {isDisconnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Disconnecting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                {t.disconnectButton}
              </>
            )}
          </Button>
        </div>
      ) : hasSavedTokens ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-blue-600 text-sm dark:text-blue-400">
            <RefreshCw className="h-4 w-4" />
            <span className="font-medium">{t.tokensSavedStatus}</span>
          </div>

          <Button
            disabled={isConnecting}
            onClick={handleConnect}
            size="sm"
            type="button"
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.connectingStatus}
              </>
            ) : (
              <>
                <Plug className="mr-2 h-4 w-4" />
                {t.reconnectButton}
              </>
            )}
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleConnect}>
          <div className="space-y-2">
            <Label htmlFor="jira-token">{t.jiraTokenLabel}</Label>
            <Input
              autoComplete="off"
              disabled={isConnecting}
              id="jira-token"
              onChange={(e) => setJiraToken(e.target.value)}
              placeholder={t.jiraTokenPlaceholder}
              type="password"
              value={jiraToken}
            />
            <p className="text-muted-foreground text-xs">{t.jiraTokenHelp}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confluence-token">{t.confluenceTokenLabel}</Label>
            <Input
              autoComplete="off"
              disabled={isConnecting}
              id="confluence-token"
              onChange={(e) => setConfluenceToken(e.target.value)}
              placeholder={t.confluenceTokenPlaceholder}
              type="password"
              value={confluenceToken}
            />
            <p className="text-muted-foreground text-xs">
              {t.confluenceTokenHelp}
            </p>
          </div>

          <Button
            disabled={
              isConnecting || (!jiraToken.trim() && !confluenceToken.trim())
            }
            size="sm"
            type="submit"
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.connectingStatus}
              </>
            ) : (
              <>
                <Plug className="mr-2 h-4 w-4" />
                {t.connectButton}
              </>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
