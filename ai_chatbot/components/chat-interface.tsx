"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ChevronDown,
  FileText,
  Globe,
  Mic,
  Pencil,
  Plus,
  Search,
  SendHorizonal,
  Square,
  User,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import {
  ConfluenceProductIcon,
  JiraProductIcon,
} from "@/components/atlassian-product-icons";
import { useLanguage } from "@/components/language-selector";
import { PreviewMessage, ThinkingMessage } from "@/components/message";
import { ScenarioSuggestionChips } from "@/components/scenario-suggestion-chips";
import {
  getChatHistoryPaginationKey,
  SIDEBAR_CHAT_HISTORY_KEY,
} from "@/components/sidebar-history";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMessages } from "@/hooks/use-messages";
import { useTextSpeed } from "@/hooks/use-text-speed";
import {
  estimateContextUsagePercentageFromMessages,
  getContextUsageInfoFromMessageParts,
} from "@/lib/context-usage";
import { ChatSDKError } from "@/lib/errors";
import { t, tPersonality } from "@/lib/i18n";
import { PERSONALITY_OPTIONS, type Personality } from "@/lib/personality";
import { getScenarioTabKickoffOptionsForActiveTab } from "@/lib/scenario-tab-kickoff";
import { SCENARIO_TABS } from "@/lib/scenario-tabs";
import {
  CHROME_GLASS_INPUT,
  CHROME_GLASS_PANEL,
  COMPOSER_TOOLBAR,
  SCENARIO_TAB_ACTIVE,
  SCENARIO_TAB_CONTENT,
  SCENARIO_TAB_INACTIVE,
  SCENARIO_TAB_LABEL,
  SCENARIO_TAB_SHELL,
} from "@/lib/scenario-ui";
import type { ChatMessage } from "@/lib/types";
import {
  assistantMessageHasVisibleActivity,
  cn,
  fetchWithErrorHandlers,
  generateUUID,
  shouldHideAssistantStreamingPlaceholder,
} from "@/lib/utils";
import { TextSpeedSlider } from "./text-speed-slider";

const PLUS_MENU_TOOLS = [
  { id: "upload", labelKey: "tool.upload" as const, icon: FileText },
  { id: "image", labelKey: "tool.image" as const, icon: Pencil },
  { id: "deep-search", labelKey: "tool.deep_search" as const, icon: Search },
  { id: "jira", labelKey: "tool.jira" as const, icon: JiraProductIcon },
  {
    id: "confluence",
    labelKey: "tool.confluence" as const,
    icon: ConfluenceProductIcon,
  },
] as const;

function isValidChatMessages(
  data: unknown
): data is { messages: ChatMessage[] } {
  return (
    typeof data === "object" &&
    data !== null &&
    "messages" in data &&
    Array.isArray(data.messages) &&
    data.messages.every(
      (msg) =>
        typeof msg === "object" &&
        msg !== null &&
        "id" in msg &&
        "role" in msg &&
        "parts" in msg
    )
  );
}

interface ChatInterfaceProps {
  initialMessages?: ChatMessage[];
  embedInPortal?: boolean;
  isEmpty?: boolean;
}

