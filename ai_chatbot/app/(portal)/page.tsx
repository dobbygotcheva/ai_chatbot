"use client";

import { ChatInterface } from "@/components/chat-interface";
import { StarshineGlitter } from "@/components/starshine-glitter";
import { Meteors } from "@/components/ui/meteors";

export default function PortalPage() {
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden dark:bg-background">
      <StarshineGlitter className="fixed inset-0 z-[1]" count={32} />
      <Meteors className="fixed inset-0 z-[2]" count={5} />

      <main className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <ChatInterface />
      </main>
    </div>
  );
}
