"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin-header";
import { ApiUsageChart } from "@/components/metrics/api-usage-chart";
import { CumulativeGrowthChart } from "@/components/metrics/cumulative-growth-chart";
import { StatCard } from "@/components/metrics/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

interface UserMetrics {
  userId: string;
  userEmail: string;
  toolUsage: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
  };
  tokenUsage: {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
  };
}

interface AggregatedTool {
  toolName: string;
  toolType: "base" | "mcp";
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgDurationMs: number;
}

interface TokenUsageMetric {
  id: string;
  userId: string;
  chatId: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  createdAt: string;
}

interface CumulativeDataPoint {
  date: string;
  cumulativeRequests: number;
  cumulativeTokens: number;
}

const toolColumns: ColumnDef<AggregatedTool>[] = [
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
    accessorKey: "totalCalls",
    header: "Total Calls",
    sortDescFirst: true,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">
        {row.getValue<number>("totalCalls").toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "successfulCalls",
    header: "Successful",
    sortDescFirst: true,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="font-mono text-emerald-600 tabular-nums dark:text-emerald-400">
        {row.getValue<number>("successfulCalls").toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "failedCalls",
    header: "Failed",
    sortDescFirst: true,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="font-mono text-red-600 tabular-nums dark:text-red-400">
        {row.getValue<number>("failedCalls").toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "avgDurationMs",
    header: "Avg Duration (ms)",
    sortDescFirst: true,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="font-mono text-muted-foreground tabular-nums">
        {Number(row.getValue("avgDurationMs")).toFixed(2)}
      </span>
    ),
  },
];

const tokenColumns: ColumnDef<TokenUsageMetric>[] = [
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

const userColumns: ColumnDef<UserMetrics>[] = [
  {
    accessorKey: "userEmail",
    header: "User",
    cell: ({ row }) => {
      const router = useRouter();
      return (
        <button
          className="cursor-pointer font-medium text-primary hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/admin/metrics/users/${row.original.userId}`);
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            textAlign: "left",
          }}
          type="button"
        >
          {row.getValue("userEmail")}
        </button>
      );
    },
  },
  {
    accessorKey: "toolUsage.totalCalls",
    header: "Tool Calls",
    id: "toolUsage.totalCalls",
    sortDescFirst: true,
    meta: { align: "right" },
    cell: ({ row }) => {
      const toolUsage = row.original.toolUsage;
      return (
        <span className="font-mono tabular-nums">
          {toolUsage.totalCalls.toLocaleString()}
        </span>
      );
    },
  },
  {
    accessorKey: "toolUsage.successfulCalls",
    header: "Success Rate",
    id: "toolUsage.successfulCalls",
    sortDescFirst: true,
    meta: { align: "right" },
    cell: ({ row }) => {
      const toolUsage = row.original.toolUsage;
      const successRate =
        toolUsage.totalCalls > 0
          ? ((toolUsage.successfulCalls / toolUsage.totalCalls) * 100).toFixed(
              1
            )
          : "0.0";

      const getColor = (rate: number) => {
        if (rate >= 90) {
          return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
        }
        if (rate >= 70) {
          return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
        }
        return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400";
      };

      const rate = Number.parseFloat(successRate);
      const colorClass = getColor(rate);

      return (
        <Badge
          className={`font-mono tabular-nums ${colorClass}`}
          variant="outline"
        >
          {successRate}%
        </Badge>
      );
    },
  },
  {
    accessorKey: "tokenUsage.totalTokens",
    header: "Total Tokens",
    id: "tokenUsage.totalTokens",
    sortDescFirst: true,
    meta: { align: "right" },
    cell: ({ row }) => {
      const tokenUsage = row.original.tokenUsage;
      return (
        <span className="font-mono font-semibold tabular-nums">
          {tokenUsage.totalTokens.toLocaleString()}
        </span>
      );
    },
  },
  {
    accessorKey: "tokenUsage.totalInputTokens",
    header: "Input Tokens",
    id: "tokenUsage.totalInputTokens",
    sortDescFirst: true,
    meta: { align: "right" },
    cell: ({ row }) => {
      const tokenUsage = row.original.tokenUsage;
      return (
        <span className="font-mono text-muted-foreground tabular-nums">
          {tokenUsage.totalInputTokens.toLocaleString()}
        </span>
      );
    },
  },
  {
    accessorKey: "tokenUsage.totalOutputTokens",
    header: "Output Tokens",
    id: "tokenUsage.totalOutputTokens",
    sortDescFirst: true,
    meta: { align: "right" },
    cell: ({ row }) => {
      const tokenUsage = row.original.tokenUsage;
      return (
        <span className="font-mono text-muted-foreground tabular-nums">
          {tokenUsage.totalOutputTokens.toLocaleString()}
        </span>
      );
    },
  },
];

