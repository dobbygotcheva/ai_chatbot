interface Metrics {
  execution_count: number;
  success_count: number;
  error_count: number;
  total_duration_ms: number;
  language_counts: Record<string, number>;
}

class MetricsCollector {
  private metrics: Metrics = {
    execution_count: 0,
    success_count: 0,
    error_count: 0,
    total_duration_ms: 0,
    language_counts: {},
  };

  recordExecution(language: string, duration_ms: number, success: boolean) {
    this.metrics.execution_count++;
    if (success) this.metrics.success_count++;
    else this.metrics.error_count++;
    this.metrics.total_duration_ms += duration_ms;
    this.metrics.language_counts[language] =
      (this.metrics.language_counts[language] || 0) + 1;
  }

  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  getAvgDuration(): number {
    return this.metrics.execution_count > 0
      ? this.metrics.total_duration_ms / this.metrics.execution_count
      : 0;
  }
}

export const metrics = new MetricsCollector();
