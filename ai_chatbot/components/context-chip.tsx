"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

export function ContextChip({ percentage }: { percentage: number }) {
  const clamped = Math.min(100, Math.max(0, percentage));

  let tone = "indigo";
  if (clamped >= 40) {
    tone = "yellow";
  }
  if (clamped >= 70) {
    tone = "orange";
  }
  if (clamped >= 90) {
    tone = "red";
  }

  const radius = 9;
  const centerX = 12;
  const centerY = 13;
  const circumference = Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);
  const arcPath = `M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="context-chip inline-flex cursor-default items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-[11px] shadow-sm ring-1 ring-black/5 ring-inset transition-all duration-500 dark:ring-white/10"
            data-testid="context-chip"
            data-tone={tone}
          >
            <svg
              aria-hidden
              className="context-chip__bar pointer-events-none shrink-0"
              height="16"
              viewBox="0 0 24 16"
              width="24"
            >
              <title>{`Context usage at ${clamped}%`}</title>
              <path
                d={arcPath}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.15"
                strokeWidth="2.5"
              />
              <path
                d={arcPath}
                fill="none"
                stroke="currentColor"
                strokeDasharray={String(circumference)}
                strokeDashoffset={String(dashOffset)}
                strokeLinecap="round"
                strokeWidth="2.5"
                style={{ transition: "stroke-dashoffset 0.7s ease-out" }}
              />
            </svg>
            <span>Context used</span>
            <span className="font-mono tabular-nums">{clamped}%</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs" side="top">
          <p className="font-medium">How context usage is calculated</p>
          <p className="mt-1 text-muted-foreground text-xs leading-snug">
            The percentage of the model's maximum context window currently
            occupied by the conversation: system prompt, prior messages, tool
            results, and the latest response. When it nears 100%, older messages
            may be summarized or dropped.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
