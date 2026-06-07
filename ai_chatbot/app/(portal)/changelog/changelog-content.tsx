"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLanguage } from "@/components/language-selector";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { t } from "@/lib/i18n";

interface ChangelogEntry {
  version: string;
  date: string;
  content: string;
}

interface ChangelogPageProps {
  entries: ChangelogEntry[];
}

export default function ChangelogPage({ entries }: ChangelogPageProps) {
  const { lang } = useLanguage();

  const sortedEntries = entries.sort((a, b) => {
    const aParts = a.version.split(".").map(Number);
    const bParts = b.version.split(".").map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      if (aPart !== bPart) {
        return bPart - aPart;
      }
    }
    return 0;
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
      <div className="mb-8 space-y-2">
        <h1 className="font-bold text-3xl tracking-tight">
          {t(lang, "changelog.title")}
        </h1>
        <p className="text-muted-foreground">
          {t(lang, "changelog.description")}
        </p>
      </div>

      <div className="space-y-8">
        {sortedEntries.map((entry, index) => (
          <Card key={entry.version}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3">
                    {t(lang, "changelog.version")} {entry.version}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t(lang, "changelog.release_date")}{" "}
                    {new Date(entry.date).toLocaleDateString(
                      lang === "bg" ? "bg-BG" : "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </CardDescription>
                </div>
                <Badge variant={index === 0 ? "default" : "secondary"}>
                  {index === 0
                    ? "Latest"
                    : t(lang, "changelog.initial_release")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {entry.content}
              </ReactMarkdown>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
