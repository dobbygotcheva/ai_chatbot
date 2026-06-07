import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { ChatInterface } from "@/components/chat-interface";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: rawId } = await params;
  const idParsed = z.string().uuid().safeParse(rawId);
  if (!idParsed.success) {
    return { title: "Destiny" };
  }

  const chat = await getChatById({ id: idParsed.data });
  if (!chat) {
    return { title: "Destiny" };
  }

  const session = await auth();
  if (!session?.user) {
    return { title: "Destiny" };
  }

  if (chat.visibility === "private" && session.user.id !== chat.userId) {
    return { title: "Destiny" };
  }

  return { title: `Destiny - ${chat.title}` };
}

export default function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <ChatPage params={props.params} />
    </Suspense>
  );
}

async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const idParsed = z.string().uuid().safeParse(rawId);
  if (!idParsed.success) {
    redirect("/");
  }
  const id = idParsed.data;

  let chat: Awaited<ReturnType<typeof getChatById>>;
  try {
    chat = await getChatById({ id });
  } catch {
    redirect("/");
  }

  if (!chat) {
    redirect("/");
  }

  const session = await auth();

  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/chat/${id}`)}`);
  }

  if (chat.visibility === "private") {
    if (!session.user) {
      return notFound();
    }

    if (session.user.id !== chat.userId) {
      return notFound();
    }
  }

  let messagesFromDb: Awaited<ReturnType<typeof getMessagesByChatId>>;
  try {
    messagesFromDb = await getMessagesByChatId({ id });
  } catch {
    redirect("/");
  }

  const uiMessages = convertToUIMessages(messagesFromDb);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden dark:bg-background">
      <ChatInterfaceWithModel initialMessages={uiMessages as ChatMessage[]} />
    </div>
  );
}

function ChatInterfaceWithModel({
  initialMessages,
}: {
  initialMessages: ChatMessage[];
}) {
  "use client";

  return <ChatInterface initialMessages={initialMessages} />;
}
