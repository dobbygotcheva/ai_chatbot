"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { DynamicToolUIPart, ToolUIPart, UIMessagePart } from "ai";
import { Globe2 } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import type { ChatMessage, ChatTools, CustomUIDataTypes } from "@/lib/types";
import { parseCodeExecutionResult } from "@/lib/types/code-execution";
import { cn, sanitizeText } from "@/lib/utils";
import { AssistantBubbleContent } from "./assistant-bubble-content";
import { CodeExecutionResult as CodeExecutionResultComponent } from "./code-execution-result";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { MessageContent } from "./elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "./elements/reasoning";
import { Response } from "./elements/response";
import { Tool, ToolContent, ToolHeader, ToolInput } from "./elements/tool";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import {
  DynamicToolMessagePart,
  GenericStaticToolMessagePart,
} from "./tool-invocation-parts";
import { Weather } from "./weather";
import { WebSearchResults } from "./web-search-results";

function isWebSearchPartDone(
  p: UIMessagePart<CustomUIDataTypes, ChatTools>
): boolean {
  if (p.type !== "tool-findWebpages" && p.type !== "tool-crawlPages") {
    return true;
  }
  const s = p.state;
  return (
    s === "output-available" || s === "output-error" || s === "output-denied"
  );
}

function firstWebSearchPartIndex(message: ChatMessage): number {
  return message.parts.findIndex(
    (p) => p.type === "tool-findWebpages" || p.type === "tool-crawlPages"
  );
}

function anyWebSearchPartBusy(message: ChatMessage): boolean {
  for (const p of message.parts) {
    if (
      (p.type === "tool-findWebpages" || p.type === "tool-crawlPages") &&
      !isWebSearchPartDone(p)
    ) {
      return true;
    }
  }
  return false;
}

function collectWebSearchQueries(message: ChatMessage): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of message.parts) {
    if (p.type !== "tool-findWebpages" && p.type !== "tool-crawlPages") {
      continue;
    }
    const input = p.input as { search?: string; urls?: string[] } | undefined;
    const q = input?.search?.trim();
    if (q && !seen.has(q)) {
      seen.add(q);
      out.push(q);
    }
  }
  return out;
}

type PartProps = {
  part: UIMessagePart<CustomUIDataTypes, ChatTools>;
  message: ChatMessage;
  /** Index of `part` in `message.parts` (used to dedupe web search UI). */
  partIndex: number;
  messageKey: string;
  isLoading: boolean;
  mode: "view" | "edit";
  setMode: (m: "view" | "edit") => void;
  isReadonly: boolean;
  isStreaming?: boolean;
  textSpeed?: number;
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
};

function ReasoningPart({
  part,
  messageKey,
  isLoading,
}: Pick<PartProps, "part" | "messageKey" | "isLoading">) {
  if (part == null || part.type !== "reasoning") {
    return null;
  }
  const hasContent = part.text?.trim().length > 0;
  const isStreaming = "state" in part && part.state === "streaming";
  if (!(hasContent || isStreaming)) {
    return null;
  }
  return (
    <MessageReasoning
      isLoading={isLoading || isStreaming}
      key={messageKey}
      reasoning={part.text || ""}
    />
  );
}

