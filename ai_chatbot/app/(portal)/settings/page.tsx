"use client";

import { KeyRound, Settings as SettingsIcon, Wrench } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SettingsApiKeysTab } from "@/components/settings-api-keys-tab";
import { SettingsAppsTab } from "@/components/settings-apps-tab";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SECTIONS = [
  {
    id: "apps",
    label: "Apps",
    description: "Manage integrations and connected applications.",
    icon: Wrench,
  },
  {
    id: "personal-tokens",
    label: "Personal Tokens",
    description:
      "Create and revoke personal API tokens for external AI clients.",
    icon: KeyRound,
  },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const DEFAULT_SECTION: SectionId = "apps";

const getTabClassName = (isActive: boolean) =>
  cn(
    "inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 font-medium text-sm transition-colors",
    isActive
      ? "bg-background text-foreground shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
      : "text-muted-foreground hover:text-foreground"
  );

function normalizeSectionParam(raw: string | null): SectionId | null {
  if (!raw) {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  // Back-compat with the old labels so deep links don't break.
  if (normalized === "apps") {
    return "apps";
  }
  if (
    normalized === "personal tokens" ||
    normalized === "personal-tokens" ||
    normalized === "api keys" ||
    normalized === "api-keys"
  ) {
    return "personal-tokens";
  }
  return null;
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] =
    useState<SectionId>(DEFAULT_SECTION);

  useEffect(() => {
    const parsed = normalizeSectionParam(searchParams.get("section"));
    if (parsed) {
      setActiveSection(parsed);
    }
  }, [searchParams]);

  const handleSelectSection = (next: SectionId) => {
    setActiveSection(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", next);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-10">
      <Card className="border-border/70 bg-card/80 shadow-md backdrop-blur-sm dark:border-neutral-700/60 dark:bg-neutral-950/50">
        <CardHeader className="space-y-3 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 dark:bg-primary/15">
              <SettingsIcon aria-hidden className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-2xl md:text-3xl">Settings</CardTitle>
              <CardDescription className="text-[15px] leading-relaxed">
                Manage connected apps and personal access tokens.
              </CardDescription>
            </div>
          </div>

          <div
            className="flex w-full gap-1 rounded-xl bg-muted/70 p-1 ring-1 ring-border/50 dark:bg-neutral-900/80 dark:ring-neutral-700/60"
            role="tablist"
          >
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  aria-selected={isActive}
                  className={getTabClassName(isActive)}
                  key={section.id}
                  onClick={() => handleSelectSection(section.id)}
                  role="tab"
                  type="button"
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  <span className="truncate">{section.label}</span>
                </button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="border-border/50 border-t pt-0 dark:border-neutral-800">
          <div className="min-h-[min(60vh,28rem)] pt-6" role="tabpanel">
            {activeSection === "apps" && <SettingsAppsTab />}
            {activeSection === "personal-tokens" && <SettingsApiKeysTab />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
