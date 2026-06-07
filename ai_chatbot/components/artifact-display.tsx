"use client";

import {
  ChevronDownIcon,
  DownloadIcon,
  FileArchiveIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
} from "lucide-react";
import Image from "next/image";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  CodeExecutionFile,
  CodeExecutionImage,
} from "@/lib/types/code-execution";
import { cn } from "@/lib/utils";

interface ArtifactDisplayProps extends ComponentProps<"div"> {
  files?: CodeExecutionFile[];
  images?: CodeExecutionImage[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadFile(
  filename: string,
  base64Content: string,
  contentType: string
) {
  const link = document.createElement("a");
  link.href = `data:${contentType};base64,${base64Content}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  const iconMap: Record<
    string,
    React.ComponentType<React.SVGProps<SVGSVGElement>>
  > = {
    png: FileImageIcon,
    jpg: FileImageIcon,
    jpeg: FileImageIcon,
    gif: FileImageIcon,
    webp: FileImageIcon,
    svg: FileImageIcon,
    bmp: FileImageIcon,
    ico: FileImageIcon,
    js: FileCodeIcon,
    jsx: FileCodeIcon,
    ts: FileCodeIcon,
    tsx: FileCodeIcon,
    py: FileCodeIcon,
    rb: FileCodeIcon,
    go: FileCodeIcon,
    rs: FileCodeIcon,
    java: FileCodeIcon,
    cpp: FileCodeIcon,
    c: FileCodeIcon,
    h: FileCodeIcon,
    hpp: FileCodeIcon,
    cs: FileCodeIcon,
    php: FileCodeIcon,
    swift: FileCodeIcon,
    kt: FileCodeIcon,
    scala: FileCodeIcon,
    r: FileCodeIcon,
    m: FileCodeIcon,
    sql: FileCodeIcon,
    sh: FileCodeIcon,
    bash: FileCodeIcon,
    html: FileCodeIcon,
    css: FileCodeIcon,
    scss: FileCodeIcon,
    sass: FileCodeIcon,
    less: FileCodeIcon,
    vue: FileCodeIcon,
    svelte: FileCodeIcon,
    json: FileCodeIcon,
    xml: FileCodeIcon,
    yaml: FileCodeIcon,
    yml: FileCodeIcon,
    toml: FileCodeIcon,
    csv: FileSpreadsheetIcon,
    xls: FileSpreadsheetIcon,
    xlsx: FileSpreadsheetIcon,
    ods: FileSpreadsheetIcon,
    txt: FileTextIcon,
    md: FileTextIcon,
    markdown: FileTextIcon,
    rtf: FileTextIcon,
    doc: FileTextIcon,
    docx: FileTextIcon,
    pdf: FileTextIcon,
    log: FileTextIcon,
    zip: FileArchiveIcon,
    tar: FileArchiveIcon,
    gz: FileArchiveIcon,
    rar: FileArchiveIcon,
    "7z": FileArchiveIcon,
    mp4: FileVideoIcon,
    avi: FileVideoIcon,
    mov: FileVideoIcon,
    wmv: FileVideoIcon,
    flv: FileVideoIcon,
    mkv: FileVideoIcon,
    webm: FileVideoIcon,
  };

  return iconMap[ext] ?? FileIcon;
}

export const ArtifactDisplay = ({
  files,
  images,
  className,
}: ArtifactDisplayProps) => {
  const hasArtifacts = (files?.length ?? 0) > 0 || (images?.length ?? 0) > 0;

  if (!hasArtifacts) {
    return null;
  }

  return (
    <Collapsible className="w-full" defaultOpen={false}>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-left">
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Artifacts ({(files?.length ?? 0) + (images?.length ?? 0)})
        </span>
        <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          "grid gap-3 p-3",
          "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          className
        )}
      >
        {images?.map((image, index) => (
          <ImageArtifact image={image} key={image.name || index} />
        ))}
        {files?.map((file, index) => (
          <FileArtifact file={file} key={file.name || index} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

const ImageArtifact = ({ image }: { image: CodeExecutionImage }) => {
  const isUrl =
    image.content.startsWith("http://") || image.content.startsWith("https://");
  const hasArtifactId = !!image.artifactId;
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (hasArtifactId && image.artifactId) {
      const fetchArtifact = async () => {
        try {
          const response = await fetch(`/api/artifacts/${image.artifactId}`);
          if (!response.ok) {
            return;
          }
          const arrayBuffer = await response.arrayBuffer();
          const blob = new Blob([arrayBuffer], {
            type: image.content_type || "image/png",
          });
          const newObjectUrl = URL.createObjectURL(blob);
          objectUrlRef.current = newObjectUrl;
          setObjectUrl(newObjectUrl);
        } catch {
          // eslint-disable-next-line no-empty
        }
      };
      fetchArtifact();
    }

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [hasArtifactId, image.artifactId, image.content_type]);

  const src =
    hasArtifactId && objectUrl
      ? objectUrl
      : isUrl
        ? image.content
        : `data:${image.content_type};base64,${image.content}`;

  const fileSize =
    hasArtifactId || isUrl
      ? "N/A"
      : formatFileSize(Math.ceil((image.content.length * 3) / 4));

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card shadow-sm transition-all hover:shadow-black/5 hover:shadow-md">
      <div className="relative aspect-video w-full overflow-hidden bg-muted/30">
        {hasArtifactId ? (
          // biome-ignore lint/correctness/useImageSize: API endpoint requires authentication, Next.js Image doesn't send cookies
          // biome-ignore lint/performance/noImgElement: Using img tag to preserve authentication cookies
          <img
            alt={image.name || "Generated image"}
            className="h-auto w-full object-contain transition-all duration-300 group-hover:scale-105 group-hover:brightness-110"
            src={src}
          />
        ) : (
          <Image
            alt={image.name || "Generated image"}
            className="object-contain transition-all duration-300 group-hover:scale-105 group-hover:brightness-110"
            fill
            loading="lazy"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            src={src}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>
      <div className="flex items-center gap-2 border-t bg-muted/30 p-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-xs">{image.name}</p>
          <p className="truncate text-muted-foreground text-xs">{fileSize}</p>
        </div>
        <Button
          aria-label={`Download ${image.name ?? "image"}`}
          className="shrink-0 transition-colors hover:bg-primary hover:text-primary-foreground"
          onClick={async () => {
            if (hasArtifactId && image.artifactId) {
              try {
                const response = await fetch(
                  `/api/artifacts/${image.artifactId}?download=true`
                );
                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}`);
                }