function TextPart({
  part,
  message,
  messageKey,
  mode,
  setMode,
  setMessages,
  regenerate,
  textSpeed,
  isStreaming,
}: Pick<
  PartProps,
  | "part"
  | "message"
  | "messageKey"
  | "mode"
  | "setMode"
  | "setMessages"
  | "regenerate"
  | "textSpeed"
  | "isStreaming"
>) {
  if (part.type !== "text") {
    return null;
  }
  if (message.role === "assistant" && !part.text?.trim()) {
    return null;
  }
  if (mode === "view") {
    if (message.role === "assistant") {
      return (
        <div
          className="message-bubble wrap-break-word w-full min-w-0 max-w-4xl text-left text-[15px] text-foreground leading-relaxed"
          key={messageKey}
        >
          <AssistantBubbleContent
            delay={textSpeed}
            isStreaming={isStreaming}
            text={part.text}
          />
        </div>
      );
    }

    return (
      <div className="message-bubble" key={messageKey}>
        <MessageContent
          className={cn(
            "wrap-break-word w-fit rounded-2xl px-4 py-3 text-left text-[15px] text-foreground leading-relaxed shadow-sm"
          )}
          data-testid="message-content"
        >
          <Response className="wrap-break-word text-[15px] leading-relaxed">
            {sanitizeText(part.text)}
          </Response>
        </MessageContent>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-row items-start" key={messageKey}>
      <div className="min-w-0 flex-1">
        <MessageEditor
          key={message.id}
          message={message}
          regenerate={regenerate}
          setMessages={setMessages}
          setMode={setMode}
        />
      </div>
    </div>
  );
}

/**
 * Same chrome as {@link MessageReasoning}: trigger row with icon where the brain
 * sits for thinking (globe for web search) and the shared bordered inner bubble.
 */
function WebSearchToolBubble({
  message,
  messageKey,
  partIndex,
}: {
  message: ChatMessage;
  messageKey: string;
  partIndex: number;
}) {
  const firstIdx = firstWebSearchPartIndex(message);
  const isActiveBubble = firstIdx !== -1 && partIndex === firstIdx;
  const allDone = !anyWebSearchPartBusy(message);
  const queries = collectWebSearchQueries(message);

  const [defaultOpen, setDefaultOpen] = useState(
    () => isActiveBubble && !allDone
  );

  useEffect(() => {
    if (!isActiveBubble) {
      return;
    }
    if (!allDone) {
      setDefaultOpen(true);
    }
  }, [allDone, isActiveBubble]);

  if (!isActiveBubble) {
    return null;
  }

  const contentBody =
    queries.length === 0
      ? t("en", "chat.web_search_pending")
      : queries.length === 1
        ? sanitizeText(queries[0])
        : queries.map((q) => `- ${sanitizeText(q)}`).join("\n");

  return (
    <div
      aria-live={allDone ? "off" : "polite"}
      className="w-full min-w-0"
      key={messageKey}
      role="status"
    >
      <Reasoning
        data-testid="web-search-bubble"
        defaultOpen={defaultOpen}
        isStreaming={!allDone}
      >
        <ReasoningTrigger
          aria-busy={!allDone}
          icon={
            <Globe2 aria-hidden className="size-3" focusable={false}>
              <title>{t("en", "chat.web_search")}</title>
            </Globe2>
          }
          streamingLabel={
            <span className="inline-flex items-center gap-1">
              <span>{t("en", "chat.web_search")}</span>
              {!allDone && (
                <span aria-hidden className="inline-flex text-muted-foreground">
                  <span className="animate-bounce [animation-delay:0ms]">
                    .
                  </span>
                  <span className="animate-bounce [animation-delay:150ms]">
                    .
                  </span>
                  <span className="animate-bounce [animation-delay:300ms]">
                    .
                  </span>
                </span>
              )}
            </span>
          }
        />
        <ReasoningContent>{contentBody}</ReasoningContent>
      </Reasoning>
    </div>
  );
}

function CodeExecutionToolPart({
  part,
  addToolApprovalResponse,
}: Pick<PartProps, "part" | "addToolApprovalResponse">) {
  if (part.type !== "tool-executeCode") {
    return null;
  }
  const { toolCallId, state } = part;
  const approvalId = (part as { approval?: { id: string } }).approval?.id;
  const isDenied =
    state === "output-denied" ||
    (state === "approval-responded" &&
      (part as { approval?: { approved?: boolean } }).approval?.approved ===
        false);
  const widthClass = "w-full max-w-4xl";

  if (state === "output-available") {
    const output = part.output as Record<string, unknown>;
    const result = parseCodeExecutionResult(output);
    if (!result) {
      return null;
    }
    return (
      <div className={widthClass} key={toolCallId}>
        <Tool className="w-full" defaultOpen={true}>
          <ToolHeader state={state} type="tool-executeCode" />
          <ToolContent>
            <CodeExecutionResultComponent result={result} />
          </ToolContent>
        </Tool>
      </div>
    );
  }

  if (isDenied) {
    return (
      <div className={widthClass} key={toolCallId}>
        <Tool className="w-full" defaultOpen={true}>
          <ToolHeader state="output-denied" type="tool-executeCode" />
          <ToolContent>
            <div className="px-4 py-3 text-muted-foreground text-sm">
              Code execution was denied.
            </div>
          </ToolContent>
        </Tool>
      </div>
    );
  }

  if (state === "approval-responded") {
    return (
      <div className={widthClass} key={toolCallId}>
        <Tool className="w-full" defaultOpen={true}>
          <ToolHeader state={state} type="tool-executeCode" />
          <ToolContent>
            <ToolInput input={part.input} />
          </ToolContent>
        </Tool>
      </div>
    );
  }

  return (
    <div className={widthClass} key={toolCallId}>
      <Tool className="w-full" defaultOpen={true}>
        <ToolHeader state={state} type="tool-executeCode" />
        <ToolContent>
          {(state === "input-available" || state === "approval-requested") && (
            <ToolInput input={part.input} />
          )}
          {state === "approval-requested" && approvalId && (
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <button
                className="cursor-pointer rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => {
                  addToolApprovalResponse({
                    id: approvalId,
                    approved: false,
                    reason: "User denied code execution",
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
        </ToolContent>
      </Tool>
    </div>
  );
}

function WeatherToolPart({
  part,
  addToolApprovalResponse,
}: Pick<PartProps, "part" | "addToolApprovalResponse">) {
  if (part.type !== "tool-getWeather") {
    return null;
  }
  const { toolCallId, state } = part;
  const approvalId = (part as { approval?: { id: string } }).approval?.id;
  const isDenied =
    state === "output-denied" ||
    (state === "approval-responded" &&
      (part as { approval?: { approved?: boolean } }).approval?.approved ===
        false);
  const widthClass = "w-[min(100%,450px)]";

  if (state === "output-available") {
    const weatherOutput = part.output as Record<string, unknown>;
    if (weatherOutput?.error) {
      return (
        <div className={widthClass} key={toolCallId}>
          <Tool className="w-full" defaultOpen={true}>
            <ToolHeader state={state} type="tool-getWeather" />
            <ToolContent>
              <div className="px-4 py-3 text-muted-foreground text-sm">
                {String(weatherOutput.error)}
              </div>
            </ToolContent>
          </Tool>
        </div>
      );
    }
    return (
      <div className={widthClass} key={toolCallId}>
        <Weather weatherAtLocation={part.output} />
      </div>
    );
  }

  if (isDenied) {
    return (
      <div className={widthClass} key={toolCallId}>
        <Tool className="w-full" defaultOpen={true}>
          <ToolHeader state="output-denied" type="tool-getWeather" />
          <ToolContent>
            <div className="px-4 py-3 text-muted-foreground text-sm">
              Weather lookup was denied.
            </div>
          </ToolContent>
        </Tool>
      </div>
    );
  }

  if (state === "approval-responded") {
    return (
      <div className={widthClass} key={toolCallId}>
        <Tool className="w-full" defaultOpen={true}>
          <ToolHeader state={state} type="tool-getWeather" />
          <ToolContent>
            <ToolInput input={part.input} />
          </ToolContent>
        </Tool>
      </div>
    );
  }

  return (
    <div className={widthClass} key={toolCallId}>
      <Tool className="w-full" defaultOpen={true}>
        <ToolHeader state={state} type="tool-getWeather" />
        <ToolContent>
          {(state === "input-available" || state === "approval-requested") && (
            <ToolInput input={part.input} />
          )}
          {state === "approval-requested" && approvalId && (
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <button
                className="cursor-pointer rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => {
                  addToolApprovalResponse({
                    id: approvalId,
                    approved: false,
                    reason: "User denied weather lookup",
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
        </ToolContent>
      </Tool>
    </div>
  );
}

function CreateDocumentToolPart({
  part,
  isReadonly,
}: Pick<PartProps, "part" | "isReadonly">) {
  if (part.type !== "tool-createDocument") {
    return null;
  }
  const { toolCallId } = part;

  if (part.output && "error" in part.output) {
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
        key={toolCallId}
      >
        Error creating document: {String(part.output.error)}
      </div>
    );
  }

  return (
    <DocumentPreview
      isReadonly={isReadonly}
      key={toolCallId}
      result={part.output}
    />
  );
}

function UpdateDocumentToolPart({
  part,
  isReadonly,
}: Pick<PartProps, "part" | "isReadonly">) {
  if (part.type !== "tool-updateDocument") {
    return null;
  }
  const { toolCallId } = part;

  if (part.output && "error" in part.output) {
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
        key={toolCallId}
      >
        Error updating document: {String(part.output.error)}
      </div>
    );
  }

  if (!part.output) {
    return null;
  }

  const output = part.output;
  if (output.title === undefined || output.kind === undefined) {
    return null;
  }

  return (
    <div className="relative" key={toolCallId}>
      <DocumentPreview
        args={{
          title: output.title,
          kind: output.kind,
          id: output.id,
          content: "content" in output ? output.content : undefined,
          isUpdate: true,
        }}
        isReadonly={isReadonly}
        result={output}
      />
    </div>
  );
}

function RequestSuggestionsToolPart({
  part,
  isReadonly,
}: Pick<PartProps, "part" | "isReadonly">) {
  if (part.type !== "tool-requestSuggestions") {
    return null;
  }
  const { toolCallId, state } = part;

  return (
    <Tool defaultOpen={true} key={toolCallId}>
      <ToolHeader state={state} type="tool-requestSuggestions" />
      <ToolContent>
        {state === "input-available" && <ToolInput input={part.input} />}
        {state === "output-available" &&
          ("error" in part.output ? (
            <div className="message-bubble w-full max-w-4xl">
              <div
                className="rounded-2xl px-4 py-3.5 text-left"
                style={{
                  backgroundColor: "var(--destructive/10)",
                  color: "var(--destructive)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                Error: {String(part.output.error)}
              </div>
            </div>
          ) : (
            <div className="message-bubble w-full max-w-4xl">
              <div
                className="max-h-96 overflow-y-auto rounded-2xl px-4 py-3.5 text-left text-foreground shadow-sm"
                style={{
                  backgroundColor: "var(--assistant-message-bg)",
                  border:
                    "1px solid var(--chrome-assistant-border-dark, var(--chrome-input-pane-light-border))",
                }}
              >
                <DocumentToolResult
                  isReadonly={isReadonly}
                  result={part.output}
                  type="request-suggestions"
                />
              </div>
            </div>
          ))}
      </ToolContent>
    </Tool>
  );
}

export function MessagePartBlock(props: PartProps) {
  const { part, messageKey } = props;

  if (part.type === "reasoning") {
    return (
      <ReasoningPart
        isLoading={props.isLoading}
        messageKey={messageKey}
        part={part}
      />
    );
  }

  if (part.type === "text") {
    return (
      <TextPart
        isStreaming={props.isStreaming}
        message={props.message}
        messageKey={messageKey}
        mode={props.mode}
        part={part}
        regenerate={props.regenerate}
        setMessages={props.setMessages}
        setMode={props.setMode}
        textSpeed={props.textSpeed}
      />
    );
  }

  if (part.type === "tool-getWeather") {
    return (
      <WeatherToolPart
        addToolApprovalResponse={props.addToolApprovalResponse}
        part={part}
      />
    );
  }

  if (part.type === "tool-executeCode") {
    return (
      <CodeExecutionToolPart
        addToolApprovalResponse={props.addToolApprovalResponse}
        part={part}
      />
    );
  }

  if (part.type === "tool-createDocument") {
    return <CreateDocumentToolPart isReadonly={props.isReadonly} part={part} />;
  }

  if (part.type === "tool-updateDocument") {
    return <UpdateDocumentToolPart isReadonly={props.isReadonly} part={part} />;
  }

  if (part.type === "tool-requestSuggestions") {
    return (
      <RequestSuggestionsToolPart isReadonly={props.isReadonly} part={part} />
    );
  }

  if (part.type === "tool-findWebpages" || part.type === "tool-crawlPages") {
    const isBusy =
      part.state === "input-streaming" || part.state === "input-available";
    if (isBusy) {
      return (
        <WebSearchToolBubble
          message={props.message}
          messageKey={messageKey}
          partIndex={props.partIndex}
        />
      );
    }
  }

  if (part.type === "tool-findWebpages" && part.state === "output-available") {
    return (
      <WebSearchResults
        searchQuery={part.output?.searchQuery}
        urls={part.output?.urls || []}
      />
    );
  }

  if (part.type === "dynamic-tool") {
    return (
      <DynamicToolMessagePart
        addToolApprovalResponse={props.addToolApprovalResponse}
        part={part as DynamicToolUIPart}
      />
    );
  }

  if (part.type.startsWith("tool-")) {
    return (
      <GenericStaticToolMessagePart
        addToolApprovalResponse={props.addToolApprovalResponse}
        part={part as unknown as ToolUIPart<ChatTools>}
      />
    );
  }

  return null;
}
