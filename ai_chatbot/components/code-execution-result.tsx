"use client";

import {
  CheckCircleIcon,
  ClockIcon,
  TerminalIcon,
  XCircleIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { CodeExecutionDisplayProps } from "@/lib/types/code-execution";
import { cn } from "@/lib/utils";
import { ArtifactDisplay } from "./artifact-display";

function OutputDisplay({
  text,
  variant,
}: {
  text: string;
  variant: "stdout" | "stderr";
}) {
  return (
    <pre
      className={cn(
        "max-h-96 overflow-auto rounded-b-md p-3 font-mono text-xs",
        variant === "stderr"
          ? "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
          : "bg-muted/50 text-foreground"
      )}
    >
      {text}
    </pre>
  );
}

export const CodeExecutionResult = ({
  result,
  className,
}: CodeExecutionDisplayProps) => {
  // Determine success and exit code
  // If we have explicit success field, use it
  // Otherwise, infer from stderr (errors = failure)
  const hasErrors = result.stderr && result.stderr.trim().length > 0;
  const isSuccess = result.success ?? !hasErrors;
  const exitCode = result.exit_code ?? (isSuccess ? 0 : 1);
  const durationSeconds = (result.duration_ms / 1000).toFixed(2);

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b bg-muted/30 px-3 py-2.5">
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <CheckCircleIcon className="size-4 text-green-600" />
          ) : (
            <XCircleIcon className="size-4 text-red-600" />
          )}
          <Badge
            className="gap-1.5 rounded-full text-xs"
            variant={isSuccess ? "secondary" : "destructive"}
          >
            {isSuccess ? (
              <span className="text-green-700">Success</span>
            ) : (
              <span>Failed</span>
            )}
          </Badge>
          <Badge
            className={cn(
              "rounded-full border-green-200 bg-green-50 font-mono text-green-700 text-xs dark:border-green-900 dark:bg-green-950 dark:text-green-400",
              !isSuccess &&
                "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
            )}
            variant="outline"
          >
            <TerminalIcon className="mr-1 size-3" />
            exit: {exitCode}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
          <div className="flex items-center gap-1.5">
            <ClockIcon className="size-3" />
            <span className="font-medium">{durationSeconds}s</span>
          </div>
          {result.execution_id && (
            <span
              className="truncate font-mono text-[10px] opacity-60"
              title={result.execution_id}
            >
              {result.execution_id.slice(0, 8)}...
            </span>
          )}
        </div>
      </div>

      {result.stdout && (
        <div className="mb-3">
          <OutputDisplay text={result.stdout} variant="stdout" />
        </div>
      )}

      {result.stderr && (
        <div className="mb-3">
          <OutputDisplay text={result.stderr} variant="stderr" />
        </div>
      )}

      {result.files?.length || result.images?.length ? (
        <ArtifactDisplay files={result.files} images={result.images} />
      ) : null}

      {result.truncated ? (
        <div className="mt-2 rounded-md bg-yellow-500/10 p-2 text-xs text-yellow-600">
          Output was truncated due to size limits
        </div>
      ) : null}
    </div>
  );
};
