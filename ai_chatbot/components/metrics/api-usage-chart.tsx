"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type DateRange = "7d" | "14d" | "30d" | "all";

interface ApiUsageDataPoint {
  date: string;
  requests: number;
  tokens: number;
}

interface ApiUsageChartProps {
  initialData?: ApiUsageDataPoint[];
  userId?: string;
}

const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: "7d", label: "Last Week" },
  { value: "14d", label: "Last 14 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "all", label: "All Time" },
];

export function ApiUsageChart({ initialData, userId }: ApiUsageChartProps) {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [data, setData] = useState<ApiUsageDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (initialData && initialData.length > 0 && !hasLoaded) {
      setData(initialData);
      setLoading(false);
      setHasLoaded(true);
      return;
    }

    if (hasLoaded && !userId) {
      return;
    }

    const endpoint = userId
      ? `/api/metrics/users/${userId}/overview?metricType=api-usage&dateRange=${dateRange}`
      : `/api/metrics/overview?metricType=api-usage&dateRange=${dateRange}`;

    setLoading(true);
    fetch(endpoint)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((result) => {
        setData(result.data || []);
        setHasLoaded(true);
      })
      .catch((error) => {
        console.error("Failed to fetch API usage data:", error);
        setData([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [dateRange, userId, hasLoaded, initialData]);

  const handleRangeChange = (range: DateRange) => {
    setDateRange(range);
  };

  const formatYAxis = (value: number) => {
    if (value >= 1e6) {
      return `${(value / 1e6).toFixed(1)}M`;
    }
    if (value >= 1e3) {
      return `${(value / 1e3).toFixed(0)}K`;
    }
    return value.toString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>API Usage</CardTitle>
            <CardDescription>Requests and tokens over time</CardDescription>
          </div>
          <div className="flex gap-2">
            {dateRangeOptions.map((option) => (
              <Button
                key={option.value}
                onClick={() => handleRangeChange(option.value)}
                size="sm"
                variant={dateRange === option.value ? "default" : "outline"}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            Loading...
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            No data available
          </div>
        ) : (
          <ResponsiveContainer height={400} width="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient
                  id="colorApiRequests"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorApiTokens" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                }}
              />
              <YAxis
                label={{
                  value: "Requests",
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: "middle" },
                }}
                orientation="left"
                tickFormatter={formatYAxis}
                yAxisId="left"
              />
              <YAxis
                label={{
                  value: "Tokens",
                  angle: 90,
                  position: "insideRight",
                  style: { textAnchor: "middle" },
                }}
                orientation="right"
                tickFormatter={formatYAxis}
                yAxisId="right"
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload?.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] text-muted-foreground uppercase">
                              Date
                            </span>
                            <span className="font-bold text-muted-foreground">
                              {label}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] text-muted-foreground uppercase">
                              Requests
                            </span>
                            <span className="font-bold text-blue-600">
                              {payload[0]?.value?.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] text-muted-foreground uppercase">
                              Tokens
                            </span>
                            <span className="font-bold text-green-600">
                              {payload[1]?.value?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                dataKey="requests"
                fill="url(#colorApiRequests)"
                fillOpacity={1}
                name="Requests"
                stroke="#3b82f6"
                type="monotone"
                yAxisId="left"
              />
              <Area
                dataKey="tokens"
                fill="url(#colorApiTokens)"
                fillOpacity={1}
                name="Tokens"
                stroke="#10b981"
                type="monotone"
                yAxisId="right"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
