"use client";

import { Archive, History, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ChatHistoryArchivedPanel,
  ChatHistoryConversationsPanel,
} from "@/components/chat-history-panels";
import { useLanguage } from "@/components/language-selector";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type HistoryTab = "conversations" | "archived";

const getTabClassName = (isActive: boolean) =>
  cn(
    "inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 font-medium text-sm transition-colors",
    isActive
      ? "bg-background text-foreground shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
      : "text-muted-foreground hover:text-foreground"
  );

export function PortalHistoryView({ activeTab }: { activeTab: HistoryTab }) {
  const { lang } = useLanguage();
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-muted-foreground">
          {t(lang, "history.sign_in_prompt")}
        </p>
        <Button asChild type="button">
          <Link href="/login">{t(lang, "header.sign_in")}</Link>
        </Button>
      </div>
    );
  }

  return (
    // Pin the wrapper to the viewport minus the portal header + footer so
    // the card below can be a true flex-column with a bounded height. That
    // lets the list panel size itself to what's available on screen and
    // skips the "scroll down to click Next, scroll back up to read the
    // page" UX we used to have.
    <div className="mx-auto flex h-[calc(100dvh-var(--portal-header-height)-var(--portal-footer-height))] w-full max-w-3xl flex-col gap-6 overflow-hidden px-4 py-6 md:px-6 md:py-10">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/70 bg-card/80 shadow-md backdrop-blur-sm dark:border-neutral-700/60 dark:bg-neutral-950/50">
        <CardHeader className="shrink-0 space-y-3 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 dark:bg-primary/15">
              <History aria-hidden className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-2xl md:text-3xl">
                {t(lang, "history.page_title")}
              </CardTitle>
              <CardDescription className="text-[15px] leading-relaxed">
                {t(lang, "history.page_description")}
              </CardDescription>
            </div>
          </div>

          <div
            className="flex w-full gap-1 rounded-xl bg-muted/70 p-1 ring-1 ring-border/50 dark:bg-neutral-900/80 dark:ring-neutral-700/60"
            role="tablist"
          >
            <Link
              aria-selected={activeTab === "conversations"}
              className={getTabClassName(activeTab === "conversations")}
              href="/history"
              role="tab"
            >
              {t(lang, "history.tab_conversations")}
            </Link>
            <Link
              aria-selected={activeTab === "archived"}
              className={getTabClassName(activeTab === "archived")}
              href="/history/archived"
              role="tab"
            >
              <Archive aria-hidden className="size-4 shrink-0" />
              <span className="truncate">
                {t(lang, "history.tab_archived")}
              </span>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col border-border/50 border-t pt-0 dark:border-neutral-800">
          <div className="flex min-h-0 flex-1 flex-col pt-6" role="tabpanel">
            {activeTab === "conversations" ? (
              <ChatHistoryConversationsPanel lang={lang} />
            ) : (
              <ChatHistoryArchivedPanel lang={lang} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
