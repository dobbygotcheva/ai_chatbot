import { Suspense } from "react";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { PortalFooter } from "@/components/portal-footer";
import { PortalTopHeader } from "@/components/portal-top-header";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DataStreamProvider>
      <Suspense fallback={<div className="flex h-dvh" />}>
        <TooltipProvider>
          <div className="flex h-dvh flex-col">
            <PortalTopHeader />
            <div className="flex min-h-0 flex-1 flex-col pt-[var(--portal-header-height)]">
              <main
                className="min-h-0 flex-1 overflow-auto"
                data-portal-main=""
              >
                {children}
              </main>
              <PortalFooter />
            </div>
          </div>
        </TooltipProvider>
      </Suspense>
    </DataStreamProvider>
  );
}
