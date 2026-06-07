"use client";

import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Lock,
  Plus,
  Settings2,
  Unplug,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ConfluenceProductIcon,
  JiraProductIcon,
} from "@/components/atlassian-product-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  required: boolean;
  placeholder?: string;
  helpText?: string;
}

interface AppEntry {
  appId: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  authMethod: "oauth2" | "apikey" | "basic" | "none";
  oauthProvider?: string;
  configFields?: ConfigField[];
  tools: string[];
  connected: boolean;
  connectedAt?: string;
  lastUsedAt?: string;
}

const APP_ICONS: Record<string, React.ReactNode> = {
  outlook: (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Outlook</title>
      <rect fill="#0078D4" height="24" rx="4" width="24" />
      <path d="M13 7h6v10h-6V7z" fill="#fff" opacity=".6" />
      <path
        d="M5 8.5C5 7.12 6.12 6 7.5 6h3C11.88 6 13 7.12 13 8.5v7C13 16.88 11.88 18 10.5 18h-3C6.12 18 5 16.88 5 15.5v-7z"
        fill="#fff"
      />
      <ellipse cx="9" cy="12" fill="#0078D4" rx="2.5" ry="3" />
    </svg>
  ),
  teams: (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Teams</title>
      <rect fill="#5059C9" height="24" rx="4" width="24" />
      <circle cx="15.5" cy="8" fill="#fff" r="2" />
      <path
        d="M13 12.5c0-1.1.9-2 2-2h3a2 2 0 0 1 2 2V16h-7v-3.5z"
        fill="#fff"
        opacity=".8"
      />
      <circle cx="9" cy="7.5" fill="#fff" r="2.5" />
      <path d="M4 13c0-1.66 1.34-3 3-3h4a3 3 0 0 1 3 3v4H4v-4z" fill="#fff" />
    </svg>
  ),
  jira: <JiraProductIcon className="size-6" />,
  confluence: <ConfluenceProductIcon className="size-6" />,
  libreoffice: (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>LibreOffice</title>
      <rect fill="#18A303" height="24" rx="4" width="24" />
      <path d="M6 6h8l4 4v8H6V6z" fill="#fff" opacity=".9" />
      <path d="M14 6l4 4h-4V6z" fill="#18A303" opacity=".5" />
      <path
        d="M9 12h6M9 14h4"
        stroke="#18A303"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  ),
};