interface OverviewSummary {
  totalRequests: number;
  totalTokens: number;
  totalUsers: number;
  successRate: number;
}

export default function AdminMetricsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab =
    (searchParams.get("tab") as "overview" | "tools" | "tokens" | "users") ||
    "overview";
  const [cumulativeData, setCumulativeData] = useState<CumulativeDataPoint[]>(
    []
  );
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [summary, setSummary] = useState<OverviewSummary | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "overview") {
      setOverviewLoading(true);
      setOverviewError(null);

      Promise.all([
        fetch("/api/metrics/overview?metricType=cumulative"),
        fetch("/api/metrics/overview?metricType=summary"),
      ])
        .then(async ([cumulativeRes, summaryRes]) => {
          // Handle 403 Forbidden - user doesn't have access
          if (cumulativeRes.status === 403 || summaryRes.status === 403) {
            setOverviewError("You don't have permission to view these metrics");
            return;
          }

          // Handle other errors
          if (!cumulativeRes.ok) {
            throw new Error("Failed to fetch cumulative data");
          }
          if (!summaryRes.ok) {
            throw new Error("Failed to fetch summary data");
          }

          const [cumulativeData, summaryData] = await Promise.all([
            cumulativeRes.json(),
            summaryRes.json(),
          ]);

          setCumulativeData(cumulativeData.data || []);
          setSummary(summaryData);
        })
        .catch((error) => {
          console.error("Failed to fetch overview metrics:", error);
          setOverviewError(
            error instanceof Error ? error.message : "Failed to load metrics"
          );
        })
        .finally(() => {
          setOverviewLoading(false);
        });
    }
  }, [activeTab]);

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex h-dvh flex-col">
      <AdminHeader />
      <div className="flex-1 overflow-auto bg-background p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-8 font-bold text-4xl">Metrics Dashboard</h1>

          <div className="mb-6 flex gap-4">
            <Button
              onClick={() => handleTabChange("overview")}
              variant={activeTab === "overview" ? "default" : "outline"}
            >
              Overview
            </Button>
            <Button
              onClick={() => handleTabChange("tools")}
              variant={activeTab === "tools" ? "default" : "outline"}
            >
              Tool Usage
            </Button>
            <Button
              onClick={() => handleTabChange("tokens")}
              variant={activeTab === "tokens" ? "default" : "outline"}
            >
              Token Usage
            </Button>
            <Button
              onClick={() => handleTabChange("users")}
              variant={activeTab === "users" ? "default" : "outline"}
            >
              Users
            </Button>
          </div>

          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-2 font-bold text-2xl">Overview</h2>
                <p className="text-muted-foreground">
                  API usage and cumulative growth metrics
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
                      Please make sure you are logged in
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {summary && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <StatCard
                        description="All-time API calls"
                        title="Total Requests"
                        value={summary.totalRequests.toLocaleString()}
                      />
                      <StatCard
                        description="All-time token usage"
                        title="Total Tokens"
                        value={summary.totalTokens.toLocaleString()}
                      />
                      <StatCard
                        description="Users with API activity"
                        title="Active Users"
                        value={summary.totalUsers.toLocaleString()}
                      />
                      <StatCard
                        description="Tool call success rate"
                        title="Success Rate"
                        value={`${summary.successRate}%`}
                      />
                    </div>
                  )}
                  <ApiUsageChart />
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
                  Aggregated tool usage statistics
                </p>
              </div>
              <DataTable<AggregatedTool, unknown>
                columns={toolColumns}
                defaultPageSize={10}
                enableFilters
                enableSorting
                endpoint="/api/metrics/tools"
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
                <h2 className="mb-2 font-bold text-2xl">
                  Token Usage (API Calls)
                </h2>
                <p className="text-muted-foreground">
                  Individual token usage API calls
                </p>
              </div>
              <DataTable<TokenUsageMetric, unknown>
                columns={tokenColumns}
                defaultPageSize={10}
                enableFilters
                enableSorting
                endpoint="/api/metrics/tokens"
                pageSizeOptions={[10, 20, 50, 100]}
                searchField={{
                  label: "Model",
                  value: "modelId",
                  placeholder: "Search models...",
                }}
              />
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-2 font-bold text-2xl">
                  User Usage Analytics
                </h2>
                <p className="text-muted-foreground">
                  Token and tool usage breakdown by user
                </p>
              </div>
              <DataTable<UserMetrics, unknown>
                columns={userColumns}
                defaultPageSize={10}
                enableFilters
                enableSorting
                endpoint="/api/metrics/users"
                pageSizeOptions={[10, 20, 50, 100]}
                searchField={{
                  label: "User Email",
                  value: "userEmail",
                  placeholder: "Search by email...",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
