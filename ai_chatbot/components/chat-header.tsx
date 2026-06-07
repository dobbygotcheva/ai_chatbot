"use client";

import { LogIn, LogOut, Moon, Sun } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { memo, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t } from "@/lib/i18n";
import { PlusIcon } from "./icons";
import { LanguageSelector, useLanguage } from "./language-selector";
import { SidebarToggle } from "./sidebar-toggle";
import { useSidebar } from "./ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

function PureChatHeader({
  chatId: _chatId,
  isReadonly: _isReadonly,
  selectedVisibilityType: _selectedVisibilityType,
}: {
  chatId: string;
  selectedVisibilityType: string;
  isReadonly: boolean;
}) {
  const router = useRouter();
  const { open } = useSidebar();
  const { data: session, status: authStatus } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { lang } = useLanguage();

  const userDisplayName = (() => {
    const fullName = session?.user?.name?.trim();
    if (fullName) {
      return fullName;
    }

    const emailLocalPart = session?.user?.email?.split("@").at(0);
    if (!emailLocalPart) {
      return "User";
    }

    return emailLocalPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  })();
  const normalizedEmail = session?.user?.email?.toLowerCase() ?? "";
  const resolvedUserDisplayName =
    normalizedEmail.includes("dobrinka") || /^dobrinka\b/i.test(userDisplayName)
      ? "Dobby Gotcheva"
      : userDisplayName;

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : false;

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-neutral-200/90 border-b bg-white px-2 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] md:px-3 dark:border-white/[0.08] dark:bg-white/[0.04] dark:shadow-none dark:backdrop-blur-xl dark:backdrop-saturate-150">
      {/* Left: sidebar toggle */}
      <SidebarToggle />

      {/* New Chat (when sidebar closed) */}
      {!open && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="size-8 rounded-lg p-0 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              onClick={() => {
                router.push("/");
                router.refresh();
              }}
              variant="ghost"
            >
              <PlusIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Chat</TooltipContent>
        </Tooltip>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Language selector with flags */}
      <LanguageSelector />

      {/* Theme toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="size-8 rounded-lg p-0 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            type="button"
            variant="ghost"
          >
            {mounted ? (
              isDark ? (
                <Sun className="size-[15px]" />
              ) : (
                <Moon className="size-[15px]" />
              )
            ) : (
              <span className="size-[15px]" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isDark ? "Light mode" : "Dark mode"}</TooltipContent>
      </Tooltip>

      {/* User avatar / auth */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                className="group flex h-9 items-center gap-2 rounded-full border border-border/40 pr-1.5 pl-2 transition-all hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border/60"
                type="button"
              >
                <Image
                  alt={t(lang, "header.account")}
                  className="size-6 object-contain"
                  height={24}
                  src="/images/user-circle.svg"
                  width={24}
                />
                <span className="hidden max-w-28 truncate font-medium text-[13px] text-foreground sm:inline">
                  {resolvedUserDisplayName}
                </span>
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Account</TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          align="end"
          className="min-w-[160px]"
          sideOffset={8}
        >
          {session?.user?.email && (
            <>
              <DropdownMenuItem
                className="text-muted-foreground text-xs"
                disabled
              >
                {resolvedUserDisplayName}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {authStatus === "authenticated" ? (
            <DropdownMenuItem
              onSelect={async () => {
                await signOut({ redirect: false });
                window.location.assign("/login");
              }}
            >
              <LogOut className="mr-2 size-3.5" />
              {t(lang, "header.sign_out")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => router.push("/login")}>
              <LogIn className="mr-2 size-3.5" />
              {t(lang, "header.sign_in")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType
  );
});
