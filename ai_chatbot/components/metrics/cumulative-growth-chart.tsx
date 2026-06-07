"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CumulativeDataPoint {
  date: string;
  cumulativeRequests: number;
  cumulativeTokens: number;
}

interface CumulativeGrowthChartProps {
  data: CumulativeDataPoint[];
}

const MILLION = 1e6;
const THOUSAND = 1e3;

export function CumulativeGrowthChart({ data }: CumulativeGrowthChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cumulative Growth</CardTitle>
          <CardDescription>Total requests and tokens over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatYAxis = (value: number) => {
    if (value >= MILLION) {
      return `${(value / MILLION).toFixed(1)}M`;
    }
    if (value >= THOUSAND) {
      return `${(value / THOUSAND).toFixed(0)}K`;
    }
    return value.toString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cumulative Growth</CardTitle>
        <CardDescription>
          Total requests and tokens accumulated over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer height={400} width="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorRequests" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorTokens" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
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
                          <span className="font-bold text-purple-600">
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
              dataKey="cumulativeRequests"
              fill="url(#colorRequests)"
              fillOpacity={1}
              name="Requests"
              stroke="#8884d8"
              type="monotone"
              yAxisId="left"
            />
            <Area
              dataKey="cumulativeTokens"
              fill="url(#colorTokens)"
              fillOpacity={1}
              name="Tokens"
              stroke="#82ca9d"
              type="monotone"
              yAxisId="right"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
