"use client";

import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ONE_DAY_MS } from "@/lib/constants";
import { fetcher } from "@/lib/utils";

type GatewayToken = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
};

type GatewayTokenWithSecret = GatewayToken & { token: string };

type TokensResponse = {
  tokens: GatewayToken[];
  publicUrl: string | null;
};

type ExpiryPreset = "30" | "60" | "90";

const EXPIRY_OPTIONS: {
  value: ExpiryPreset;
  label: string;
  days: number;
}[] = [
  { value: "30", label: "30 days", days: 30 },
  { value: "60", label: "60 days", days: 60 },
  { value: "90", label: "90 days", days: 90 },
];

const TOKEN_NAME_MAX_LENGTH = 64;

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function expiryBadge(expiresAt: string): {
  label: string;
  variant: "secondary" | "destructive" | "outline";
} {
  const expires = new Date(expiresAt).getTime();
  if (Number.isNaN(expires)) {
    return { label: "—", variant: "outline" };
  }
  const now = Date.now();
  if (expires <= now) {
    return { label: "Expired", variant: "destructive" };
  }
  const daysLeft = Math.ceil((expires - now) / ONE_DAY_MS);
  if (daysLeft <= 7) {
    return { label: `${daysLeft}d left`, variant: "destructive" };
  }
  return { label: formatDate(expiresAt), variant: "outline" };
}

