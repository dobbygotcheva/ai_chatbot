"use client";

import { History } from "lucide-react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  pathname: string;
  lang: string;
};

export function PortalHistorySidebarLink({ pathname, lang }: Props) {
  const isHistoryPage =
    pathname === "/history" || pathname.startsWith("/history/");

  return (
    <Link
      aria-current={isHistoryPage ? "page" : undefined}
      className={cn(
        "group flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-black/[0.05] px-3 py-3 font-medium text-[14px] text-black/70 transition-all duration-150 hover:border-black/20 hover:bg-black/[0.09] hover:text-black active:scale-[0.97] active:opacity-80 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/70 dark:active:scale-[0.97] dark:active:opacity-80 dark:hover:border-white/20 dark:hover:bg-white/[0.09] dark:hover:text-white",
        isHistoryPage &&
          "border-black/25 bg-black/[0.12] text-black ring-1 ring-black/40 hover:border-black/35 hover:bg-black/[0.16] hover:text-black dark:border-white/25 dark:bg-white/[0.12] dark:text-white dark:ring-white/40 dark:hover:border-white/35 dark:hover:bg-white/[0.16] dark:hover:text-white"
      )}
      href="/history"
    >
      <History
        className={cn(
          "size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5",
          isHistoryPage
            ? "text-black dark:text-white"
            : "text-black/55 dark:text-white/55"
        )}
      />
      <span>{`${t(
        lang,
        "sidebar.full_history"
      )} & ${t(lang, "history.tab_archived")}`}</span>
    </Link>
  );
}