const CATEGORY_LABELS: Record<string, string> = {
  communication: "Communication",
  collaboration: "Collaboration",
  office: "Office",
  productivity: "Productivity",
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Handles app card UI, configuration forms, connection states, and tool list display
function AppCard({
  app,
  onConnect,
  onDisconnect,
}: {
  app: AppEntry;
  onConnect: (appId: string, config?: Record<string, string>) => Promise<void>;
  onDisconnect: (appId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showTools, setShowTools] = useState(false);

  const handleConnect = async () => {
    if (app.authMethod === "oauth2" && app.oauthProvider === "microsoft") {
      window.location.href = "/api/auth/signin/microsoft-entra-id";
      return;
    }

    const hasConfigFields = app.configFields && app.configFields.length > 0;

    if (
      (app.authMethod === "apikey" || app.authMethod === "basic") &&
      hasConfigFields &&
      !expanded
    ) {
      setExpanded(true);
      return;
    }

    setLoading(true);
    try {
      await onConnect(
        app.appId,
        Object.keys(config).length > 0 ? config : undefined
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await onDisconnect(app.appId);
      // Reset config state so old tokens aren't reused
      setConfig({});
      setExpanded(false);
      setShowTools(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitConfig = async () => {
    setLoading(true);
    try {
      await onConnect(app.appId, config);
      setExpanded(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`rounded-xl border transition-all ${
        app.connected
          ? "border-green-500/40 bg-green-500/5"
          : "border-border/60 bg-card"
      }`}
    >
      <div className="flex items-start gap-4 p-4">
        <div className="mt-0.5 flex-shrink-0">
          {APP_ICONS[app.icon] ?? (
            <div className="flex h-6 w-6 items-center justify-center rounded bg-muted font-bold text-xs">
              {app.name.at(0)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm">{app.name}</span>
            <Badge
              className="text-xs"
              variant={app.connected ? "default" : "secondary"}
            >
              {app.connected ? (
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3" /> Connected
                </span>
              ) : (
                "Not connected"
              )}
            </Badge>
            <Badge className="text-xs" variant="outline">
              {CATEGORY_LABELS[app.category] ?? app.category}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
            {app.description}
          </p>
          {app.connected && app.connectedAt && (
            <p className="mt-1 text-muted-foreground text-xs">
              Connected {new Date(app.connectedAt).toLocaleDateString()}
              {app.lastUsedAt &&
                ` · Last used ${new Date(app.lastUsedAt).toLocaleDateString()}`}
            </p>
          )}

          <button
            className="mt-2 flex cursor-pointer items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
            onClick={() => setShowTools(!showTools)}
            type="button"
          >
            {showTools ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {app.tools.length} AI tools available
          </button>

          {showTools && (
            <div className="mt-2 flex flex-wrap gap-1">
              {app.tools.map((t, i) => (
                <Badge
                  className="font-mono text-xs"
                  // biome-ignore lint/suspicious/noArrayIndexKey: tool name may not be unique, index provides fallback
                  key={`${t}-${i}`}
                  variant="outline"
                >
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {app.authMethod === "oauth2" && !app.connected && (
            <Badge className="text-xs" variant="outline">
              <ExternalLink className="mr-1 h-3 w-3" />
              SSO
            </Badge>
          )}
          {app.connected ? (
            <Button
              className="h-8 gap-1 text-xs"
              disabled={loading}
              onClick={handleDisconnect}
              size="sm"
              variant="outline"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Unplug className="h-3 w-3" />
              )}
              Disconnect
            </Button>
          ) : (
            <Button
              className="h-8 gap-1 text-xs"
              disabled={loading}
              onClick={handleConnect}
              size="sm"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : app.authMethod === "apikey" || app.authMethod === "basic" ? (
                <Settings2 className="h-3 w-3" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Connect
            </Button>
          )}
        </div>
      </div>

      {expanded &&
        !app.connected &&
        app.configFields &&
        app.configFields.length > 0 && (
          <div className="border-border/40 border-t p-4">
            <p className="mb-3 font-medium text-sm">Connection settings</p>
            <div className="space-y-3">
              {app.configFields.map((field) => (
                <div className="space-y-1" key={field.key}>
                  <Label
                    className="text-xs"
                    htmlFor={`${app.appId}-${field.key}`}
                  >
                    {field.label}
                    {field.required && (
                      <span className="ml-1 text-destructive">*</span>
                    )}
                  </Label>
                  <Input
                    className="h-8 text-sm"
                    id={`${app.appId}-${field.key}`}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    required={field.required}
                    type={field.type}
                    value={config[field.key] ?? ""}
                  />
                  {field.helpText && (
                    <p className="text-muted-foreground text-xs">
                      {field.helpText}
                    </p>
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Button
                  className="h-8 text-xs"
                  disabled={loading}
                  onClick={handleSubmitConfig}
                  size="sm"
                >
                  {loading ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : null}
                  Save & Connect
                </Button>
                <Button
                  className="h-8 text-xs"
                  onClick={() => setExpanded(false)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

interface SettingsAppsTabProps {
  hasToolsPermission?: boolean;
}

export function SettingsAppsTab({
  hasToolsPermission = true,
}: SettingsAppsTabProps) {
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const fetchApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mcp/connections");
      if (!res.ok) {
        throw new Error("Failed to load apps");
      }
      const data = await res.json();
      setApps(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch apps if user has permission
    if (hasToolsPermission) {
      fetchApps();
    }
  }, [fetchApps, hasToolsPermission]);

  const handleConnect = async (
    appId: string,
    config?: Record<string, string>
  ) => {
    // Transform config to match API expectations
    const body: Record<string, unknown> = { serverName: appId };

    if (config) {
      // Map config keys to API parameter names
      if (config.jiraToken) {
        body.jiraToken = config.jiraToken;
      }
      if (config.confluenceToken) {
        body.confluenceToken = config.confluenceToken;
      }
      // For non-atlassian servers, pass serverUrl
      if (config.serverUrl) {
        body.serverUrl = config.serverUrl;
      }
    }

    const res = await fetch("/api/mcp/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast.success("App connected successfully");
      await fetchApps();
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Failed to connect app");
    }
  };

  const handleDisconnect = async (appId: string) => {
    const res = await fetch(`/api/mcp/connections?serverName=${appId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      toast.success("App disconnected");
      await fetchApps();
    } else {
      toast.error("Failed to disconnect app");
    }
  };

  const categories = ["all", ...new Set(apps.map((a) => a.category))];
  const filtered =
    filter === "all" ? apps : apps.filter((a) => a.category === filter);

  const connectedCount = apps.filter((a) => a.connected).length;

  if (!hasToolsPermission) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Card className="bg-amber-500/10 p-6 text-center">
          <div className="mb-4 flex items-center justify-center">
            <Lock className="h-12 w-12 text-amber-600 dark:text-amber-500" />
          </div>
          <h3 className="font-semibold text-foreground text-lg">
            Access Restricted
          </h3>
          <p className="mt-2 text-muted-foreground text-sm">
            You don't have permissions to connect external apps!
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            Contact your administrator to request access.
          </p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        {error}
        <Button
          className="ml-auto h-7 text-xs"
          onClick={fetchApps}
          size="sm"
          type="button"
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-xl">Apps & Integrations</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Connect enterprise apps to let the AI assistant read, write, and act
          on your behalf. Microsoft apps authenticate via your company SSO.
        </p>
      </div>

      {connectedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-green-700 text-sm dark:text-green-400">
          <Check className="h-4 w-4" />
          {connectedCount} app{connectedCount === 1 ? "" : "s"} connected — the
          AI can now use {connectedCount === 1 ? "it" : "them"} in your chats.
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat, index) => (
          <button
            className={`cursor-pointer rounded-full px-3 py-1 font-medium text-xs transition-colors ${
              filter === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            // biome-ignore lint/suspicious/noArrayIndexKey: category names may not be unique, index provides fallback
            key={`${cat}-${index}`}
            onClick={() => setFilter(cat)}
            type="button"
          >
            {cat === "all"
              ? `All (${apps.length})`
              : (CATEGORY_LABELS[cat] ?? cat)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((app) => (
          <AppCard
            app={app}
            key={app.appId}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        ))}
      </div>

      <div className="rounded-lg border border-border/40 bg-muted/30 p-3 text-muted-foreground text-xs">
        <strong className="text-foreground">Privacy note:</strong> Credentials
        and tokens are stored encrypted in your account. The AI only accesses
        connected apps when you explicitly ask it to in a conversation.
      </div>
    </div>
  );
}