                const blob = await response.blob();
                const downloadUrl = URL.createObjectURL(blob);

                const link = document.createElement("a");
                link.href = downloadUrl;
                link.download = image.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              } catch (error) {
                console.error("[DOWNLOAD] Error:", error);
                toast.error(
                  error instanceof Error
                    ? `Failed to download: ${error.message}`
                    : "Failed to download artifact"
                );
              }
            } else if (isUrl) {
              window.open(image.content, "_blank");
            } else {
              downloadFile(image.name, image.content, image.content_type);
            }
          }}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <DownloadIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
};

const FileArtifact = ({ file }: { file: CodeExecutionFile }) => {
  const isTextFile =
    file.name.endsWith(".txt") ||
    file.name.endsWith(".csv") ||
    file.name.endsWith(".json") ||
    file.name.endsWith(".md") ||
    file.name.endsWith(".log") ||
    file.name.endsWith(".js") ||
    file.name.endsWith(".ts") ||
    file.name.endsWith(".jsx") ||
    file.name.endsWith(".tsx") ||
    file.name.endsWith(".py") ||
    file.name.endsWith(".html") ||
    file.name.endsWith(".css") ||
    file.name.endsWith(".xml") ||
    file.name.endsWith(".yaml") ||
    file.name.endsWith(".yml");

  const previewContent = isTextFile
    ? (() => {
        try {
          const decoded = atob(file.content);
          const truncated = decoded.slice(0, 150);
          return truncated;
        } catch {
          return undefined;
        }
      })()
    : undefined;

  const FileIconComponent = getFileIcon(file.name);

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-black/5 hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <FileIconComponent className="shrink-0 text-muted-foreground" />
            <p className="truncate font-medium text-xs">{file.name}</p>
          </div>
          <p className="text-muted-foreground text-xs">
            {formatFileSize(file.size)}
          </p>
        </div>
        <Button
          aria-label={`Download ${file.name ?? "file"}`}
          className="shrink-0 transition-colors hover:bg-primary hover:text-primary-foreground"
          onClick={() =>
            downloadFile(
              file.name,
              file.content,
              isTextFile ? "text/plain" : "application/octet-stream"
            )
          }
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <DownloadIcon className="size-4" />
        </Button>
      </div>
      {previewContent && (
        <div className="relative overflow-hidden rounded bg-muted/50 p-2">
          <pre className="max-h-16 overflow-hidden whitespace-pre-wrap break-words font-mono text-muted-foreground text-xs leading-relaxed">
            {previewContent}
            {previewContent.length <
              atob(file.content).slice(0, 150).length && (
              <span className="text-muted-foreground">...</span>
            )}
          </pre>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-muted/50" />
        </div>
      )}
    </div>
  );
};
