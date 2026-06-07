"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import {
  ChevronDown,
  FileText,
  Mic,
  Pencil,
  Plus,
  Search,
  User,
  X,
  Zap,
} from "lucide-react";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import {
  ConfluenceProductIcon,
  JiraProductIcon,
} from "@/components/atlassian-product-icons";
import { t, tPersonality } from "@/lib/i18n";
import {
  DEFAULT_PERSONALITY,
  PERSONALITY_COOKIE,
  PERSONALITY_OPTIONS,
  type Personality,
} from "@/lib/personality";
import { getScenarioTabKickoffOptionsForActiveTab } from "@/lib/scenario-tab-kickoff";
import { SCENARIO_TABS } from "@/lib/scenario-tabs";
import {
  CHROME_GLASS_INPUT,
  COMPOSER_TOOLBAR,
  SCENARIO_TAB_ACTIVE,
  SCENARIO_TAB_CONTENT,
  SCENARIO_TAB_INACTIVE,
  SCENARIO_TAB_LABEL,
  SCENARIO_TAB_SHELL,
} from "@/lib/scenario-ui";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
} from "./elements/prompt-input";
import { ArrowUpIcon, StopIcon } from "./icons";
import { useLanguage } from "./language-selector";
import { PreviewAttachment } from "./preview-attachment";
import { ScenarioSuggestionChips } from "./scenario-suggestion-chips";
import { TextSpeedSlider } from "./text-speed-slider";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import type { VisibilityType } from "./visibility-selector";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function setCookie(name: string, value: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}`;
}

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

const PROMPT_ENHANCER_ID = "prompt-enhancer" as const;
type PromptEnhancerId = typeof PROMPT_ENHANCER_ID;

type ToolId = (typeof PLUS_MENU_TOOLS)[number]["id"] | PromptEnhancerId;

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  setMessages,
  sendMessage,
  className,
  // biome-ignore lint: Required by interface but not used in this component
  selectedVisibilityType,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  className?: string;
  selectedVisibilityType: VisibilityType;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const { lang } = useLanguage();

  const [activeTools, setActiveTools] = useState<Set<ToolId>>(new Set());
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [personality, setPersonality] =
    useState<Personality>(DEFAULT_PERSONALITY);

  const isStreaming = status === "streaming" || status === "submitted";

  const toggleTool = useCallback((toolId: ToolId) => {
    setActiveTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  }, []);

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, [adjustHeight]);

  const hasAutoFocused = useRef(false);
  useEffect(() => {
    if (!hasAutoFocused.current && width) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
        hasAutoFocused.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [width]);

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustHeight, localStorageInput, setInput]);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);

  const submitForm = useCallback(() => {
    window.history.pushState({}, "", `/chat/${chatId}`);

    sendMessage(
      {
        role: "user",
        parts: [
          ...attachments.map((attachment) => ({
            type: "file" as const,
            url: attachment.url,
            name: attachment.name,
            mediaType: attachment.contentType,
          })),
          {
            type: "text",
            text: input,
          },
        ],
      },
      {
        body: {
          ...(getScenarioTabKickoffOptionsForActiveTab(activeScenario)?.body ??
            {}),
          composerTools: Array.from(activeTools).filter(
            (id) => id !== PROMPT_ENHANCER_ID
          ),
        },
      }
    );

    setAttachments([]);
    setLocalStorageInput("");
    resetHeight();
    setInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    activeTools,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    resetHeight,
    activeScenario,
  ]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;
        return { url, name: pathname, contentType };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (_error) {
      toast.error("Failed to upload file, please try again!");
    }
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch {
        toast.error("Failed to upload files");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith("image/")
      );
      if (imageItems.length === 0) {
        return;
      }

      event.preventDefault();
      setUploadQueue((prev) => [...prev, "Pasted image"]);

      try {
        const uploadPromises = imageItems
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null)
          .map((file) => uploadFile(file));

        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) =>
            attachment !== undefined &&
            attachment.url !== undefined &&
            attachment.contentType !== undefined
        );

        setAttachments((curr) => [
          ...curr,
          ...(successfullyUploadedAttachments as Attachment[]),
        ]);
      } catch {
        toast.error("Failed to upload pasted image(s)");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.addEventListener("paste", handlePaste);
    return () => textarea.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  return (
    <div className={cn("relative flex w-full flex-col gap-0", className)}>
      <input
        aria-label="Upload files"
        className="absolute -z-10 size-0 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        title=""
        type="file"
      />

      {/* Scenario tabs + suggestions — always above the composer */}
      <div className="px-0">
        <div className="grid w-full grid-cols-3 gap-2 pt-2 pb-1.5 sm:grid-cols-6 sm:gap-2.5">
          {SCENARIO_TABS.map((tab) => {
            const isActive = activeScenario === tab.id;
            return (
              <button
                className={cn(
                  SCENARIO_TAB_SHELL,
                  isActive ? SCENARIO_TAB_ACTIVE : SCENARIO_TAB_INACTIVE
                )}
                key={tab.id}
                onClick={() =>
                  setActiveScenario((prev) => (prev === tab.id ? null : tab.id))
                }
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
            );
          })}
        </div>
        <ScenarioSuggestionChips
          activeScenario={activeScenario}
          lang={lang}
          onSelectSuggestion={(text) => {
            const doSend = () => {
              sendMessage(
                { role: "user", parts: [{ type: "text", text }] },
                {
                  body: {
                    ...(getScenarioTabKickoffOptionsForActiveTab(activeScenario)
                      ?.body ?? {}),
                    composerTools: Array.from(activeTools).filter(
                      (id) => id !== PROMPT_ENHANCER_ID
                    ),
                  },
                }
              );
              setInput("");
              setLocalStorageInput("");
              resetHeight();
              window.history.pushState({}, "", `/chat/${chatId}`);
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

      <div className="input-pane flex flex-col gap-2 overflow-visible pt-1.5">
        <PromptInput
          className="relative flex flex-col gap-0 overflow-hidden rounded-3xl border-0 bg-transparent p-0 shadow-none"
          onSubmit={(event) => {
            event.preventDefault();
            if (!input.trim() && attachments.length === 0) {
              return;
            }
            if (status === "ready") {
              submitForm();
            } else {
              toast.error("Please wait for the model to finish its response!");
            }
          }}
        >
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 -z-10",
              CHROME_GLASS_INPUT
            )}
          />
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out",
              attachments.length > 0 || uploadQueue.length > 0
                ? "grid-rows-[1fr]"
                : "grid-rows-[0fr]"
            )}
          >
            <div className="overflow-hidden">
              <div
                className="flex flex-row items-end gap-2 overflow-x-auto pt-0.5 pb-1"
                data-testid="attachments-preview"
              >
                {attachments.map((attachment) => (
                  <PreviewAttachment
                    attachment={attachment}
                    key={attachment.url}
                    onRemove={() => {
                      setAttachments((currentAttachments) =>
                        currentAttachments.filter(
                          (a) => a.url !== attachment.url
                        )
                      );
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  />
                ))}
                {uploadQueue.map((filename) => (
                  <PreviewAttachment
                    attachment={{ url: "", name: filename, contentType: "" }}
                    isUploading
                    key={filename}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Textarea row */}
          <div className="flex min-h-[48px] flex-row items-center gap-0 overflow-visible">
            <PromptInputTextarea
              className="min-h-[48px] min-w-0 flex-1 resize-none border-0 bg-transparent px-4 py-3 text-[15px] text-foreground leading-6 outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:font-extralight placeholder:text-foreground/50 placeholder:tracking-wide focus-visible:ring-0 [&::-webkit-scrollbar]:hidden"
              data-testid="multimodal-input"
              disableAutoResize
              disabled={isStreaming}
              maxHeight={220}
              minHeight={48}
              onChange={handleInput}
              placeholder={t(lang, "chat.placeholder")}
              ref={textareaRef}
              rows={1}
              value={input}
            />
            <div className="flex shrink-0 items-center gap-1 overflow-visible pr-0.5 pl-1">
              {/* Voice-to-text */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="size-9 rounded-xl p-0 text-muted-foreground transition-colors hover:bg-neutral-200/90 hover:text-foreground dark:hover:bg-white/[0.08]"
                    onClick={() => {
                      toast.info(t(lang, "chat.coming_soon"));
                    }}
                    type="button"
                    variant="ghost"
                  >
                    <Mic className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {t(lang, "chat.voice")}
                </TooltipContent>
              </Tooltip>

              {isStreaming ? (
                <StopButton setMessages={setMessages} stop={stop} />
              ) : (
                <PromptInputSubmit
                  className="size-9 rounded-xl bg-primary text-primary-foreground shadow-[0_2px_10px_-2px_rgb(var(--brand-rgb)_/_0.45)] hover:bg-primary/92 hover:shadow-[0_4px_14px_-2px_rgb(var(--brand-rgb)_/_0.5)] disabled:opacity-50"
                  data-testid="send-button"
                  disabled={
                    isStreaming || !input.trim() || uploadQueue.length > 0
                  }
                  status={status}
                >
                  <ArrowUpIcon size={16} />
                </PromptInputSubmit>
              )}
            </div>
          </div>

          {/* Active filter badges — smooth height transition, no layout jump */}
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out",
              activeTools.size > 0 ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}
          >
            <div className="overflow-hidden">
              <div className="flex flex-wrap gap-1.5 border-neutral-100/95 border-t px-3 pt-2 pb-1 dark:border-white/[0.07]">
                {PLUS_MENU_TOOLS.filter((tool) => activeTools.has(tool.id)).map(
                  (tool) => (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 font-medium text-[11px] text-primary"
                      key={tool.id}
                    >
                      <tool.icon className="size-3" />
                      {t(lang, tool.labelKey)}
                      <button
                        className="ml-0.5 cursor-pointer rounded-full p-0.5 transition-colors hover:bg-primary/20"
                        onClick={() => toggleTool(tool.id)}
                        type="button"
                      >
                        <X className="size-2.5" />
                      </button>
                    </span>
                  )
                )}
              </div>
            </div>
          </div>

          <div
            className={cn(
              "flex items-center gap-1.5 rounded-b-3xl px-3 py-2.5",
              COMPOSER_TOOLBAR
            )}
          >
            {/* Plus menu */}
            <DropdownMenu modal={false}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="size-9 rounded-full p-0 text-muted-foreground ring-1 ring-border/40 transition-colors hover:bg-neutral-200/90 hover:text-foreground dark:ring-white/[0.08] dark:hover:bg-white/[0.08]"
                      type="button"
                      variant="ghost"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {t(lang, "chat.attach_tools")}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="start"
                className="will-change-[transform,opacity] data-[state=closed]:duration-100"
                side="top"
                sideOffset={8}
              >
                {PLUS_MENU_TOOLS.map((tool) => (
                  <DropdownMenuItem
                    className={cn(
                      "gap-2 text-foreground focus:text-foreground",
                      activeTools.has(tool.id) &&
                        "bg-primary/15 text-primary focus:text-primary"
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

            {/* Spacer pushes right-side controls to the right */}
            <div className="flex-1" />

            <TextSpeedSlider />

            {/* Prompt Enhancer — lightning + label (no tooltip) */}
            <Button
              className={cn(
                "h-8 shrink-0 gap-1.5 rounded-full px-3 font-medium text-muted-foreground text-xs transition-all",
                activeTools.has(PROMPT_ENHANCER_ID)
                  ? "bg-amber-500/15 text-amber-600 shadow-amber-500/10 shadow-sm hover:bg-amber-500/20 dark:text-amber-400"
                  : "hover:bg-neutral-200/85 hover:text-foreground dark:hover:bg-white/[0.08]"
              )}
              onClick={() => toggleTool(PROMPT_ENHANCER_ID)}
              type="button"
              variant="ghost"
            >
              <Zap
                aria-hidden="true"
                className={cn(
                  "size-3.5 shrink-0 transition-all",
                  activeTools.has(PROMPT_ENHANCER_ID) &&
                    "fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400"
                )}
              />
              <span className="max-w-[9.5rem] truncate sm:max-w-none">
                {t(lang, "tool.prompt_enhancer")}
              </span>
            </Button>

            {/* Personality selector (Default / Professional / Friendly) */}
            <DropdownMenu modal={false}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="h-8 gap-1 rounded-full border border-transparent px-3 font-medium text-muted-foreground text-xs transition-all hover:border-neutral-200/90 hover:bg-white hover:text-foreground dark:hover:border-white/[0.12] dark:hover:bg-white/[0.06]"
                      type="button"
                      variant="ghost"
                    >
                      <User className="size-3.5" />
                      {tPersonality(lang, personality, "label")}
                      <ChevronDown className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {t(lang, "chat.personality")}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                className="min-w-[170px]"
                side="top"
                sideOffset={8}
              >
                {PERSONALITY_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    className={cn(
                      "flex flex-col items-start gap-0 text-foreground text-xs focus:text-foreground",
                      personality === opt.value &&
                        "bg-primary/15 text-primary focus:text-primary"
                    )}
                    key={opt.value}
                    onSelect={() => {
                      setPersonality(opt.value);
                      setCookie(PERSONALITY_COOKIE, opt.value);
                    }}
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
          </div>
        </PromptInput>
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (!equal(prevProps.attachments, nextProps.attachments)) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    return true;
  }
);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  return (
    <Button
      className="size-7 rounded-full bg-foreground p-1 text-background transition-colors duration-200 hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
      data-testid="stop-button"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((msgs) => msgs);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);
