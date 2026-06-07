import { useRouter } from "next/navigation";
import { memo } from "react";
import type { Chat } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { ArchiveIcon, MoreHorizontalIcon, TrashIcon } from "./icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";

/**
 * A single row in the sidebar chat list.
 */
const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  onArchive,
  setOpenMobile,
  portal = false,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  onArchive: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
  portal?: boolean;
}) => {
  const router = useRouter();

  return (
    <SidebarMenuItem className="chat-item">
      <SidebarMenuButton
        asChild
        className="sidebar-chat-item font-medium text-[15px]"
        isActive={isActive}
      >
        <a
          href={`/chat/${chat.id}`}
          onClick={(e) => {
            e.preventDefault();
            setOpenMobile(false);
            router.push(`/chat/${chat.id}`);
          }}
        >
          <span
            className={cn(
              "inline-block transition-transform duration-150 group-hover/menu-item:translate-x-0.5",
              portal
                ? "text-foreground/90 dark:text-neutral-100/90"
                : "text-foreground/90 dark:text-white/90"
            )}
          >
            {chat.title}
          </span>
        </a>
      </SidebarMenuButton>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className={
              portal
                ? "mr-0.5 text-muted-foreground hover:text-foreground data-[state=open]:bg-foreground/10 data-[state=open]:text-foreground dark:text-neutral-100/55 dark:data-[state=open]:bg-white/10 dark:data-[state=open]:text-neutral-100 dark:hover:text-neutral-100"
                : "mr-0.5 text-foreground/60 hover:text-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground dark:text-white/50 dark:hover:text-white"
            }
            showOnHover={!isActive}
          >
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          alignOffset={-6}
          className={cn(
            "min-w-[10rem] rounded-xl border p-1.5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl",
            "border-black/5 bg-neutral-100/80 text-neutral-800",
            "dark:border-white/10 dark:bg-neutral-800/70 dark:text-neutral-100",
            "data-[side=right]:slide-in-from-top-2 data-[side=left]:slide-in-from-top-2"
          )}
          side="right"
          sideOffset={8}
        >
          <DropdownMenuItem
            className={cn(
              "group/menu-row cursor-pointer rounded-lg px-2.5 py-2 font-medium text-[13.5px] transition-colors",
              "text-neutral-700 focus:bg-black/5 focus:text-neutral-900",
              "dark:text-neutral-200 dark:focus:bg-white/10 dark:focus:text-white"
            )}
            onSelect={() => onArchive(chat.id)}
          >
            <ArchiveIcon />
            <span>Archive</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className={cn(
              "group/delete cursor-pointer rounded-lg px-2.5 py-2 font-medium text-[13.5px] transition-all duration-200",
              "text-red-600/90 hover:text-red-500",
              "dark:text-red-400/90 dark:hover:text-red-300"
            )}
            onSelect={() => onDelete(chat.id)}
          >
            <TrashIcon className="transition-all duration-200 group-hover/delete:drop-shadow-[0_0_8px_rgba(239,68,68,0.6)] dark:group-hover/delete:drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" />
            <span className="ml-1">Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) {
    return false;
  }
  if (prevProps.chat.title !== nextProps.chat.title) {
    return false;
  }
  if (prevProps.onArchive !== nextProps.onArchive) {
    return false;
  }
  if (prevProps.portal !== nextProps.portal) {
    return false;
  }
  return true;
});
