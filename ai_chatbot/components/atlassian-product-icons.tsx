import { SiJirasoftware } from "@icons-pack/react-simple-icons";
import Image from "next/image";
import { cn } from "@/lib/utils";

type ProductIconProps = { className?: string };

/**
 * Jira Software mark — SVG only, transparent, brand blue (#0052CC).
 */
export function JiraProductIcon({ className }: ProductIconProps) {
  return (
    <SiJirasoftware
      aria-hidden
      className={cn("shrink-0", className)}
      color="default"
      size={24}
    />
  );
}

/**
 * Confluence mark — brand asset (lighter blues than Simple Icons default).
 */
export function ConfluenceProductIcon({ className }: ProductIconProps) {
  return (
    <Image
      alt=""
      aria-hidden
      className={cn("shrink-0 object-contain", className)}
      height={48}
      src="/images/confluence-product-icon.png"
      width={48}
    />
  );
}
