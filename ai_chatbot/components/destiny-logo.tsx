"use client";

type DestinyLogoProps = {
  className?: string;
};

export function DestinyLogo({ className = "size-6" }: DestinyLogoProps) {
  return (
    <span className={`relative inline-flex ${className}`} title="Destiny">
      {/* biome-ignore lint/performance/noImgElement: decorative avatar logo */}
      {/* biome-ignore lint/correctness/useImageSize: sized by parent container */}
      <img
        alt="Destiny"
        className="size-full rounded-full object-cover object-center ring-1 ring-border/50"
        src="/images/destiny-avatar.png"
      />
    </span>
  );
}
