import { describe, expect, it } from "vitest";

const BASE_URL =
  process.env.CODE_EXECUTION_SERVICE_URL || "http://localhost:5001";

interface ExecutionResult {
  status?: number;
  ok?: boolean;
  error?: string;
  durationMs?: number;
  timestamp?: number;
}

interface LoadTestMetrics {
  totalRequests: number;
  successCount: number;
  rateLimitedCount: number;
  errorCount: number;
  serverErrorCount: number;
  successRate: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

async function executeCode(): Promise<ExecutionResult> {
  const startTime = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "print('Hello')",
        language: "python",
        timeout: 30000,
      }),
    });
    const duration = Date.now() - startTime;
    return {
      status: res.status,
      ok: res.ok,
      durationMs: duration,
      timestamp: startTime,
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    return {
      error: (err as Error).message,
      durationMs: duration,
      timestamp: startTime,
    };
  }
}

function calculateMetrics(
  results: ExecutionResult[],
  _concurrency: number,
): LoadTestMetrics {
  const successCount = results.filter((r) => r.ok).length;
  const rateLimitedCount = results.filter((r) => r.status === 429).length;
  const serverErrorCount = results.filter((r) => r.status === 500).length;
  const errorCount = results.filter((r) => r.error).length;
  const latencies = results
    .filter(
      (r): r is ExecutionResult & { durationMs: number } =>
        r.durationMs !== undefined,
    )
    .map((r) => r.durationMs);

  latencies.sort((a, b) => a - b);

  const p95Index = Math.floor(latencies.length * 0.95);
  const p99Index = Math.floor(latencies.length * 0.99);

  return {
    totalRequests: results.length,
    successCount,
    rateLimitedCount,
    errorCount,
    serverErrorCount,
    successRate: (successCount / results.length) * 100,
    avgLatencyMs:
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0,
    minLatencyMs: latencies.length > 0 ? Math.min(...latencies) : 0,
    maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,
    p95LatencyMs: latencies.length > 0 ? latencies[p95Index] || 0 : 0,
    p99LatencyMs: latencies.length > 0 ? latencies[p99Index] || 0 : 0,
  };
}

function printMetrics(
  metrics: LoadTestMetrics,
  concurrency: number,
  testName: string,
): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${testName} - ${concurrency} Concurrent Requests`);
  console.log("=".repeat(60));
  console.log(`Total Requests:     ${metrics.totalRequests}`);
  console.log(
    `Success:            ${metrics.successCount} (${metrics.successRate.toFixed(1)}%)`,
  );
  console.log(`Rate Limited (429): ${metrics.rateLimitedCount}`);
  console.log(`Server Errors:      ${metrics.serverErrorCount}`);
  console.log(`Other Errors:       ${metrics.errorCount}`);
  console.log(`\nLatency (ms):`);
  console.log(`  Average:  ${metrics.avgLatencyMs}`);
  console.log(`  Min:      ${metrics.minLatencyMs}`);
  console.log(`  Max:      ${metrics.maxLatencyMs}`);
  console.log(`  P95:      ${metrics.p95LatencyMs}`);
  console.log(`  P99:      ${metrics.p99LatencyMs}`);
  console.log("=".repeat(60));
}

describe("Load Testing - Code Execution Service", () => {
  it("should handle 10 concurrent executions with 100% success", async () => {
    const results: ExecutionResult[] = [];
    const promises: Promise<void>[] = [];

    for (let i = 0; i < 10; i++) {
      promises.push(
        executeCode().then((res) => {
          results.push(res);
        }),
      );
    }

    await Promise.all(promises);

    const metrics = calculateMetrics(results, 10);
    printMetrics(metrics, 10, "Light Load Test");

    expect(metrics.successCount).toBe(10);
    expect(metrics.successRate).toBe(100);
    expect(metrics.serverErrorCount).toBe(0);
  }, 120000);

  it("should handle 50 concurrent executions with >95% success", async () => {
    const results: ExecutionResult[] = [];
    const promises: Promise<unknown>[] = [];

    for (let i = 0; i < 50; i++) {
      promises.push(
        executeCode().then((res) => {
          results.push(res);
        }),
      );
    }

    await Promise.all(promises);

    const metrics = calculateMetrics(results, 50);
    printMetrics(metrics, 50, "Medium Load Test");

    expect(metrics.successCount).toBeGreaterThan(47);
    expect(metrics.successRate).toBeGreaterThan(95);
    expect(metrics.serverErrorCount).toBe(0);
  }, 180000);

  it("should rate limit at 100 concurrent requests", async () => {
    const results: ExecutionResult[] = [];
    const promises: Promise<unknown>[] = [];

    for (let i = 0; i < 100; i++) {
      promises.push(
        executeCode().then((res) => {
          results.push(res);
        }),
      );
    }

    await Promise.all(promises);

    const metrics = calculateMetrics(results, 100);
    printMetrics(metrics, 100, "Heavy Load Test");

    expect(metrics.rateLimitedCount).toBeGreaterThan(0);
    expect(metrics.serverErrorCount).toBe(0);
  }, 300000);

  it("should degrade gracefully under load (no crashes)", async () => {
    const results: ExecutionResult[] = [];
    const promises: Promise<unknown>[] = [];

    for (let i = 0; i < 50; i++) {
      promises.push(
        executeCode().then((res) => {
          results.push(res);
        }),
      );
    }

    await Promise.all(promises);

    const metrics = calculateMetrics(results, 50);

    console.log(`\nGraceful Degradation Test:`);
    console.log(`  Server Errors (500): ${metrics.serverErrorCount}/50`);
    console.log(`  Connection Errors: ${metrics.errorCount}/50`);

    expect(metrics.serverErrorCount).toBe(0);
  }, 180000);

  it("should verify queue management (requests queued, not dropped)", async () => {
    const results: ExecutionResult[] = [];
    const startTime = Date.now();
    const promises: Promise<unknown>[] = [];

    for (let i = 0; i < 20; i++) {
      promises.push(
        executeCode().then((res) => {
          results.push(res);
        }),
      );
    }

    await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    const metrics = calculateMetrics(results, 20);

    console.log(`\nQueue Management Test:`);
    console.log(`  Total time: ${totalTime}ms`);
    console.log(`  Avg latency: ${metrics.avgLatencyMs}ms`);
    console.log(`  Max latency: ${metrics.maxLatencyMs}ms`);
    console.log(`  Requests completed: ${metrics.totalRequests}/20`);

    expect(metrics.totalRequests).toBe(20);
    expect(metrics.errorCount).toBe(0);
  }, 120000);
});
