"use client";

import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  History,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import {
  ConfluenceProductIcon,
  JiraProductIcon,
} from "@/components/atlassian-product-icons";
import { GettingStartedDestinyIcon } from "@/components/getting-started-destiny-icon";
import {
  getChatHistoryPaginationKey,
  SidebarHistory,
} from "@/components/sidebar-history";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useLanguage } from "./language-selector";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const sidebarBtn =
  "group flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 font-medium text-[14px] text-white/70 transition-all duration-150 hover:border-white/20 hover:bg-white/[0.09] hover:text-white active:scale-[0.97] active:opacity-80";

const sidebarBtnActive =
  "border-white/25 bg-white/[0.12] text-white ring-1 ring-white/40 hover:border-white/35 hover:bg-white/[0.16] hover:text-white";

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const { lang } = useLanguage();
  const isHistoryRoute =
    pathname === "/history" || pathname?.startsWith("/history/");
  const isSettingsRoute =
    pathname === "/settings" || pathname?.startsWith("/settings/");

  const handleDeleteAll = () => {
    const deletePromise = fetch("/api/history", {
      method: "DELETE",
    });

    toast.promise(deletePromise, {
      loading: "Deleting all chats...",
      success: () => {
        mutate(unstable_serialize(getChatHistoryPaginationKey));
        setShowDeleteAllDialog(false);
        router.replace("/");
        router.refresh();
        return "All chats deleted successfully";
      },
      error: "Failed to delete all chats",
    });
  };

  const featuredLinks = [
    {
      label: t(lang, "portal.featured.getting_started"),
      icon: GettingStartedDestinyIcon,
      href: "/",
      external: false,
    },
    {
      label: t(lang, "portal.featured.jira"),
      icon: JiraProductIcon,
      href: "#",
      external: true,
    },
    {
      label: t(lang, "portal.featured.confluence"),
      icon: ConfluenceProductIcon,
      href: "#",
      external: true,
    },
  ] as const;

  return (
    <>
      <Sidebar className="[--sidebar-accent:var(--sidebar-accent-app-light)] group-data-[side=left]:border-r-0 dark:[--sidebar-accent:var(--sidebar-accent-app-dark)]">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <SidebarHeader className="gap-0 p-3 pb-2">
          {/* Destiny portal card */}
          <Link
            className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-neutral-800 to-neutral-950 px-3.5 py-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.15)] transition-all duration-200 hover:border-white/20 hover:shadow-[0_4px_20px_-2px_rgba(0,0,0,0.4)]"
            href="/"
            onClick={() => setOpenMobile(false)}
          >
            <div className="relative -ml-1 shrink-0">
              <div className="size-11 overflow-hidden rounded-full shadow-md ring-2 ring-white/20">
                <Image
                  alt="Destiny"
                  className="size-full object-cover object-center"
                  height={44}
                  src="/images/destiny-avatar.png"
                  width={44}
                />
              </div>
              <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.6)] ring-[1.5px] ring-neutral-900" />
            </div>
            <div className="grid min-w-0 flex-1 content-center gap-1 text-start">
              <p className="m-0 truncate font-semibold text-[15px] text-white leading-none">
                {t(lang, "sidebar.destiny")}
              </p>
              <p className="m-0 truncate font-medium text-[12px] text-white/55 uppercase leading-tight tracking-wide">
                {t(lang, "portal.destiny.description_short")}
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-white/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white/80" />
          </Link>

          {/* New chat + clear all row */}
          <div className="mt-3 flex items-center gap-2">
            <Link
              className={cn(sidebarBtn, "flex-1")}
              href="/"
              onClick={() => setOpenMobile(false)}
            >
              <Plus className="size-4 shrink-0" />
              {t(lang, "chat.new_chat")}
            </Link>

            {user && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex size-[46px] shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/45 transition-all duration-150 hover:border-white/20 hover:bg-white/[0.08] hover:text-white/80 active:scale-[0.93] active:opacity-75"
                    onClick={() => setShowDeleteAllDialog(true)}
                    type="button"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent align="end" className="hidden md:block">
                  {t(lang, "sidebar.delete_all")}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </SidebarHeader>

        {/* ── Content ─────────────────────────────────────────────────── */}
        <SidebarContent className="flex flex-col overflow-y-auto">
          {/* Recent chats — scrollable when more than 8 chats exist */}
          <div className="flex flex-col gap-2 px-1">
            {/* Section label */}
            <p className="mb-0.5 px-2 pt-1.5 font-bold text-[11px] text-white/35 uppercase tracking-widest">
              {t(lang, "sidebar.history")}
            </p>
            <SidebarHistory user={user} />
            {/* Fade to indicate more chats exist below */}
            <div className="pointer-events-none sticky bottom-0 h-10 bg-gradient-to-t from-neutral-950/80 to-transparent" />
          </div>

          {/* Gradient divider */}
          <div className="mx-3 my-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Full history link */}
          {user ? (
            <div className="shrink-0 px-3 pb-2">
              <Link
                className={cn(sidebarBtn, isHistoryRoute && sidebarBtnActive)}
                href="/history"
                onClick={() => setOpenMobile(false)}
              >
                <History
                  className={cn(
                    "size-4 shrink-0",
                    isHistoryRoute ? "text-white" : "text-white/55"
                  )}
                />
                {`${t(lang, "sidebar.history")} & ${t(
                  lang,
                  "history.tab_archived"
                )}`}
              </Link>
            </div>
          ) : null}

          {/* Featured Links pane */}
          <div className="shrink-0 px-3 pb-1">
            <p className="mb-1.5 px-1 font-bold text-[11px] text-white/45 uppercase tracking-widest">
              {t(lang, "portal.featured")}
            </p>
            <div className="overflow-hidden rounded-xl border border-white/[0.10] bg-white/[0.05]">
              {featuredLinks.map(({ label, icon: Icon, href, external }, i) => (
                <Link
                  className={`group flex items-center gap-3 px-3.5 py-3 transition-all duration-150 hover:bg-white/[0.08] active:bg-white/[0.12] ${
                    i < featuredLinks.length - 1
                      ? "border-white/[0.07] border-b"
                      : ""
                  }`}
                  href={href}
                  key={label}
                  onClick={() => setOpenMobile(false)}
                  {...(external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  <Icon className="size-[18px] shrink-0 opacity-90" />
                  <span className="min-w-0 flex-1 truncate font-medium text-[14px] text-white/85 transition-colors group-hover:text-white">
                    {label}
                  </span>
                  {external && (
                    <ExternalLink className="size-3.5 shrink-0 text-white/30 transition-colors group-hover:text-white/60" />
                  )}
                  {!external && (
                    <ChevronRight className="size-4 shrink-0 text-white/30 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-white/60" />
                  )}
                </Link>
              ))}
            </div>
          </div>
        </SidebarContent>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <SidebarFooter className="gap-2 p-3 pt-1">
          {/* Gradient divider above footer */}
          <div className="-mx-3 mb-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <Link
            className={cn(sidebarBtn, isSettingsRoute && sidebarBtnActive)}
            href="/settings"
            onClick={() => setOpenMobile(false)}
          >
            <Settings
              className={cn(
                "size-4 shrink-0",
                isSettingsRoute ? "text-white" : "text-white/55"
              )}
            />
            {t(lang, "header.settings")}
          </Link>

          <Link
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-[14px] text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-150 hover:bg-primary/90 hover:shadow-primary/40 active:scale-[0.97] active:opacity-85"
            href="/"
            onClick={() => setOpenMobile(false)}
          >
            <ArrowLeft className="size-[18px] shrink-0" />
            {t(lang, "sidebar.back_portal")}
          </Link>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(lang, "sidebar.delete_all_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(lang, "sidebar.delete_all_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t(lang, "sidebar.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll}>
              {t(lang, "sidebar.delete_all_confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
