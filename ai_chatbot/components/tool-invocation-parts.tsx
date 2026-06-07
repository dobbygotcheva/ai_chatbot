"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import type { ChatMessage, ChatTools } from "@/lib/types";
import { parseCodeExecutionResult } from "@/lib/types/code-execution";
import { CodeExecutionResult as CodeExecutionResultComponent } from "./code-execution-result";
import { Tool, ToolContent, ToolHeader, ToolInput } from "./elements/tool";

type ApprovalProps = {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
};

export function DynamicToolMessagePart({
  part: dp,
  addToolApprovalResponse,
}: ApprovalProps & { part: DynamicToolUIPart }) {
  const label = dp.title ?? dp.toolName;
  const headerType = `tool-${dp.toolName}` as ToolUIPart<ChatTools>["type"];
  const approvalId = dp.approval?.id;
  const codeExecutionResult =
    dp.state === "output-available" && dp.toolName === "executeCode"
      ? parseCodeExecutionResult(dp.output)
      : null;

  return (
    <div className="w-[min(100%,450px)]">
      <Tool className="w-full" defaultOpen={true}>
        <ToolHeader state={dp.state} type={headerType} />
        <ToolContent>
          {(dp.state === "input-streaming" ||
            dp.state === "input-available" ||
            dp.state === "approval-requested" ||
            dp.state === "approval-responded") &&
            dp.input !== undefined && <ToolInput input={dp.input} />}
          {dp.state === "approval-requested" && approvalId && (
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <button
                className="cursor-pointer rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => {
                  addToolApprovalResponse({
                    id: approvalId,
                    approved: false,
                    reason: "User denied tool execution",
                  });
                }}
                type="button"
              >
                Deny
              </button>
              <button
                className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                onClick={() => {
                  addToolApprovalResponse({
                    id: approvalId,
                    approved: true,
                  });
                }}
                type="button"
              >
                Allow
              </button>
            </div>
          )}
          {codeExecutionResult === null ? (
            dp.state === "output-available" ? (
              <div className="message-bubble w-full max-w-4xl">
                <div
                  className="max-h-96 overflow-y-auto rounded-2xl px-4 py-3.5 text-left text-foreground shadow-sm"
                  style={{
                    backgroundColor: "var(--assistant-message-bg)",
                    border:
                      "1px solid var(--chrome-assistant-border-dark, var(--chrome-input-pane-light-border))",
                  }}
                >
                  <pre className="overflow-x-auto text-xs">
                    {JSON.stringify(dp.output, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null
          ) : (
            <CodeExecutionResultComponent result={codeExecutionResult} />
          )}
          {dp.state === "output-error" && (
            <div className="message-bubble w-full max-w-4xl">
              <div
                className="rounded-2xl px-4 py-3.5 text-left"
                style={{
                  backgroundColor: "var(--destructive/10)",
                  color: "var(--destructive)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {dp.errorText}
              </div>
            </div>
          )}
          {dp.state === "output-denied" && (
            <div className="px-4 py-3 text-muted-foreground text-sm">
              Tool "{label}" was denied.
            </div>
          )}
        </ToolContent>
      </Tool>
    </div>
  );
}

export function GenericStaticToolMessagePart({
  part: tp,
  addToolApprovalResponse,
}: ApprovalProps & {
  part: ToolUIPart<ChatTools>;
}) {
  const { state } = tp;
  const approvalId = (tp as { approval?: { id: string } }).approval?.id;
  const codeExecutionResult =
    state === "output-available" && tp.type === "tool-executeCode"
      ? parseCodeExecutionResult(tp.output)
      : null;

  return (
    <div className="w-[min(100%,450px)]">
      <Tool className="w-full" defaultOpen={state !== "output-available"}>
        <ToolHeader
          state={state}
          type={tp.type as ToolUIPart<ChatTools>["type"]}
        />
        <ToolContent>
          {(state === "input-streaming" ||
            state === "input-available" ||
            state === "approval-requested" ||
            state === "approval-responded") &&
            tp.input !== undefined && <ToolInput input={tp.input} />}
          {state === "approval-requested" && approvalId && (
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <button
                className="cursor-pointer rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => {
                  addToolApprovalResponse({
                    id: approvalId,
                    approved: false,
                    reason: "User denied tool execution",
                  });
                }}
                type="button"
              >
                Deny
              </button>
              <button
                className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
                onClick={() => {
                  addToolApprovalResponse({
                    id: approvalId,
                    approved: true,
                  });
                }}
                type="button"
              >
                Allow
              </button>
            </div>
          )}
          {codeExecutionResult === null ? (
            state === "output-available" ? (
              <div className="message-bubble w-full max-w-4xl">
                <div
                  className="max-h-96 overflow-y-auto rounded-2xl px-4 py-3.5 text-left text-foreground shadow-sm"
                  style={{
                    backgroundColor: "var(--assistant-message-bg)",
                    border:
                      "1px solid var(--chrome-assistant-border-dark, var(--chrome-input-pane-light-border))",
                  }}
                >
                  <pre className="overflow-x-auto text-xs">
                    {JSON.stringify(tp.output, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null
          ) : (
            <CodeExecutionResultComponent result={codeExecutionResult} />
          )}
          {state === "output-error" && (
            <div className="message-bubble w-full max-w-4xl">
              <div
                className="rounded-2xl px-4 py-3.5 text-left"
                style={{
                  backgroundColor: "var(--destructive/10)",
                  color: "var(--destructive)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {tp.errorText}
              </div>
            </div>
          )}
        </ToolContent>
      </Tool>
    </div>
  );
}