export function ChatInterface({
  initialMessages = [],
  embedInPortal: _embedInPortal,
  isEmpty: _isEmpty,
}: ChatInterfaceProps) {
  const { lang } = useLanguage();
  const { mutate } = useSWRConfig();
  const historyRevalidatedForTurnRef = useRef(false);
  const [chatId, setChatId] = useState(() => generateUUID());

  useEffect(() => {
    historyRevalidatedForTurnRef.current = false;
  }, []);

  const [isHistoryChat, setIsHistoryChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [activeTools, setActiveTools] = useState<Set<string>>(new Set());
  const [promptEnhancer, setPromptEnhancer] = useState(false);
  const [personality, setPersonality] = useState<Personality>("default");
  const { delay } = useTextSpeed();
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        credentials: "include",
        fetch: fetchWithErrorHandlers,
        prepareSendMessagesRequest(request) {
          const lastMessage = request.messages.at(-1);
          const merged =
            typeof request.body === "object" && request.body !== null
              ? (request.body as Record<string, unknown>)
              : {};
          const { messages: _omitMessagesFromBody, ...mergedRest } = merged;
          const body: Record<string, unknown> = {
            ...mergedRest,
            id: request.id,
            message: lastMessage,
            selectedChatModel: "foundation",
            selectedVisibilityType: "private",
          };
          return { body };
        },
      }),
    []
  );

  const {
    messages: rawMessages,
    sendMessage,
    status,
    stop,
    setMessages,
    regenerate,
    addToolApprovalResponse,
  } = useChat<ChatMessage>({
    id: chatId,
    messages: initialMessages,
    generateId: generateUUID,
    transport,
    onData: (dataPart) => {
      if (!historyRevalidatedForTurnRef.current) {
        historyRevalidatedForTurnRef.current = true;
        mutate(unstable_serialize(getChatHistoryPaginationKey));
        mutate(SIDEBAR_CHAT_HISTORY_KEY);
      }
      if (
        typeof dataPart === "object" &&
        dataPart !== null &&
        "type" in dataPart &&
        dataPart.type === "data-chat-title"
      ) {
        const rawTitle = (dataPart as { data?: unknown }).data;
        if (typeof rawTitle === "string" && rawTitle.trim().length > 0) {
          document.title = `Destiny - ${rawTitle.trim()}`;
        }
        mutate(unstable_serialize(getChatHistoryPaginationKey));
      }
    },
    onFinish: () => {
      historyRevalidatedForTurnRef.current = false;
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      historyRevalidatedForTurnRef.current = false;
      if (error instanceof ChatSDKError) {
        const detail =
          typeof error.cause === "string" && error.cause.length > 0
            ? error.cause
            : error.message;
        toast.error(detail);
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Something went wrong.");
      }
    },
  });

  const { containerRef: messagesContainerRef, endRef: messagesEndRef } =
    useMessages({ status });

  const messages = useMemo(() => {
    const seen = new Map<string, (typeof rawMessages)[number]>();
    for (const msg of rawMessages) {
      if (!seen.has(msg.id)) {
        seen.set(msg.id, msg);
      }
    }
    return Array.from(seen.values());
  }, [rawMessages]);

  const hasMessages = messages.length > 0;
  const isStreaming = status === "streaming" || status === "submitted";
  const isTokenStreaming = status === "streaming";

  const lastAssistantInfo = useMemo(() => {
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") {
        lastAssistantIdx = i;
        break;
      }
    }

    const lastAssistant =
      lastAssistantIdx === -1 ? undefined : messages.at(lastAssistantIdx);
    const lastAssistantId = lastAssistant?.id ?? null;

    const lastAssistantContextUsageInfo = lastAssistant
      ? getContextUsageInfoFromMessageParts(lastAssistant)
      : {
          contextPercentage: null,
          hasAnyContextUsage: false,
          hasFinalContextUsage: false,
          contextUsagePartsCount: 0,
        };

    return {
      lastAssistantIdx,
      lastAssistantId,
      lastAssistantContextUsageInfo,
    };
  }, [messages]);

  const { lastAssistantIdx, lastAssistantId, lastAssistantContextUsageInfo } =
    lastAssistantInfo;

  const shouldShowContextChip =
    lastAssistantContextUsageInfo.hasFinalContextUsage || !isTokenStreaming;

  const lastAssistantContextPercentage =
    lastAssistantContextUsageInfo.contextPercentage ??
    (shouldShowContextChip
      ? estimateContextUsagePercentageFromMessages(messages, lastAssistantIdx)
      : null);

  const contextPercentageToShow = shouldShowContextChip
    ? lastAssistantContextPercentage
    : null;

  const portalScrollSyncKey = useMemo(() => {
    const last = messages.at(-1);
    if (!last) {
      return `empty:${messages.length}`;
    }
    let textLen = 0;
    for (const part of last.parts ?? []) {
      if (part.type === "text" && "text" in part) {
        textLen += (part as { text: string }).text.length;
      }
      if (part.type === "reasoning" && "text" in part) {
        textLen += (part as { text: string }).text.length;
      }
    }
    return `${last.id}:${textLen}:${messages.length}`;
  }, [messages]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: setMessages from useChat is stable
  useEffect(() => {
    if (!isHistoryChat) {
      return;
    }
    const abortController = new AbortController();
    fetch(`/api/chat?id=${chatId}`, { signal: abortController.signal })
      .then((res) => res.json())
      .then((data: unknown) => {
        if (isValidChatMessages(data)) {
          setMessages(data.messages);
          const rawTitle = (data as { title?: unknown }).title;
          if (typeof rawTitle === "string" && rawTitle.trim().length > 0) {
            document.title = `Destiny - ${rawTitle.trim()}`;
          }
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          toast.error("Failed to load chat history");
        }
      });
    return () => abortController.abort();
  }, [chatId, isHistoryChat]);

  useEffect(() => {
    const handleNewChat = () => {
      setMessages([]);
      setChatId(generateUUID());
      setIsHistoryChat(false);
      setChatInput("");
      setActiveScenario(null);
      document.title = "Destiny - New conversation";
    };
    window.addEventListener("portal-new-chat", handleNewChat);
    return () => window.removeEventListener("portal-new-chat", handleNewChat);
  }, [setMessages]);

  useEffect(() => {
    const handleLoadChat = (e: Event) => {
      const { chatId: id } = (e as CustomEvent<{ chatId: string }>).detail;
      setChatId(id);
      setIsHistoryChat(true);
      setChatInput("");
      setActiveScenario(null);
      window.history.replaceState({}, "", `/chat/${id}`);
    };
    window.addEventListener("portal-load-chat", handleLoadChat);
    return () => window.removeEventListener("portal-load-chat", handleLoadChat);
  }, []);

  const toggleTool = (id: string) =>
    setActiveTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const submitChat = () => {
    if (status !== "ready") {
      return;
    }
    const trimmed = chatInput.trim();
    if (!trimmed) {
      return;
    }
    sendMessage(
      {
        role: "user" as const,
        parts: [{ type: "text", text: trimmed }],
      },
      {
        body: {
          ...(getScenarioTabKickoffOptionsForActiveTab(activeScenario)?.body ??
            {}),
          composerTools: Array.from(activeTools),
        },
      }
    );
    setChatInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    window.history.replaceState({}, "", `/chat/${chatId}`);
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden dark:bg-background">
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1">
          <div
            className="absolute inset-0 overflow-y-auto"
            ref={messagesContainerRef}
          >
            <div className="mx-auto max-w-4xl px-4 md:px-6">
              <AnimatePresence>
                {!hasMessages && (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="flex min-h-[calc(100%-2rem)] flex-col items-center justify-center py-10"
                    exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
                    initial={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="mx-auto flex w-full max-w-4xl flex-col space-y-4">
                      <div className="flex w-full flex-row items-stretch gap-4 px-4 md:gap-6 md:px-5">
                        <div className="relative -ml-4 flex shrink-0 items-center self-stretch">
                          <div className="size-20 overflow-hidden rounded-full bg-black md:size-24">
                            {/* biome-ignore lint: using static image asset */}
                            <img
                              alt="Destiny"
                              className="size-full object-cover object-center"
                              src="/images/destiny-avatar.png"
                            />
                          </div>
                          <span
                            aria-hidden
                            className="absolute right-1 bottom-1 size-3.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.65)] ring-2 ring-background dark:bg-emerald-400"
                          />
                        </div>
                        <div className="grid w-full min-w-0 flex-1 content-center gap-1.5 text-start">
                          <h1 className="m-0 w-full min-w-0 p-0 font-semibold text-3xl text-foreground leading-none md:text-4xl dark:text-white">
                            {t(lang, "portal.destiny.name")}
                          </h1>
                          <p className="m-0 w-full min-w-0 max-w-[20rem] font-medium text-[13px] text-foreground/78 uppercase leading-snug dark:text-white/78">
                            <span className="inline-block w-full pl-0.5 text-start tracking-[0.14em]">
                              {t(lang, "portal.destiny.description_short")}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div
                        className={cn(
                          "w-full rounded-xl px-4 py-4 md:px-5",
                          CHROME_GLASS_PANEL
                        )}
                      >
                        <div className="flex flex-col gap-3.5 md:gap-4">
                          <div className="flex items-center gap-3 text-foreground/90 text-sm leading-relaxed dark:text-white/88">
                            <div
                              aria-hidden
                              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/52 ring-1 ring-border/45 dark:bg-white/[0.08] dark:ring-white/[0.11]"
                            >
                              <AlertCircle
                                className="size-4 text-foreground/82 dark:text-white/82"
                                strokeWidth={2}
                              />
                            </div>
                            <p className="m-0 min-w-0 flex-1">
                              {t(lang, "chat.compliance1")}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-foreground/90 text-sm leading-relaxed dark:text-white/88">
                            <div
                              aria-hidden
                              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/52 ring-1 ring-border/45 dark:bg-white/[0.08] dark:ring-white/[0.11]"
                            >
                              <Globe
                                className="size-4 text-foreground/82 dark:text-white/82"
                                strokeWidth={2}
                              />
                            </div>
                            <p className="m-0 min-w-0 flex-1">
                              {t(lang, "chat.compliance2")}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-foreground/90 text-sm leading-relaxed dark:text-white/88">
                            <div
                              aria-hidden
                              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/52 ring-1 ring-border/45 dark:bg-white/[0.08] dark:ring-white/[0.11]"
                            >
                              <Zap
                                className="size-4 text-foreground/82 dark:text-white/82"
                                strokeWidth={2}
                              />
                            </div>
                            <p className="m-0 min-w-0 flex-1">
                              {t(lang, "chat.compliance3")}{" "}
                              <Link
                                aria-label={t(
                                  lang,
                                  "chat.compliance3_link_aria_confluence"
                                )}
                                className="font-medium text-foreground/92 underline underline-offset-2 transition-colors hover:text-foreground dark:text-white/90"
                                href="/settings?section=Apps"
                              >
                                {t(lang, "chat.terms")}
                              </Link>
                              {", "}
                              <Link
                                aria-label={t(
                                  lang,
                                  "chat.compliance3_link_aria_jira"
                                )}
                                className="font-medium text-foreground/92 underline underline-offset-2 transition-colors hover:text-foreground dark:text-white/90"
                                href="/settings?section=Apps"
                              >
                                {t(lang, "chat.and")}
                              </Link>
                              {t(lang, "chat.compliance3_before_last_link")}
                              <Link
                                aria-label={t(
                                  lang,
                                  "chat.compliance3_link_aria_service_desk"
                                )}
                                className="font-medium text-foreground/92 underline underline-offset-2 transition-colors hover:text-foreground dark:text-white/90"
                                href="/settings?section=Apps"
                              >
                                {t(lang, "chat.privacy")}
                              </Link>
                              {t(lang, "chat.compliance3_sentence_end")}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="py-4">
                {messages.map((msg) => {
                  const isLastMessage = messages.at(-1)?.id === msg.id;
                  const isLastAssistantMessage =
                    msg.role === "assistant" && msg.id === lastAssistantId;
                  if (
                    shouldHideAssistantStreamingPlaceholder(
                      msg,
                      status,
                      isLastMessage
                    )
                  ) {
                    return null;
                  }
                  return (
                    <div className="mb-5" key={msg.id}>
                      <PreviewMessage
                        addToolApprovalResponse={addToolApprovalResponse}
                        chatId={chatId}
                        contextPercentage={
                          isLastAssistantMessage
                            ? contextPercentageToShow
                            : null
                        }
                        isLoading={
                          isTokenStreaming &&
                          (isLastAssistantMessage
                            ? !lastAssistantContextUsageInfo.hasFinalContextUsage
                            : isLastMessage)
                        }
                        isReadonly={false}
                        isStreaming={
                          status === "streaming" && msg.id === lastAssistantId
                        }
                        message={msg}
                        regenerate={regenerate}
                        requiresScrollPadding={false}
                        setMessages={setMessages}
                        textSpeed={delay}
                        vote={undefined}
                      />
                    </div>
                  );
                })}
                {(status === "submitted" ||
                  (status === "streaming" &&
                    (() => {
                      const last = messages.at(-1);
                      return (
                        last?.role !== "assistant" ||
                        !assistantMessageHasVisibleActivity(last)
                      );
                    })())) &&
                  !messages.some((msg) =>
                    msg.parts?.some(
                      (part) =>
                        part != null &&
                        "state" in part &&
                        part.state === "approval-responded"
                    )
                  ) && (
                    <div className="mb-5">
                      <ThinkingMessage />
                    </div>
                  )}
                <div
                  data-portal-scroll-sync={portalScrollSyncKey}
                  ref={messagesEndRef}
                />
              </div>
              <div
                aria-hidden="true"
                className={cn(
                  "w-full shrink-0 transition-[height] duration-200 ease-out",
                  activeScenario ? "h-56 sm:h-52" : "h-20 sm:h-16"
                )}
              />
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto w-full max-w-4xl px-4 md:px-4">
            <div className="pointer-events-auto grid w-full grid-cols-3 gap-2 pt-2 pb-1.5 sm:grid-cols-6 sm:gap-2.5">
              {SCENARIO_TABS.map((tab) => (
                <button
                  className={cn(
                    SCENARIO_TAB_SHELL,
                    activeScenario === tab.id
                      ? SCENARIO_TAB_ACTIVE
                      : SCENARIO_TAB_INACTIVE
                  )}
                  key={tab.id}
                  onClick={() => {
                    if (activeScenario === tab.id) {
                      setActiveScenario(null);
                      return;
                    }
                    setActiveScenario(tab.id);
                  }}
                  type="button"
                >
                  <span className={SCENARIO_TAB_CONTENT}>
                    <tab.icon
                      aria-hidden="true"
                      className="size-4 shrink-0 opacity-[0.92]"
                    />
                    <span className={SCENARIO_TAB_LABEL}>
                      {t(lang, tab.labelKey)}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div className="pointer-events-auto">
              <ScenarioSuggestionChips
                activeScenario={activeScenario}
                lang={lang}
                onSelectSuggestion={(text) => {
                  const doSend = () => {
                    sendMessage(
                      {
                        role: "user" as const,
                        parts: [{ type: "text", text }],
                      },
                      {
                        body: {
                          composerTools: Array.from(activeTools),
                        },
                      }
                    );
                    setChatInput("");
                    if (textareaRef.current) {
                      textareaRef.current.style.height = "auto";
                    }
                    window.history.replaceState({}, "", `/chat/${chatId}`);
                  };
                  if (isStreaming) {
                    stop();
                    setTimeout(doSend, 60);
                  } else {
                    doSend();
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-4xl shrink-0 px-4 pt-1.5 pb-4 md:px-4">
          <form
            className="group relative overflow-hidden rounded-3xl transition-[box-shadow] duration-300 ease-out will-change-transform focus-within:shadow-[0_8px_40px_-14px_rgba(0,0,0,0.14)] focus-within:ring-2 focus-within:ring-primary/25 dark:focus-within:shadow-[0_14px_48px_-18px_rgba(0,0,0,0.55)] dark:focus-within:ring-primary/35"
            data-portal-composer=""
            onSubmit={(e) => {
              e.preventDefault();
              submitChat();
            }}
          >
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 -z-10",
                CHROME_GLASS_INPUT
              )}
            />
            <div className="flex items-start gap-3 px-5 pt-4 pb-2">
              <textarea
                className="min-h-[52px] flex-1 resize-none bg-transparent py-1 text-[15px] text-foreground/90 leading-relaxed outline-none [-ms-overflow-style:none] [scrollbar-width:none] placeholder:font-extralight placeholder:text-foreground/50 placeholder:tracking-wide [&::-webkit-scrollbar]:hidden"
                data-testid="multimodal-input"
                disabled={isStreaming}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitChat();
                  }
                }}
                placeholder={t(lang, "chat.placeholder")}
                ref={textareaRef}
                rows={1}
                value={chatInput}
              />
            </div>

            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out",
                activeTools.size > 0 ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="overflow-hidden">
                <div className="flex flex-wrap gap-1.5 border-neutral-100/95 border-t px-4 pt-2 pb-1 dark:border-white/[0.07]">
                  {[...PLUS_MENU_TOOLS]
                    .filter((tool) => activeTools.has(tool.id))
                    .map((tool) => (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.08] px-2.5 py-1 font-medium text-[11px] text-foreground/70 dark:bg-white/[0.10] dark:text-white/70"
                        key={tool.id}
                      >
                        <tool.icon className="size-3" />
                        {t(lang, tool.labelKey)}
                        <button
                          aria-label={`${t(lang, "chat.remove")} ${t(lang, tool.labelKey)}`}
                          className="ml-0.5 cursor-pointer rounded-full p-0.5 transition-colors hover:bg-primary/20"
                          onClick={() => toggleTool(tool.id)}
                          type="button"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                </div>
              </div>
            </div>

            <div
              className={cn(
                "flex items-center gap-1.5 rounded-b-3xl px-3 py-2.5 will-change-transform",
                COMPOSER_TOOLBAR
              )}
            >
              <input
                aria-label={t(lang, "chat.upload_files_aria")}
                className="absolute -z-10 size-0 opacity-0"
                multiple
                onChange={() => {
                  // Intentionally empty - file handling is done via ref
                }}
                ref={fileInputRef}
                tabIndex={-1}
                title=""
                type="file"
              />

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={t(lang, "chat.attach_tools")}
                    className="flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground ring-1 ring-border/40 transition-colors hover:bg-neutral-200/90 hover:text-foreground dark:ring-white/[0.08] dark:hover:bg-white/[0.08] dark:hover:text-neutral-100"
                    type="button"
                  >
                    <Plus className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="will-change-[transform,opacity] data-[state=closed]:duration-100"
                  side="top"
                  sideOffset={8}
                >
                  {PLUS_MENU_TOOLS.map((tool) => (
                    <DropdownMenuItem
                      className={cn(
                        "gap-2",
                        activeTools.has(tool.id) && "bg-primary/15 text-primary"
                      )}
                      key={tool.id}
                      onSelect={() => {
                        if (tool.id === "upload") {
                          fileInputRef.current?.click();
                        } else {
                          toggleTool(tool.id);
                        }
                      }}
                    >
                      <tool.icon className="size-4" />
                      {t(lang, tool.labelKey)}
                      {activeTools.has(tool.id) && (
                        <span className="ml-auto font-bold text-[10px] text-primary">
                          {t(lang, "chat.tool_on")}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex-1" />

              <TextSpeedSlider />

              <button
                className={cn(
                  "flex h-8 max-w-[min(100%,11rem)] cursor-pointer items-center gap-1.5 rounded-full px-3 font-medium text-muted-foreground text-xs transition-all sm:max-w-none",
                  promptEnhancer
                    ? "bg-primary/12 text-primary shadow-primary/10 shadow-sm dark:bg-primary/18 dark:text-primary"
                    : "hover:bg-neutral-200/80 hover:text-foreground dark:hover:bg-white/[0.08]"
                )}
                onClick={() => setPromptEnhancer((p) => !p)}
                type="button"
              >
                <Zap
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 shrink-0",
                    promptEnhancer &&
                      "fill-primary text-primary dark:fill-primary dark:text-primary"
                  )}
                />
                <span className="truncate">
                  {t(lang, "tool.prompt_enhancer")}
                </span>
              </button>

              <DropdownMenu modal={false}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button
                        aria-label={t(lang, "chat.personality")}
                        className="flex h-8 min-w-[90px] cursor-pointer items-center gap-1 rounded-full border border-transparent px-3 font-medium text-muted-foreground text-xs transition-all hover:border-neutral-200/90 hover:bg-white hover:text-foreground dark:hover:border-white/[0.12] dark:hover:bg-white/[0.06]"
                        type="button"
                      >
                        <User className="size-3.5 shrink-0" />
                        <span className="truncate">
                          {tPersonality(lang, personality, "label")}
                        </span>
                        <ChevronDown className="size-3 shrink-0" />
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8}>
                    {t(lang, "chat.personality")}
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[170px] will-change-[transform,opacity] data-[state=closed]:duration-100"
                  side="top"
                  sideOffset={8}
                >
                  {PERSONALITY_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      className={cn(
                        "flex flex-col items-start gap-0 text-xs",
                        personality === opt.value &&
                          "bg-primary/15 text-primary"
                      )}
                      key={opt.value}
                      onSelect={() => setPersonality(opt.value)}
                    >
                      <span className="font-medium">
                        {tPersonality(lang, opt.value, "label")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {tPersonality(lang, opt.value, "description")}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex size-9 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-neutral-200/90 hover:text-foreground dark:hover:bg-white/[0.08]"
                    onClick={() => toast.info(t(lang, "chat.coming_soon"))}
                    type="button"
                  >
                    <Mic className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {t(lang, "chat.voice")}
                </TooltipContent>
              </Tooltip>

              {isStreaming ? (
                <button
                  className="flex size-9 cursor-pointer items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/92"
                  data-testid="stop-button"
                  onClick={() => stop()}
                  type="button"
                >
                  <Square className="size-3.5 fill-current" />
                </button>
              ) : (
                <button
                  className="flex size-9 cursor-pointer items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/92 disabled:cursor-not-allowed disabled:opacity-40"
                  data-testid="send-button"
                  disabled={isStreaming || !chatInput.trim()}
                  type="submit"
                >
                  <SendHorizonal className="size-3.5" />
                </button>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
