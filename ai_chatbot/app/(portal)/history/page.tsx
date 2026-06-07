import { redirect } from "next/navigation";
import { PortalHistoryView } from "./portal-history-view";

type HistoryPageProps = {
  searchParams?: Promise<{
    tab?: string | string[];
  }>;
};

export default async function PortalHistoryPage({
  searchParams,
}: HistoryPageProps) {
  const params = await searchParams;
  const rawTab = params?.tab;
  const tab = Array.isArray(rawTab) ? rawTab.at(0) : rawTab;

  if (tab === "archived") {
    redirect("/history/archived");
  }

  if (tab === "conversations") {
    redirect("/history");
  }

  return <PortalHistoryView activeTab="conversations" />;
}