function statusBadge(expiresAt: string): {
  label: string;
  variant: "secondary" | "destructive" | "success";
} {
  const expires = new Date(expiresAt).getTime();
  if (!Number.isNaN(expires) && expires <= Date.now()) {
    return { label: "Expired", variant: "destructive" };
  }
  return { label: "Active", variant: "success" };
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function SettingsApiKeysTab() {
  const { data, error, isLoading, mutate } = useSWR<TokensResponse>(
    "/api/tokens",
    fetcher,
    { revalidateOnFocus: false }
  );

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [tokenToRevoke, setTokenToRevoke] = useState<GatewayToken | null>(null);
  const [revealedToken, setRevealedToken] =
    useState<GatewayTokenWithSecret | null>(null);

  const handleRevoke = useCallback(
    async (token: GatewayToken) => {
      try {
        const response = await fetch(
          `/api/tokens/${encodeURIComponent(token.id)}`,
          { method: "DELETE" }
        );
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            message?: string;
            error?: string;
          };
          throw new Error(
            body.error ?? body.message ?? "Failed to revoke token"
          );
        }
        toast.success(`Revoked "${token.name}"`);
        await mutate();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to revoke token"
        );
      } finally {
        setTokenToRevoke(null);
      }
    },
    [mutate]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-sm">Loading personal tokens…</span>
      </div>
    );
  }

  if (error) {
    return (
      <ApiKeysError
        description="Try again in a moment. If the issue persists, contact an administrator."
        title="Couldn't load personal tokens"
      />
    );
  }

  const tokens = data?.tokens ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-xl">Personal Tokens</h2>
          <p className="mt-1 text-base text-muted-foreground">
            Create and revoke personal tokens for the EGT LLM Gateway. Use them
            with external AI clients such as Claude Code, Codex, or OpenCode.
          </p>
        </div>
        <Button
          data-testid="create-new-token-button"
          onClick={() => {
            setRevealedToken(null);
            setIsCreateOpen((prev) => !prev);
          }}
          size="sm"
          type="button"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create new token
        </Button>
      </div>

      {isCreateOpen && !revealedToken ? (
        <CreateTokenPanel
          onClose={() => setIsCreateOpen(false)}
          onCreated={async (created) => {
            setIsCreateOpen(false);
            setRevealedToken(created);
            await mutate();
          }}
        />
      ) : null}

      {revealedToken ? (
        <RevealTokenPanel
          onClose={() => setRevealedToken(null)}
          token={revealedToken}
        />
      ) : null}

      <div className="rounded-xl border border-border/60 bg-card p-4">
        <p className="font-medium text-sm">OpenAI API Reference</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
            https://developers.openai.com/api/reference/overview
          </code>
          <CopyButton
            label="Copy API reference URL"
            value="https://developers.openai.com/api/reference/overview"
          />
        </div>
        <p className="mt-3 font-medium text-sm">Embedded Model</p>
        <p className="mt-1 text-muted-foreground text-xs">foundation</p>
      </div>

      {tokens.length === 0 ? (
        <div className="rounded-xl border border-border/60 border-dashed bg-background p-8 text-center">
          <KeyRound
            aria-hidden="true"
            className="mx-auto h-8 w-8 text-muted-foreground"
          />
          <p className="mt-3 font-medium text-sm">No personal tokens yet</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Create a token to connect Claude Code, Codex, or any
            OpenAI-compatible client to the gateway.
          </p>
          <Button
            className="mt-4"
            onClick={() => setIsCreateOpen(true)}
            size="sm"
            type="button"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create your first token
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="hidden md:table-cell">
                  Last used
                </TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => {
                const badge = expiryBadge(token.expiresAt);
                const status = statusBadge(token.expiresAt);
                return (
                  <TableRow key={token.id}>
                    <TableCell className="font-medium">{token.name}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatDate(token.createdAt)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatDate(token.lastUsedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        aria-label={`Revoke ${token.name}`}
                        className="group/revoke text-destructive transition-all duration-200 hover:bg-transparent hover:text-destructive hover:drop-shadow-[0_0_6px_rgba(239,68,68,0.5)] dark:hover:drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]"
                        onClick={() => setTokenToRevoke(token)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4 transition-all duration-200 group-hover/revoke:scale-105" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setTokenToRevoke(null);
          }
        }}
        open={tokenToRevoke !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this token?</AlertDialogTitle>
            <AlertDialogDescription>
              Any client using <strong>{tokenToRevoke?.name}</strong> will stop
              working immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (tokenToRevoke) {
                  handleRevoke(tokenToRevoke);
                }
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ApiKeysError({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 text-destructive"
        />
        <div>
          <p className="font-medium text-destructive text-sm">{title}</p>
          <p className="mt-1 text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      aria-label={label}
      onClick={async () => {
        const ok = await copyToClipboard(value);
        if (ok) {
          setCopied(true);
          toast.success("Copied to clipboard");
          setTimeout(() => setCopied(false), 1500);
        } else {
          toast.error("Couldn't copy to clipboard");
        }
      }}
      size="sm"
      type="button"
      variant="outline"
    >
      {copied ? (
        <Check className="mr-1.5 h-3.5 w-3.5" />
      ) : (
        <Copy className="mr-1.5 h-3.5 w-3.5" />
      )}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function CreateTokenPanel({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (token: GatewayTokenWithSecret) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState<ExpiryPreset>("90");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give the token a name first");
      return;
    }
    setIsSubmitting(true);
    try {
      const selected = EXPIRY_OPTIONS.find((opt) => opt.value === expiry);
      if (!selected) {
        throw new Error("Invalid expiry selection");
      }
      const response = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          expiresInDays: selected.days,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(body.error ?? body.message ?? "Failed to create token");
      }
      const created = (await response.json()) as GatewayTokenWithSecret;
      await onCreated(created);
      setName("");
      setExpiry("90");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create token"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative rounded-xl border border-border bg-card p-4 shadow-sm">
      <button
        aria-label="Close create token panel"
        className="absolute top-3 right-3 rounded-sm p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
        disabled={isSubmitting}
        onClick={onClose}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-3 pr-8">
        <h3 className="font-semibold text-base">Create personal token</h3>
        <p className="mt-1 text-muted-foreground text-xs">
          Give it a name you'll recognize. You'll see the full token once on the
          next screen — copy it then, it won't be shown again.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="font-semibold text-sm" htmlFor="token-name">
            Name
          </Label>
          <Input
            autoFocus
            data-testid="token-name-input"
            id="token-name"
            maxLength={TOKEN_NAME_MAX_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder="Claude Code on work laptop"
            value={name}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="font-semibold text-sm" htmlFor="token-expiry">
            Expiration
          </Label>
          <Select
            onValueChange={(value) => setExpiry(value as ExpiryPreset)}
            value={expiry}
          >
            <SelectTrigger id="token-expiry">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPIRY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button
          disabled={isSubmitting}
          onClick={onClose}
          size="sm"
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          disabled={isSubmitting}
          onClick={handleSubmit}
          size="sm"
          type="button"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating
            </>
          ) : (
            "Create token"
          )}
        </Button>
      </div>
    </div>
  );
}

// Fixed number of bullets so the masked row stays a neat strip regardless of
// how long the real token is. We keep it shorter than the real token so users
// can't reverse-engineer the length.
const MASK_DOTS = "•".repeat(30);

function RevealTokenPanel({
  token,
  onClose,
}: {
  token: GatewayTokenWithSecret;
  onClose: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(token.token);
    if (ok) {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error("Couldn't copy to clipboard");
    }
  };

  return (
    <div className="relative w-full max-w-6xl rounded-xl border border-border bg-card p-6 shadow-sm">
      <button
        aria-label="Close revealed token panel"
        className="absolute top-3 right-3 rounded-sm p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={onClose}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-4 pr-8">
        <h3 className="font-semibold text-base">Personal token created</h3>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-3 dark:border-amber-400/30 dark:bg-amber-500/10">
          <AlertTriangle
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <div className="space-y-1.5 text-amber-900 text-sm leading-relaxed dark:text-amber-100">
            <p className="font-semibold">
              Copy this token now — it won't be shown again.
            </p>
            <p className="text-amber-800 dark:text-amber-200">
              Store it in a secure location. Anyone with this token can access
              the API on your behalf.
            </p>
          </div>
        </div>

        <div className="space-y-3.5">
          <Label className="font-semibold text-sm">Personal token</Label>
          <div className="flex items-center gap-2">
            <div className="flex min-h-11 flex-1 items-center rounded-md border border-input bg-background px-4 py-3">
              <code className="block w-full break-all font-mono text-xs leading-snug">
                {isVisible ? token.token : MASK_DOTS}
              </code>
            </div>
            <Button
              aria-label={isVisible ? "Hide token" : "Show token"}
              className="shrink-0"
              onClick={() => setIsVisible((v) => !v)}
              size="icon"
              type="button"
              variant="outline"
            >
              {isVisible ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
            <Button
              aria-label="Copy token"
              className="shrink-0"
              onClick={handleCopy}
              size="icon"
              type="button"
              variant="outline"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button onClick={onClose} size="sm" type="button">
          Done
        </Button>
      </div>
    </div>
  );
}
