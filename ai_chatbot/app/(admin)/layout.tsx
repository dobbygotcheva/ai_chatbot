import { cookies } from "next/headers";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppearanceProvider } from "@/components/appearance-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  AURORAL_APPEARANCE_COOKIE,
  type AuroralAppearance,
  DEFAULT_AURORAL_APPEARANCE,
} from "@/lib/appearance";
import { auth } from "../(auth)/auth";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <SidebarWrapper>{children}</SidebarWrapper>
    </Suspense>
  );
}

const VALID_AURORAL_APPEARANCES: AuroralAppearance[] = [
  "northern-intense",
  "northern-dimmed",
  "northern-dusk",
  "northern-warm",
  "agrabah",
];

async function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";
  const appearanceCookie =
    cookieStore.get(AURORAL_APPEARANCE_COOKIE)?.value ??
    DEFAULT_AURORAL_APPEARANCE;
  const initialAppearance: AuroralAppearance =
    VALID_AURORAL_APPEARANCES.includes(appearanceCookie as AuroralAppearance)
      ? (appearanceCookie as AuroralAppearance)
      : DEFAULT_AURORAL_APPEARANCE;

  return (
    <AppearanceProvider initialAppearance={initialAppearance}>
      <SidebarProvider defaultOpen={!isCollapsed}>
        <AppSidebar user={session?.user} />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </AppearanceProvider>
  );
}
