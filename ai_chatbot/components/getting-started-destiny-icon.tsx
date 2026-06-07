"use client";

import Image, { type StaticImageData } from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import darkMode from "@/components/scenario-icons/dark_mode.png";
import lightMode from "@/components/scenario-icons/light_mode.png";
import { cn } from "@/lib/utils";

/** Theme-aware mark for “Getting Started with Destiny”. */
export function GettingStartedDestinyIcon({
  className,
}: {
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const src: StaticImageData =
    mounted && resolvedTheme === "dark" ? darkMode : lightMode;

  return (
    <Image
      alt=""
      aria-hidden
      className={cn("size-4 shrink-0 object-contain", className)}
      key={src.src}
      priority
      src={src}
    />
  );
}
