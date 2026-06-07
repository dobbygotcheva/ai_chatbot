"use client";

import { isToday, isYesterday } from "date-fns";
import { motion } from "framer-motion";
import { Archive, ChevronRight, RotateCcw } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import useSWRInfinite from "swr/infinite";
import { useLanguage } from "@/components/language-selector";
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
import {
  SidebarGroup,
  SidebarGroupContent,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Chat } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import {
  archivedTitleRowClass,
  getSidebarArchivedSectionPortalPalette,
  getSidebarHistoryPortalPalette,
} from "@/lib/sidebar-portal-classes";
import { cn, fetcher } from "@/lib/utils";
import { LoaderIcon } from "./icons";
import { ChatItem } from "./sidebar-history-item";

export type ChatHistory = {
  chats: Chat[];
  hasMore: boolean;
  /**
   * Total number of rows matching this feed (active or archived) for the
   * current user. Only populated on the first, cursor-less page — subsequent
   * pages reuse the value cached on page 1.
   */
  total?: number;
};

const SIDEBAR_CHAT_LIMIT = 6;
export const SIDEBAR_CHAT_HISTORY_KEY = `/api/history?limit=${SIDEBAR_CHAT_LIMIT}`;

type GroupedChats = {
  today: Chat[];
  yesterday: Chat[];
  previous: Chat[];
};

const groupChatsByDate = (chats: Chat[]): GroupedChats => {
  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else {
        groups.previous.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      previous: [],
    } as GroupedChats
  );
};

export function createChatHistoryPaginationKey(pageSize: number) {
  return (
    pageIndex: number,
    previousPageData: ChatHistory | null | undefined
  ) => {
    if (previousPageData && previousPageData.hasMore === false) {
      return null;
    }

    if (pageIndex === 0) {
      return `/api/history?limit=${pageSize}`;
    }

    const firstChatFromPage = previousPageData?.chats.at(-1);

    if (!firstChatFromPage) {
      return null;
    }

    return `/api/history?ending_before=${firstChatFromPage.id}&limit=${pageSize}`;
  };
}

export const getChatHistoryPaginationKey =
  createChatHistoryPaginationKey(SIDEBAR_CHAT_LIMIT);

