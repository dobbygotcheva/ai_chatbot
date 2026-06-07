"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const errorType = searchParams.get("error");
  const [lang, setLang] = useState<string>("en");

  useEffect(() => {
    const savedLang = localStorage.getItem("lang");
    if (savedLang && ["en", "bg"].includes(savedLang)) {
      setLang(savedLang);
    }
  }, []);

  const getMessage = () => {
    switch (errorType) {
      case "AccessDenied":
        return {
          title: t(lang, "error.access_denied_title"),
          message: t(lang, "error.access_denied_message"),
        };
      case "Configuration":
        return {
          title: t(lang, "error.configuration_title"),
          message: t(lang, "error.configuration_message"),
        };
      default:
        return {
          title: t(lang, "error.auth_title"),
          message: t(lang, "error.auth_message"),
        };
    }
  };

  const { title, message } = getMessage();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <svg
            className="h-8 w-8 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <title>Access Denied</title>
            <path
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="font-bold text-2xl tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>

        <div className="flex justify-center gap-3">
          <Button
            onClick={() => (window.location.href = "/login")}
            variant="default"
          >
            {t(lang, "error.back_to_login")}
          </Button>
        </div>
      </div>
    </div>
  );
}
