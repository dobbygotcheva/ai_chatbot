"use client";

import { isToday, isYesterday } from "date-fns";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import useSWRInfinite, {
  type SWRInfiniteKeyedMutator,
  unstable_serialize,
} from "swr/infinite";
import {
  type ChatHistory,
  getChatHistoryPaginationKey,
} from "@/components/sidebar-history";
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
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Chat } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { cn, fetcher } from "@/lib/utils";

// Fixed page size for the /history panels. Ten rows is the sweet spot
// between density and keeping the pager visible on a typical laptop
// viewport — previously this was interpolated from the measured panel
// height on mount, but the extra machinery (layout-effect measurement,
// `pageSize === undefined` guard rails in the SWR key and loader) wasn't
// worth the one-row flexibility it bought. If you need to tune density,
// bump this constant.
const HISTORY_PAGE_SIZE = 10;

type HistoryPaginationKey = (
  pageIndex: number,
  previousPageData: ChatHistory | null | undefined
) => string | null;

/**
 * Builds the SWRInfinite pagination key function used by the active and
 * archived panels.
 */
function useHistoryPaginationKey({
  archived,
}: {
  archived: boolean;
}): HistoryPaginationKey {
  return useCallback<HistoryPaginationKey>(
    (pageIndex, previousPageData) => {
      if (previousPageData && previousPageData.hasMore === false) {
        return null;
      }
      const archivedParam = archived ? "archived=true&" : "";
      if (pageIndex === 0) {
        return `/api/history?${archivedParam}limit=${HISTORY_PAGE_SIZE}`;
      }
      const lastChat = previousPageData?.chats.at(-1);
      if (!lastChat) {
        return null;
      }
      return `/api/history?${archivedParam}ending_before=${lastChat.id}&limit=${HISTORY_PAGE_SIZE}`;
    },
    [archived]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared row styles + helpers (kept tiny on purpose so PRs touching action
// behavior never need to edit this section).
// ─────────────────────────────────────────────────────────────────────────────

function getDateLabel(chat: Chat): string {
  const chatDate = new Date(chat.createdAt);
  if (isToday(chatDate)) {
    return "Today";
  }
  if (isYesterday(chatDate)) {
    return "Yesterday";
  }
  return "Previous";
}

function formatDateLabel(chat: Chat): string {
  const chatDate = new Date(chat.createdAt);
  return chatDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const listRowClass =
  "group flex items-center gap-3 rounded-xl border border-border/50 bg-background/60 px-3 py-2 font-medium text-[14px] shadow-sm transition-colors hover:border-border hover:bg-muted/50 dark:border-neutral-700/50 dark:bg-neutral-900/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/60";

// Reduced-size variant of the chat-load row (~25% smaller in padding and
// font) so the three inline action buttons fit alongside it.
const loadRowClass =
  "group flex h-[36px] min-w-0 flex-1 items-center gap-2 rounded-lg border border-border/50 bg-background/60 px-2.5 py-1 font-medium text-[12px] shadow-sm transition-colors hover:border-border hover:bg-muted/50 dark:border-neutral-700/50 dark:bg-neutral-900/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/60";

const actionBtnBase =
  "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/50 bg-background/60 text-muted-foreground shadow-sm outline-none transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 dark:border-neutral-700/50 dark:bg-neutral-900/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/60";

const actionBtnDanger =
  "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/50 bg-background/60 text-muted-foreground shadow-sm outline-none transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive/40 dark:border-neutral-700/50 dark:bg-neutral-900/40";

/**
 * Shared shape passed to each per-action mutation hook.
 *
 * Each action hook lives in its own section below and only depends on this
 * surface — it never reaches into another action's hook. Adding a new action
 * (or modifying an existing one) is therefore confined to a single section
 * and cannot text-conflict with sibling actions during merges.
 */
type MutationDeps = {
  lang: string;
  pages: ChatHistory[] | undefined;
  mutatePages: SWRInfiniteKeyedMutator<ChatHistory[]>;
  mutateCache: ReturnType<typeof useSWRConfig>["mutate"];
};

const ARCHIVED_HISTORY_KEYS = [
  "/api/history?archived=true&limit=100",
  "/api/history?archived=true&limit=50",
] as const;

/**
 * Invalidates every SWR cache entry whose URL targets `/api/history`.
 *
 * Because the /history page's page size is now computed at runtime from the
 * viewport, the pagination key functions it feeds to `useSWRInfinite` are
 * component-scoped and can't be reached via `unstable_serialize(keyFn)`
 * from here. A URL-predicate mutate takes care of every known variant —
 * the sidebar's fixed-size keys, the archived-dialog keys, and the dynamic
 * keys used by ChatHistoryConversationsPanel / ChatHistoryArchivedPanel.
 */
async function revalidateAllHistoryCaches(
  mutateCache: MutationDeps["mutateCache"]
): Promise<void> {
  await Promise.all([
    // SWRInfinite key used by both the /history page panel and the sidebar's
    // unarchive flow.
    mutateCache(unstable_serialize(getChatHistoryPaginationKey)),
    mutateCache(
      (key) => typeof key === "string" && key.startsWith("/api/history?"),
      undefined,
      { revalidate: true }
    ),
    ...ARCHIVED_HISTORY_KEYS.map((key) => mutateCache(key)),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: PAGINATION CONTROLS ──────────────────────────────────────────────
// Reusable Prev/Next pager used by both the conversations and archived
// panels. Prefers the authoritative `totalPages` value returned with the
// first page (computed from the server's total row count); falls back to a
// loaded-so-far "N+" label only when the total is not yet known.
// ─────────────────────────────────────────────────────────────────────────────

function HistoryPaginationControls({
  lang,
  currentPage,
  loadedPages,
  hasMore,
  totalPages,
  isFetching,
  onPrev,
  onNext,
}: {
  lang: string;
  currentPage: number;
  loadedPages: number;
  hasMore: boolean;
  totalPages: number | undefined;
  isFetching: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const canGoPrev = currentPage > 1;
  const canGoNext =
    totalPages === undefined
      ? currentPage < loadedPages || hasMore
      : currentPage < totalPages;
  const totalLabel =
    totalPages === undefined
      ? hasMore
        ? `${loadedPages}+`
        : `${loadedPages}`
      : String(totalPages);

  return (
    <div className="flex items-center justify-between gap-3 border-border/50 border-t pt-4 dark:border-neutral-800">
      <Button
        disabled={!canGoPrev || isFetching}
        onClick={onPrev}
        size="sm"
        type="button"
        variant="outline"
      >
        <ChevronLeft aria-hidden className="mr-1 size-4" />
        {t(lang, "history.previous")}
      </Button>
      <span className="text-muted-foreground text-sm tabular-nums">
        {t(lang, "history.page_of")
          .replace("{current}", String(currentPage))
          .replace("{total}", totalLabel)}
      </span>
      <Button
        disabled={!canGoNext || isFetching}
        onClick={onNext}
        size="sm"
        type="button"
        variant="outline"
      >
        {isFetching ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
        {t(lang, "history.next")}
        <ChevronRight aria-hidden className="ml-1 size-4" />
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: RENAME ACTION ─────────────────────────────────────────────────────
// Owns: PATCH rename mutation, pencil button, inline-edit input wiring.
// Touch this section to change anything about renaming chats from /history.
// ─────────────────────────────────────────────────────────────────────────────

function useRenameMutation({
  lang,
  pages,
  mutatePages,
  mutateCache,
}: MutationDeps) {
  return useCallback(
    async (chatId: string, nextTitle: string) => {
      const trimmed = nextTitle.trim();
      if (!trimmed) {
        return;
      }

      // Optimistic update — flip the title in the local SWR cache so the row
      // doesn't flicker back to the old name while the request is in flight.
      const previousPages = pages;
      mutatePages(
        (current) =>
          current?.map((page) => ({
            ...page,
            chats: page.chats.map((chat) =>
              chat.id === chatId ? { ...chat, title: trimmed } : chat
            ),
          })),
        { revalidate: false }
      );

      try {
        const response = await fetch(`/api/chat?id=${chatId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rename", title: trimmed }),
        });
        if (!response.ok) {
          throw new Error("Rename failed");
        }
        await revalidateAllHistoryCaches(mutateCache);
        toast.success(t(lang, "history.toast_chat_renamed"));
      } catch (error) {
        mutatePages(previousPages, { revalidate: false });
        toast.error(t(lang, "history.toast_rename_failed"));
        throw error;
      }
    },
    [lang, mutateCache, mutatePages, pages]
  );
}

const renameInputClass =
  "h-[36px] min-w-0 flex-1 rounded-lg border border-ring/60 bg-background px-2.5 py-1 font-medium text-[12px] text-foreground shadow-sm outline-none ring-2 ring-ring/30 focus:ring-ring dark:bg-neutral-900 dark:text-neutral-100";

type RenameActionButtonProps = {
  lang: string;
  onClick: () => void;
};

function RenameActionButton({ lang, onClick }: RenameActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={t(lang, "history.action_rename")}
          className={actionBtnBase}
          onClick={onClick}
          type="button"
        >
          <Pencil aria-hidden className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {t(lang, "history.action_rename")}
      </TooltipContent>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: ARCHIVE ACTION ────────────────────────────────────────────────────
// Owns: PATCH archive mutation, archive button.
// Touch this section to change anything about archiving chats from /history.
// ─────────────────────────────────────────────────────────────────────────────

function useArchiveMutation({
  lang,
  pages,
  mutatePages,
  mutateCache,
}: MutationDeps) {
  return useCallback(
    (chatId: string) => {
      // Optimistic remove from the active conversations list — failure
      // restores the previous pages snapshot and surfaces a toast.
      const previousPages = pages;
      mutatePages(
        (current) =>
          current?.map((page) => ({
            ...page,
            chats: page.chats.filter((chat) => chat.id !== chatId),
          })),
        { revalidate: false }
      );

      const archivePromise = fetch(`/api/chat?id=${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });

      toast.promise(archivePromise, {
        loading: t(lang, "history.toast_archiving_chat"),
        success: async (response) => {
          if (!response.ok) {
            throw new Error("Archive failed");
          }
          await revalidateAllHistoryCaches(mutateCache);
          return t(lang, "history.toast_chat_archived");
        },
        error: () => {
          mutatePages(previousPages, { revalidate: false });
          return t(lang, "history.toast_archive_failed");
        },
      });
    },
    [lang, mutateCache, mutatePages, pages]
  );
}

type ArchiveActionButtonProps = {
  lang: string;
  onClick: () => void;
};

function ArchiveActionButton({ lang, onClick }: ArchiveActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={t(lang, "history.action_archive")}
          className={actionBtnBase}
          onClick={onClick}
          type="button"
        >
          <Archive aria-hidden className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {t(lang, "history.action_archive")}
      </TooltipContent>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: REMOVE ACTION ─────────────────────────────────────────────────────
// Owns: DELETE mutation, confirm-dialog state, trash button.
// Touch this section to change anything about deleting chats from /history.
// ─────────────────────────────────────────────────────────────────────────────

type RemoveActionState = {
  pendingId: string | null;
  showDialog: boolean;
  request: (chatId: string) => void;
  cancel: () => void;
  confirm: () => void;
};

function useRemoveAction({
  lang,
  pages,
  mutatePages,
  mutateCache,
}: MutationDeps): RemoveActionState {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const request = useCallback((chatId: string) => {
    setPendingId(chatId);
    setShowDialog(true);
  }, []);

  const cancel = useCallback(() => {
    setShowDialog(false);
    setPendingId(null);
  }, []);

  const confirm = useCallback(() => {
    const chatId = pendingId;
    setShowDialog(false);
    setPendingId(null);
    if (!chatId) {
      return;
    }

    // Optimistic remove from the active conversations list.
    const previousPages = pages;
    mutatePages(
      (current) =>
        current?.map((page) => ({
          ...page,
          chats: page.chats.filter((chat) => chat.id !== chatId),
        })),
      { revalidate: false }
    );

    const deletePromise = fetch(`/api/chat?id=${chatId}`, {
      method: "DELETE",
    }).then((response) => {
      if (!response.ok) {
        throw new Error("Delete failed");
      }
      return response;
    });

    toast.promise(deletePromise, {
      loading: t(lang, "history.toast_deleting_chat"),
      success: async () => {
        await revalidateAllHistoryCaches(mutateCache);
        return t(lang, "history.toast_chat_deleted");
      },
      error: () => {
        // Roll back the optimistic remove — the server rejected the delete
        // (e.g. forbidden, or a transient DB error) so the chat must reappear
        // in the list. Without this restore the row would stay hidden until
        // the next SWR revalidation, masking the failure.
        mutatePages(previousPages, { revalidate: false });
        return t(lang, "history.toast_delete_failed");
      },
    });
  }, [lang, mutateCache, mutatePages, pages, pendingId]);

  return { pendingId, showDialog, request, cancel, confirm };
}

type RemoveActionButtonProps = {
  lang: string;
  onClick: () => void;
};

function RemoveActionButton({ lang, onClick }: RemoveActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={t(lang, "history.action_remove")}
          className={actionBtnDanger}
          onClick={onClick}
          type="button"
        >
          <Trash2 aria-hidden className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {t(lang, "history.action_remove")}
      </TooltipContent>
    </Tooltip>
  );
}

function RemoveConfirmDialog({
  lang,
  open,
  onOpenChange,
  onConfirm,
}: {
  lang: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(lang, "history.delete_confirm_title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(lang, "history.delete_confirm_desc")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t(lang, "history.delete_confirm_cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t(lang, "history.delete_confirm_action")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: ROW COMPOSITION ───────────────────────────────────────────────────
// Renders the chat title (or rename input) and composes the three action
// buttons. Each button only knows about its own callback — adding a new
// action means inserting a sibling component, not editing existing ones.
// ─────────────────────────────────────────────────────────────────────────────

type ConversationRowProps = {
  chat: Chat;
  formattedDate: string;
  lang: string;
  onRename: (chatId: string, nextTitle: string) => Promise<void>;
  onArchive: (chatId: string) => void;
  onRemove: (chatId: string) => void;
};

function ConversationRow({
  chat,
  formattedDate,
  lang,
  onRename,
  onArchive,
  onRemove,
}: ConversationRowProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(chat.title);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const submittingRef = useRef(false);

  // Keep draft in sync with upstream changes (auto-generated titles, etc.)
  // while the row is not actively being edited.
  useEffect(() => {
    if (!isRenaming) {
      setDraftTitle(chat.title);
    }
  }, [chat.title, isRenaming]);

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  const startRenaming = () => {
    submittingRef.current = false;
    setDraftTitle(chat.title);
    setIsRenaming(true);
  };

  const cancelRenaming = () => {
    setDraftTitle(chat.title);
    setIsRenaming(false);
  };

  const submitRename = async () => {
    // Guard against the Enter-then-blur double trigger: when Enter fires we
    // immediately hide the input, but React still dispatches the blur event.
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;

    const next = draftTitle.trim();
    if (!next || next === chat.title) {
      cancelRenaming();
      return;
    }
    setIsRenaming(false);
    try {
      await onRename(chat.id, next);
    } catch {
      // Parent already surfaces a toast; just restore the previous title.
      setDraftTitle(chat.title);
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitRename().catch(() => {
        // Errors already surface via the parent's toast handling.
      });
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelRenaming();
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isRenaming ? (
        <input
          aria-label={t(lang, "history.action_rename")}
          className={renameInputClass}
          maxLength={200}
          onBlur={submitRename}
          onChange={(event) => setDraftTitle(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={t(lang, "history.rename_placeholder")}
          ref={inputRef}
          type="text"
          value={draftTitle}
        />
      ) : (
        <Link
          aria-label={t(lang, "history.action_open")}
          className={loadRowClass}
          href={`/chat/${chat.id}`}
        >
          <MessageSquare
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground"
          />
          <div className="min-w-0 flex-1 overflow-hidden">
            <span className="block truncate text-left">{chat.title}</span>
            <span className="block text-[10px] text-muted-foreground/40 leading-tight">
              {formattedDate}
            </span>
          </div>
          <ChevronRight
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
          />
        </Link>
      )}

      <RenameActionButton lang={lang} onClick={startRenaming} />
      <ArchiveActionButton lang={lang} onClick={() => onArchive(chat.id)} />
      <RemoveActionButton lang={lang} onClick={() => onRemove(chat.id)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: PANELS ────────────────────────────────────────────────────────────
// Top-level panels rendered by /history. They wire SWR data to per-action
// hooks and compose <ConversationRow>. Action implementations live above —
// this section should stay small and avoid embedding action logic.
// ─────────────────────────────────────────────────────────────────────────────

export function ChatHistoryConversationsPanel({ lang }: { lang: string }) {
  const [currentPage, setCurrentPage] = useState(1);
  const paginationKey = useHistoryPaginationKey({ archived: false });
  const {
    data: pages,
    setSize,
    size,
    isValidating,
    isLoading,
    mutate: mutatePages,
  } = useSWRInfinite<ChatHistory>(paginationKey, fetcher, {
    dedupingInterval: 1000,
  });
  const { mutate: mutateCache } = useSWRConfig();

  const deps: MutationDeps = { lang, pages, mutatePages, mutateCache };

  const renameChat = useRenameMutation(deps);
  const archiveChat = useArchiveMutation(deps);
  const remove = useRemoveAction(deps);

  const loadedPages = pages?.length ?? 0;
  const hasMore = pages ? (pages.at(-1)?.hasMore ?? false) : false;
  const isFetchingMore = isValidating && size > loadedPages;

  // `total` is only attached to the first page's response; later cursor
  // pages omit it to avoid running COUNT(*) on every pagination step.
  const total = pages?.[0]?.total;
  const totalPages =
    total === undefined
      ? undefined
      : Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));

  const currentChats = pages?.[currentPage - 1]?.chats ?? [];
  const chatsWithDates = useMemo(
    () =>
      currentChats.map((chat) => ({
        chat,
        dateLabel: getDateLabel(chat),
        formattedDate: formatDateLabel(chat),
      })),
    [currentChats]
  );

  const handlePrev = useCallback(() => {
    setCurrentPage((page) => Math.max(1, page - 1));
  }, []);

  const handleNext = useCallback(async () => {
    if (currentPage < loadedPages) {
      setCurrentPage((page) => page + 1);
      return;
    }
    if (!hasMore) {
      return;
    }
    await setSize((s) => s + 1);
    setCurrentPage((page) => page + 1);
  }, [currentPage, loadedPages, hasMore, setSize]);

  // Keep showing the loader until the first page has actually arrived —
  // otherwise the pager flickers "Page 1 of 1+" for one frame between
  // `isLoading` flipping to false and `pages` being populated on a fresh
  // mount. Relying on `pages` also handles the case where an earlier SWR
  // cache entry (from before `total` was added to the response) is still
  // around: we wait for the in-flight revalidation to replace it before
  // drawing the pager.
  const firstPage = pages?.[0];
  const isInitialLoading =
    !firstPage ||
    (firstPage.total === undefined && (isLoading || isValidating));
  const isEmpty =
    !isInitialLoading &&
    (loadedPages === 0 || (loadedPages === 1 && currentChats.length === 0));

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {isInitialLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <Loader2 className="size-10 animate-spin text-muted-foreground" />
          </div>
        ) : isEmpty ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/80 ring-1 ring-border/50 dark:bg-neutral-900/80">
              <MessageSquare
                aria-hidden
                className="size-7 text-muted-foreground"
              />
            </div>
            <p className="max-w-sm text-muted-foreground text-sm leading-relaxed">
              {t(lang, "history.empty_conversations")}
            </p>
          </div>
        ) : (
          <>
            <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
              {chatsWithDates.map(
                ({ chat, dateLabel, formattedDate }, index) => {
                  const showSeparator =
                    index === 0 ||
                    dateLabel !== chatsWithDates[index - 1]?.dateLabel;

                  return (
                    <li key={chat.id}>
                      {showSeparator && (
                        <div className="mb-2 px-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                          {dateLabel}
                        </div>
                      )}
                      <ConversationRow
                        chat={chat}
                        formattedDate={formattedDate}
                        lang={lang}
                        onArchive={archiveChat}
                        onRemove={remove.request}
                        onRename={renameChat}
                      />
                    </li>
                  );
                }
              )}
            </ul>
            <HistoryPaginationControls
              currentPage={currentPage}
              hasMore={hasMore}
              isFetching={isFetchingMore}
              lang={lang}
              loadedPages={loadedPages}
              onNext={handleNext}
              onPrev={handlePrev}
              totalPages={totalPages}
            />
          </>
        )}
      </div>

      <RemoveConfirmDialog
        lang={lang}
        onConfirm={remove.confirm}
        onOpenChange={(open) => {
          if (!open) {
            remove.cancel();
          }
        }}
        open={remove.showDialog}
      />
    </>
  );
}

export function ChatHistoryArchivedPanel({ lang }: { lang: string }) {
  const { mutate } = useSWRConfig();
  const [currentPage, setCurrentPage] = useState(1);
  const paginationKey = useHistoryPaginationKey({ archived: true });
  const {
    data: pages,
    setSize,
    size,
    isValidating,
    isLoading,
  } = useSWRInfinite<ChatHistory>(paginationKey, fetcher, {
    dedupingInterval: 1000,
  });

  const loadedPages = pages?.length ?? 0;
  const hasMore = pages ? (pages.at(-1)?.hasMore ?? false) : false;
  const isFetchingMore = isValidating && size > loadedPages;

  const total = pages?.[0]?.total;
  const totalPages =
    total === undefined
      ? undefined
      : Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));

  const currentChats = pages?.[currentPage - 1]?.chats ?? [];

  const handlePrev = useCallback(() => {
    setCurrentPage((page) => Math.max(1, page - 1));
  }, []);

  const handleNext = useCallback(async () => {
    if (currentPage < loadedPages) {
      setCurrentPage((page) => page + 1);
      return;
    }
    if (!hasMore) {
      return;
    }
    await setSize((s) => s + 1);
    setCurrentPage((page) => page + 1);
  }, [currentPage, loadedPages, hasMore, setSize]);

  const handleUnarchive = useCallback(
    (chatId: string) => {
      const unarchivePromise = fetch(`/api/chat?id=${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unarchive" }),
      });

      toast.promise(unarchivePromise, {
        loading: t(lang, "sidebar.toast_restoring_chat"),
        success: async () => {
          await Promise.all([
            mutate(unstable_serialize(getChatHistoryPaginationKey)),
            mutate(
              (key) =>
                typeof key === "string" && key.startsWith("/api/history?"),
              undefined,
              { revalidate: true }
            ),
          ]);
          return t(lang, "sidebar.toast_chat_restored");
        },
        error: t(lang, "sidebar.toast_restore_failed"),
      });
    },
    [lang, mutate]
  );

  // Same loader gate as in the active panel: wait for the first page to
  // land (with its authoritative `total`) before painting the pager.
  // Prevents the "Page 1 of N+" flash on first mount and on stale-cache
  // revalidations.
  const firstPage = pages?.[0];
  const isInitialLoading =
    !firstPage ||
    (firstPage.total === undefined && (isLoading || isValidating));
  const isEmpty =
    !isInitialLoading &&
    (loadedPages === 0 || (loadedPages === 1 && currentChats.length === 0));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {isInitialLoading ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="size-10 animate-spin" />
          <span className="text-sm">{t(lang, "sidebar.archived_loading")}</span>
        </div>
      ) : isEmpty ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/80 ring-1 ring-border/50 dark:bg-neutral-900/80">
            <MessageSquare
              aria-hidden
              className="size-7 text-muted-foreground opacity-60"
            />
          </div>
          <p className="max-w-sm text-muted-foreground text-sm leading-relaxed">
            {t(lang, "sidebar.archived_empty")}
          </p>
        </div>
      ) : (
        <>
          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            {currentChats.map((chat: Chat) => (
              <li key={chat.id}>
                <div
                  className={cn(
                    listRowClass,
                    "justify-between gap-2 py-2.5 pr-1 pl-3"
                  )}
                >
                  <Link
                    className="min-w-0 flex-1 truncate font-medium text-[14px] hover:underline"
                    href={`/chat/${chat.id}`}
                  >
                    {chat.title}
                  </Link>
                  <Button
                    className="shrink-0"
                    onClick={() => handleUnarchive(chat.id)}
                    size="sm"
                    title={t(lang, "sidebar.restore_action")}
                    type="button"
                    variant="ghost"
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <HistoryPaginationControls
            currentPage={currentPage}
            hasMore={hasMore}
            isFetching={isFetchingMore}
            lang={lang}
            loadedPages={loadedPages}
            onNext={handleNext}
            onPrev={handlePrev}
            totalPages={totalPages}
          />
        </>
      )}
    </div>
  );
}