export function SidebarHistory({
  user,
  onClosePanel,
  portal = false,
}: {
  user: User | undefined;
  onClosePanel?: () => void;
  portal?: boolean;
}) {
  const { lang } = useLanguage();
  const { setOpenMobile } = useSidebar();
  const closePanel = onClosePanel
    ? (_open: boolean) => {
        onClosePanel();
      }
    : setOpenMobile;
  const pathname = usePathname();
  const id = pathname?.startsWith("/chat/") ? pathname.split("/")[2] : null;

  const sp = getSidebarHistoryPortalPalette(portal);

  const {
    data: allChatsData,
    isValidating,
    isLoading,
    mutate: mutateHistory,
  } = useSWR<ChatHistory>(user ? SIDEBAR_CHAT_HISTORY_KEY : null, fetcher, {
    dedupingInterval: 1000,
    revalidateIfStale: false,
  });
  const { mutate: mutateCache } = useSWRConfig();

  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const hasEmptyChatHistory =
    !isLoading && (!allChatsData || allChatsData.chats.length === 0);

  const handleDelete = () => {
    const chatToDelete = deleteId;
    const isCurrentChat = pathname === `/chat/${chatToDelete}`;

    setShowDeleteDialog(false);

    const deletePromise = fetch(`/api/chat?id=${chatToDelete}`, {
      method: "DELETE",
    });

    toast.promise(deletePromise, {
      loading: "Deleting chat...",
      success: () => {
        mutateHistory(
          (chatHistory) => {
            if (chatHistory) {
              return {
                ...chatHistory,
                chats: chatHistory.chats.filter(
                  (chat) => chat.id !== chatToDelete
                ),
              };
            }
          },
          { revalidate: false }
        );

        if (isCurrentChat) {
          router.replace("/");
          router.refresh();
        }

        return "Chat deleted successfully";
      },
      error: "Failed to delete chat",
    });
  };

  const handleArchive = (chatId: string) => {
    const isCurrentChat = pathname === `/chat/${chatId}`;
    const archivePromise = fetch(`/api/chat?id=${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });

    toast.promise(archivePromise, {
      loading: t(lang, "sidebar.toast_archiving_chat"),
      success: async () => {
        await Promise.all([
          mutateHistory(
            (chatHistory) => {
              if (chatHistory) {
                return {
                  ...chatHistory,
                  chats: chatHistory.chats.filter((chat) => chat.id !== chatId),
                };
              }
            },
            { revalidate: false }
          ),
          mutateCache("/api/history?archived=true&limit=50"),
          mutateCache("/api/history?archived=true&limit=100"),
        ]);

        if (isCurrentChat) {
          router.replace("/");
          router.refresh();
        }

        return t(lang, "sidebar.toast_chat_archived");
      },
      error: t(lang, "sidebar.toast_archive_failed"),
    });
  };

  if (!user) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className={sp.prompt}>
            Login to save and revisit previous chats!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (isLoading) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="mb-2 flex flex-col gap-1.5 px-2">
            {[1, 2, 3].map((key) => (
              <div
                className="h-7 rounded-lg bg-sidebar-accent-foreground/10"
                key={key}
              />
            ))}
          </div>
          <div className="flex flex-col">
            {[44, 32, 28, 64, 52].map((item) => (
              <div
                className="flex h-8 items-center gap-2 rounded-md px-2"
                key={item}
              >
                <div
                  className={`h-4 max-w-(--skeleton-width) flex-1 rounded-md bg-sidebar-accent-foreground/10 skeleton-width-${item}`}
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (hasEmptyChatHistory) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className={sp.prompt}>
            Your conversations will appear here once you start chatting!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  const groupedChats = groupChatsByDate(allChatsData?.chats ?? []);

  const handleDeleteClick = (chatId: string) => {
    setDeleteId(chatId);
    setShowDeleteDialog(true);
  };

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <div
            className="sidebar-chat-list flex flex-col gap-1"
            id="sidebar-chat-list"
          >
            {groupedChats.today.length > 0 && (
              <div>
                <div className={cn(sp.sectionLabel, "mb-1 px-2")}>TODAY</div>
                <div className="flex flex-col gap-1">
                  {groupedChats.today.map((chat) => (
                    <ChatItem
                      chat={chat}
                      isActive={chat.id === id}
                      key={chat.id}
                      onArchive={handleArchive}
                      onDelete={handleDeleteClick}
                      portal={portal}
                      setOpenMobile={closePanel}
                    />
                  ))}
                </div>
              </div>
            )}

            {groupedChats.yesterday.length > 0 && (
              <div>
                <div className={cn(sp.sectionLabel, "mb-1 px-2")}>
                  YESTERDAY
                </div>
                <div className="flex flex-col gap-1">
                  {groupedChats.yesterday.map((chat) => (
                    <ChatItem
                      chat={chat}
                      isActive={chat.id === id}
                      key={chat.id}
                      onArchive={handleArchive}
                      onDelete={handleDeleteClick}
                      portal={portal}
                      setOpenMobile={closePanel}
                    />
                  ))}
                </div>
              </div>
            )}

            {groupedChats.previous.length > 0 && (
              <div>
                <div className={cn(sp.sectionLabel, "mb-1 px-2")}>
                  PREVIOUS DAYS
                </div>
                <div className="flex flex-col gap-1">
                  {groupedChats.previous.map((chat) => (
                    <ChatItem
                      chat={chat}
                      isActive={chat.id === id}
                      key={chat.id}
                      onArchive={handleArchive}
                      onDelete={handleDeleteClick}
                      portal={portal}
                      setOpenMobile={closePanel}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {isValidating && (
            <div className={sp.loadingMore}>
              <div className="animate-spin">
                <LoaderIcon />
              </div>
              <span>Loading…</span>
            </div>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              chat and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Standalone Archived section — render outside the scroll area */
export function SidebarArchivedSection({
  user,
  onClosePanel,
  portal = false,
}: {
  user: User | undefined;
  onClosePanel?: () => void;
  portal?: boolean;
}) {
  const { lang } = useLanguage();
  const { setOpenMobile } = useSidebar();
  const closePanel = onClosePanel
    ? (_open: boolean) => {
        onClosePanel();
      }
    : setOpenMobile;

  const pathname = usePathname();
  const id = pathname?.startsWith("/chat/") ? pathname.split("/")[2] : null;

  const [showArchived, setShowArchived] = useState(false);

  const {
    data: archivedData,
    isLoading: archivedLoading,
    mutate: mutateArchived,
  } = useSWR<ChatHistory>(
    showArchived && user ? "/api/history?archived=true&limit=50" : null,
    fetcher
  );

  const { mutate } = useSWRInfinite<ChatHistory>(
    getChatHistoryPaginationKey,
    fetcher,
    {
      fallbackData: [],
      dedupingInterval: 1000,
    }
  );

  const handleUnarchive = useCallback(
    (chatId: string) => {
      const unarchivePromise = fetch(`/api/chat?id=${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unarchive" }),
      });
      toast.promise(unarchivePromise, {
        loading: t(lang, "sidebar.toast_restoring_chat"),
        success: () => {
          mutateArchived();
          mutate();
          return t(lang, "sidebar.toast_chat_restored");
        },
        error: t(lang, "sidebar.toast_restore_failed"),
      });
    },
    [lang, mutate, mutateArchived]
  );

  const ap = getSidebarArchivedSectionPortalPalette(portal);

  if (!user) {
    return null;
  }

  return (
    <div className="shrink-0">
      <button
        className={ap.toggleRow}
        onClick={() => setShowArchived((prev) => !prev)}
        type="button"
      >
        <Archive className={ap.iconMuted} />
        <span className="flex-1 text-left">
          {t(lang, "sidebar.archived_label")}
        </span>
        <ChevronRight className={cn(ap.chevron, showArchived && "rotate-90")} />
      </button>

      {showArchived && (
        <motion.div
          animate={{ opacity: 1, height: "auto" }}
          className="overflow-hidden"
          initial={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="mt-0.5 max-h-48 overflow-y-auto pl-2">
            {archivedLoading ? (
              <div className={ap.loadingRow}>
                <div className="animate-spin">
                  <LoaderIcon />
                </div>
                {t(lang, "sidebar.archived_loading")}
              </div>
            ) : archivedData?.chats?.length ? (
              archivedData.chats.map((chat) => (
                <div className="group/archived relative" key={chat.id}>
                  <a
                    className={archivedTitleRowClass(portal, chat.id === id)}
                    href={`/chat/${chat.id}`}
                    onClick={() => closePanel(false)}
                  >
                    <span className="truncate">{chat.title}</span>
                  </a>
                  <button
                    className={ap.unarchiveBtn}
                    onClick={() => handleUnarchive(chat.id)}
                    title={t(lang, "sidebar.restore_action")}
                    type="button"
                  >
                    <RotateCcw className="size-3" />
                  </button>
                </div>
              ))
            ) : (
              <div className={ap.empty}>
                {t(lang, "sidebar.archived_empty")}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
