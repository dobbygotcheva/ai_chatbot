"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin-header";
import { ApiUsageChart } from "@/components/metrics/api-usage-chart";
import { CumulativeGrowthChart } from "@/components/metrics/cumulative-growth-chart";
import { StatCard } from "@/components/metrics/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

interface ToolCall {
  id: string;
  toolName: string;
  toolType: "base" | "mcp";
  success: boolean;
  errorMessage?: string;
  durationMs: number;
  createdAt: string;
}

interface TokenUsageRecord {
  id: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  createdAt: string;
}

const toolColumns: ColumnDef<ToolCall>[] = [
  {
    accessorKey: "toolName",
    header: "Tool Name",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("toolName")}</div>
    ),
  },
  {
    accessorKey: "toolType",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue<string>("toolType");
      return (
        <Badge
          className="font-normal capitalize"
          variant={type === "mcp" ? "secondary" : "outline"}
        >
          {type}
        </Badge>
      );
    },
  },
  {
    accessorKey: "durationMs",
    header: "Duration (ms)",
    sortDescFirst: true,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">
        {Number(row.getValue("durationMs")).toFixed(0)}
      </span>
    ),
  },
  {
    accessorKey: "success",
    header: "Status",
    sortDescFirst: true,
    meta: { align: "center" },
    cell: ({ row }) => {
      const success = row.getValue("success") as boolean;
      return (
        <Badge
          className={
            success
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
          }
          variant="outline"
        >
          {success ? "Success" : "Failed"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Time",
    sortDescFirst: true,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground text-sm">
        {new Date(row.getValue<string>("createdAt")).toLocaleString()}
      </span>
    ),
  },
];

const tokenColumns: ColumnDef<TokenUsageRecord>[] = [
  {
    accessorKey: "modelId",
    header: "Model",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("modelId")}</div>
    ),
  },
  {
    accessorKey: "inputTokens",
    header: "Input",
    sortDescFirst: true,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">
        {row.getValue<number>("inputTokens").toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "outputTokens",
    header: "Output",
    sortDescFirst: true,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">
        {row.getValue<number>("outputTokens").toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "totalTokens",
    header: "Total",
    sortDescFirst: true,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="font-mono font-semibold tabular-nums">
        {row.getValue<number>("totalTokens").toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Time",
    sortDescFirst: true,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground text-sm">
        {new Date(row.getValue<string>("createdAt")).toLocaleString()}
      </span>
    ),
  },
];

interface CumulativeDataPoint {
  date: string;
  cumulativeRequests: number;
  cumulativeTokens: number;
}

interface UserMetricsSummary {
  toolUsage: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    avgDurationMs: number;
  };
  tokenUsage: {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
  };
  successRate: number;
}

export default function UserMetricsDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const [activeTab, setActiveTab] = useState<"overview" | "tools" | "tokens">(
    "overview"
  );
  const [summary, setSummary] = useState<UserMetricsSummary | null>(null);
  const [cumulativeData, setCumulativeData] = useState<CumulativeDataPoint[]>(
    []
  );
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "overview") {
      setOverviewLoading(true);
      setOverviewError(null);
      Promise.all([
        fetch(
          `/api/metrics/users/${userId}/overview?metricType=cumulative`
        ).then(async (res) => {
          if (!res.ok) {
            throw new Error("Failed to fetch cumulative data");
          }
          return res.json();
        }),
        fetch(`/api/metrics/users/${userId}/summary`).then(async (res) => {
          if (!res.ok) {
            throw new Error("Failed to fetch summary");
          }
          return res.json();
        }),
      ])
        .then(([cumulativeResult, summaryResult]) => {
          setCumulativeData(cumulativeResult.data || []);
          setSummary(summaryResult);
        })
        .catch((error) => {
          console.error("Failed to fetch user overview metrics:", error);
          setOverviewError(
            error instanceof Error ? error.message : "Failed to load metrics"
          );
        })
        .finally(() => {
          setOverviewLoading(false);
        });
    }
  }, [activeTab, userId]);

  return (
    <div className="flex h-dvh flex-col">
      <AdminHeader />

      <div className="flex-1 overflow-auto bg-background p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center gap-4">
            <Button
              onClick={() => router.push("/admin/metrics")}
              size="icon"
              variant="ghost"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div>
              <h1 className="font-bold text-3xl">User Metrics</h1>
              <p className="text-muted-foreground">Detailed usage analytics</p>
            </div>
          </div>

          <div className="mb-6 flex gap-4">
            <Button
              onClick={() => setActiveTab("overview")}
              variant={activeTab === "overview" ? "default" : "outline"}
            >
              Overview
            </Button>
            <Button
              onClick={() => setActiveTab("tools")}
              variant={activeTab === "tools" ? "default" : "outline"}
            >
              Tool Usage
            </Button>
            <Button
              onClick={() => setActiveTab("tokens")}
              variant={activeTab === "tokens" ? "default" : "outline"}
            >
              Token Usage
            </Button>
          </div>

          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-2 font-bold text-2xl">Overview</h2>
                <p className="text-muted-foreground">
                  API usage and cumulative growth metrics for this user
                </p>
              </div>
              {overviewLoading ? (
                <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                  Loading...
                </div>
              ) : overviewError ? (
                <div className="flex h-[400px] items-center justify-center">
                  <div className="text-center text-red-500">
                    <p className="font-semibold text-lg">{overviewError}</p>
                    <p className="text-muted-foreground text-sm">
                      Please try refreshing the page
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {summary && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <StatCard
                        description="Total tool calls"
                        title="Total Tool Calls"
                        value={summary.toolUsage.totalCalls.toLocaleString()}
                      />
                      <StatCard
                        description={`Success rate: ${summary.successRate}%`}
                        title="Successful Calls"
                        value={summary.toolUsage.successfulCalls.toLocaleString()}
                      />
                      <StatCard
                        description="Failed tool calls"
                        title="Failed Calls"
                        value={summary.toolUsage.failedCalls.toLocaleString()}
                      />
                      <StatCard
                        description="Total tokens consumed"
                        title="Total Tokens"
                        value={summary.tokenUsage.totalTokens.toLocaleString()}
                      />
                    </div>
                  )}
                  <ApiUsageChart userId={userId} />
                  <CumulativeGrowthChart data={cumulativeData} />
                </>
              )}
            </div>
          )}

          {activeTab === "tools" && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-2 font-bold text-2xl">Tool Usage</h2>
                <p className="text-muted-foreground">
                  Individual tool calls for this user
                </p>
              </div>
              <DataTable<ToolCall, unknown>
                columns={toolColumns}
                defaultPageSize={10}
                enableFilters
                enableSorting
                endpoint={`/api/metrics/users/${userId}/tools`}
                pageSizeOptions={[10, 20, 50, 100]}
                searchField={{
                  label: "Tool",
                  value: "toolName",
                  placeholder: "Search tools...",
                }}
              />
            </div>
          )}

          {activeTab === "tokens" && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-2 font-bold text-2xl">Token Usage</h2>
                <p className="text-muted-foreground">
                  Individual token usage records for this user
                </p>
              </div>
              <DataTable<TokenUsageRecord, unknown>
                columns={tokenColumns}
                defaultPageSize={10}
                enableFilters
                enableSorting
                endpoint={`/api/metrics/users/${userId}/tokens`}
                pageSizeOptions={[10, 20, 50, 100]}
                searchField={{
                  label: "Model",
                  value: "modelId",
                  placeholder: "Search models...",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
