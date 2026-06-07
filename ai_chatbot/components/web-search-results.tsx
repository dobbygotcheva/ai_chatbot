"use client";

import { Globe } from "lucide-react";
import { Tool, ToolContent, ToolHeader } from "@/components/elements/tool";

interface WebSearchResultsProps {
  urls: Array<{ url: string }>;
  searchQuery?: string;
}

export function WebSearchResults({ urls, searchQuery }: WebSearchResultsProps) {
  return (
    <div className="w-full" data-testid="web-search-results">
      <Tool defaultOpen={true}>
        <ToolHeader
          icon={<Globe className="size-4 shrink-0 text-muted-foreground" />}
          label="Web Search Results"
          state="output-available"
        />
        <ToolContent>
          {searchQuery && (
            <div className="px-4 pt-3 pb-1 text-muted-foreground text-xs">
              Search: {searchQuery}
            </div>
          )}
          {urls.length === 0 ? (
            <div className="p-4 text-muted-foreground text-sm">
              No results found
            </div>
          ) : (
            <ol className="list-none space-y-1 p-4">
              {urls.map((url, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Task requirement to use index as key
                <li className="flex items-baseline gap-2" key={index}>
                  <span className="shrink-0 text-muted-foreground text-xs">
                    [{index + 1}]
                  </span>
                  <a
                    className="break-all text-primary text-sm hover:underline"
                    data-testid="web-search-url"
                    href={url.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {url.url}
                  </a>
                </li>
              ))}
            </ol>
          )}
        </ToolContent>
      </Tool>
    </div>
  );
}
