import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

export interface UserMetricsRow {
  userId: string;
  userEmail: string;
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
}

export const userMetricsColumns: ColumnDef<UserMetricsRow>[] = [
  {
    accessorKey: "userEmail",
    header: "User",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("userEmail")}</div>
    ),
  },
  {
    accessorKey: "toolUsage.totalCalls",
    header: "Tool Calls",
    id: "toolUsage.totalCalls",
    cell: ({ row }) => {
      const toolUsage = row.original.toolUsage;
      return (
        <div className="text-right">
          {toolUsage.totalCalls.toLocaleString()}
        </div>
      );
    },
  },
  {
    accessorKey: "toolUsage.successfulCalls",
    header: "Success Rate",
    id: "toolUsage.successfulCalls",
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
          return "bg-green-100 text-green-800";
        }
        if (rate >= 70) {
          return "bg-yellow-100 text-yellow-800";
        }
        return "bg-red-100 text-red-800";
      };

      const rate = Number.parseFloat(successRate);
      const colorClass = getColor(rate);

      return (
        <Badge className={colorClass} variant="outline">
          {successRate}%
        </Badge>
      );
    },
  },
  {
    accessorKey: "tokenUsage.totalTokens",
    header: "Total Tokens",
    id: "tokenUsage.totalTokens",
    cell: ({ row }) => {
      const tokenUsage = row.original.tokenUsage;
      return (
        <div className="text-right font-bold">
          {tokenUsage.totalTokens.toLocaleString()}
        </div>
      );
    },
  },
  {
    accessorKey: "tokenUsage.totalInputTokens",
    header: "Input Tokens",
    id: "tokenUsage.totalInputTokens",
    cell: ({ row }) => {
      const tokenUsage = row.original.tokenUsage;
      return (
        <div className="text-right">
          {tokenUsage.totalInputTokens.toLocaleString()}
        </div>
      );
    },
  },
  {
    accessorKey: "tokenUsage.totalOutputTokens",
    header: "Output Tokens",
    id: "tokenUsage.totalOutputTokens",
    cell: ({ row }) => {
      const tokenUsage = row.original.tokenUsage;
      return (
        <div className="text-right">
          {tokenUsage.totalOutputTokens.toLocaleString()}
        </div>
      );
    },
  },
  {
    accessorKey: "toolUsage.avgDurationMs",
    header: "Avg Duration",
    id: "toolUsage.avgDurationMs",
    cell: ({ row }) => {
      const toolUsage = row.original.toolUsage;
      return (
        <div className="text-right">
          {toolUsage.avgDurationMs.toFixed(2)} ms
        </div>
      );
    },
  },
];
