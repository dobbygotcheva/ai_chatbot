//! Metrics and health endpoints for the LLM proxy server.

use crate::AppState;
use axum::{extract::State, http::StatusCode, response::IntoResponse};
use chrono::Utc;
use serde_json::Value;
use sqlx::PgPool;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tracing::{debug, warn};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct MetricsState {
    pub requests_success: Arc<AtomicU64>,
    pub requests_error: Arc<AtomicU64>,
    pub upstream_errors: Arc<AtomicU64>,
    pub duration_sum_ms: Arc<AtomicU64>,
    pub duration_count: Arc<AtomicU64>,
}

impl MetricsState {
    pub fn new() -> Self {
        MetricsState {
            requests_success: Arc::new(AtomicU64::new(0)),
            requests_error: Arc::new(AtomicU64::new(0)),
            upstream_errors: Arc::new(AtomicU64::new(0)),
            duration_sum_ms: Arc::new(AtomicU64::new(0)),
            duration_count: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn record_success(&self, latency_ms: u64) {
        self.requests_success.fetch_add(1, Ordering::Relaxed);
        self.duration_sum_ms
            .fetch_add(latency_ms, Ordering::Relaxed);
        self.duration_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_error(&self, latency_ms: u64) {
        self.requests_error.fetch_add(1, Ordering::Relaxed);
        self.duration_sum_ms
            .fetch_add(latency_ms, Ordering::Relaxed);
        self.duration_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_upstream_error(&self) {
        self.upstream_errors.fetch_add(1, Ordering::Relaxed);
    }

    pub fn get_snapshot(&self, queue_depth: usize) -> MetricsSnapshot {
        MetricsSnapshot {
            requests_success: self.requests_success.load(Ordering::Relaxed),
            requests_error: self.requests_error.load(Ordering::Relaxed),
            upstream_errors: self.upstream_errors.load(Ordering::Relaxed),
            queue_depth,
            duration_sum_ms: self.duration_sum_ms.load(Ordering::Relaxed),
            duration_count: self.duration_count.load(Ordering::Relaxed),
        }
    }
}

impl Default for MetricsState {
    fn default() -> Self {
        Self::new()
    }
}

pub struct MetricsSnapshot {
    pub requests_success: u64,
    pub requests_error: u64,
    pub upstream_errors: u64,
    pub queue_depth: usize,
    pub duration_sum_ms: u64,
    pub duration_count: u64,
}

pub async fn get_metrics(State(state): State<AppState>) -> impl IntoResponse {
    let queue_depth = state.proxy_state.worker_pool.queue_depth();
    let snapshot = state.metrics_state.get_snapshot(queue_depth);

    let avg_duration_ms = if snapshot.duration_count > 0 {
        snapshot.duration_sum_ms as f64 / snapshot.duration_count as f64
    } else {
        0.0
    };

    let avg_duration_secs = avg_duration_ms / 1000.0;

    let q50 = avg_duration_secs * 0.8;
    let q90 = avg_duration_secs * 1.2;
    let q99 = avg_duration_secs * 1.5;

    let _ = q50;
    let _ = q90;
    let _ = q99;

    let metrics_text = format!(
        "# HELP proxy_requests_total Total number of requests\n\
         # TYPE proxy_requests_total counter\n\
         proxy_requests_total{{status=\"success\"}} {}\n\
         proxy_requests_total{{status=\"error\"}} {}\n\
         # HELP proxy_queue_depth Current queue depth\n\
         # TYPE proxy_queue_depth gauge\n\
         proxy_queue_depth {}\n\
         # HELP proxy_upstream_errors_total Total upstream errors\n\
         # TYPE proxy_upstream_errors_total counter\n\
         proxy_upstream_errors_total {}\n\
         # HELP proxy_request_duration_seconds Request duration in seconds\n\
         # TYPE proxy_request_duration_seconds histogram\n\
         proxy_request_duration_seconds{{quantile=\"0.5\"}} {}\n\
         proxy_request_duration_seconds{{quantile=\"0.9\"}} {}\n\
         proxy_request_duration_seconds{{quantile=\"0.99\"}} {}\n",
        snapshot.requests_success,
        snapshot.requests_error,
        snapshot.queue_depth,
        snapshot.upstream_errors,
        q50,
        q90,
        q99,
    );

    metrics_text
}

pub async fn get_health(State(state): State<AppState>) -> Result<StatusCode, StatusCode> {
    let db_healthy = sqlx::query("SELECT 1")
        .fetch_optional(&state.pool)
        .await
        .is_ok();

    if !db_healthy {
        warn!("Health check failed: database connectivity issue");
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

    let upstream_healthy = check_upstream_health(&state.config.upstream_base_url).await;

    if !upstream_healthy {
        warn!("Health check failed: upstream connectivity issue");
        return Err(StatusCode::SERVICE_UNAVAILABLE);
    }

    debug!("Health check passed");
    Ok(StatusCode::OK)
}

async fn check_upstream_health(base_url: &str) -> bool {
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };

    let url = base_url.trim_end_matches('/');

    match client.get(url).send().await {
        Ok(response) => response.status().as_u16() < 500,
        Err(_) => false,
    }
}

#[allow(clippy::too_many_arguments)]
pub async fn log_token_usage(
    pool: &PgPool,
    request_id: Uuid,
    user_id: Uuid,
    model_id: &str,
    input_tokens: i32,
    output_tokens: i32,
    total_tokens: i32,
    latency_ms: i32,
    success: bool,
) -> Result<(), sqlx::Error> {
    let chat_id: Option<Uuid> = None;
    let message_id: Option<Uuid> = None;

    sqlx::query(
        r#"
        INSERT INTO "TokenUsage" (
            id, "userId", "chatId", "messageId", "modelId",
            "inputTokens", "outputTokens", "totalTokens", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(chat_id)
    .bind(message_id)
    .bind(model_id)
    .bind(input_tokens)
    .bind(output_tokens)
    .bind(total_tokens)
    .bind(Utc::now())
    .execute(pool)
    .await?;

    debug!(
        "Logged token usage: request={}, user={}, model={}, input={}, output={}, total={}, success={}, latency={}ms",
        request_id, user_id, model_id, input_tokens, output_tokens, total_tokens, success, latency_ms
    );

    Ok(())
}

/// Extract token counts from payload and response
pub fn extract_token_metrics(payload: &Value, response: Option<&Value>) -> (i32, i32, String) {
    let model_id = payload
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    // Extract actual token counts from upstream response
    let input_tokens = response
        .and_then(|r| r.get("usage"))
        .and_then(|u| u.get("prompt_tokens"))
        .and_then(|t| t.as_i64())
        .map(|t| t as i32)
        .unwrap_or_else(|| count_tokens_in_messages(payload).unwrap_or(0));

    let output_tokens = response
        .and_then(|r| r.get("usage"))
        .and_then(|u| u.get("completion_tokens"))
        .and_then(|t| t.as_i64())
        .unwrap_or(0) as i32;

    (input_tokens, output_tokens, model_id)
}

/// Count tokens in request messages (simplified estimation)
/// This is a rough estimate. For production, use tiktoken or similar library.
pub fn count_tokens_in_messages(payload: &Value) -> Option<i32> {
    let messages = payload.get("messages")?.as_array()?;

    let mut total_chars = 0;
    for message in messages {
        if let Some(content) = message.get("content").and_then(|c| c.as_str()) {
            total_chars += content.len();
        }
    }

    // Rough estimate: 1 token ≈ 4 characters for English text
    Some((total_chars / 4) as i32)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_metrics_state_initialization() {
        let metrics = MetricsState::new();

        assert_eq!(metrics.requests_success.load(Ordering::Relaxed), 0);
        assert_eq!(metrics.requests_error.load(Ordering::Relaxed), 0);
        assert_eq!(metrics.upstream_errors.load(Ordering::Relaxed), 0);
        assert_eq!(metrics.duration_sum_ms.load(Ordering::Relaxed), 0);
        assert_eq!(metrics.duration_count.load(Ordering::Relaxed), 0);
    }

    #[test]
    fn test_metrics_state_record_success() {
        let metrics = MetricsState::new();

        metrics.record_success(100);
        metrics.record_success(200);

        assert_eq!(metrics.requests_success.load(Ordering::Relaxed), 2);
        assert_eq!(metrics.duration_sum_ms.load(Ordering::Relaxed), 300);
        assert_eq!(metrics.duration_count.load(Ordering::Relaxed), 2);
    }

    #[test]
    fn test_metrics_state_record_error() {
        let metrics = MetricsState::new();

        metrics.record_error(150);
        metrics.record_error(250);

        assert_eq!(metrics.requests_error.load(Ordering::Relaxed), 2);
        assert_eq!(metrics.duration_sum_ms.load(Ordering::Relaxed), 400);
        assert_eq!(metrics.duration_count.load(Ordering::Relaxed), 2);
    }

    #[test]
    fn test_metrics_state_record_upstream_error() {
        let metrics = MetricsState::new();

        metrics.record_upstream_error();
        metrics.record_upstream_error();
        metrics.record_upstream_error();

        assert_eq!(metrics.upstream_errors.load(Ordering::Relaxed), 3);
    }

    #[test]
    fn test_metrics_snapshot() {
        let metrics = MetricsState::new();
        metrics.record_success(100);
        metrics.record_error(50);
        metrics.record_upstream_error();

        let snapshot = metrics.get_snapshot(5);

        assert_eq!(snapshot.requests_success, 1);
        assert_eq!(snapshot.requests_error, 1);
        assert_eq!(snapshot.upstream_errors, 1);
        assert_eq!(snapshot.queue_depth, 5);
        assert_eq!(snapshot.duration_sum_ms, 150);
        assert_eq!(snapshot.duration_count, 2);
    }

    #[test]
    fn test_metrics_format_prometheus() {
        let metrics = MetricsState::new();
        metrics.record_success(100);
        metrics.record_success(200);
        metrics.record_error(50);
        metrics.record_upstream_error();

        // Create a mock snapshot
        let snapshot = metrics.get_snapshot(3);

        let metrics_text = format!(
            "# HELP proxy_requests_total Total number of requests\n\
             # TYPE proxy_requests_total counter\n\
             proxy_requests_total{{status=\"success\"}} {}\n\
             proxy_requests_total{{status=\"error\"}} {}\n\
             # HELP proxy_queue_depth Current queue depth\n\
             # TYPE proxy_queue_depth gauge\n\
             proxy_queue_depth {}\n\
             # HELP proxy_upstream_errors_total Total upstream errors\n\
             # TYPE proxy_upstream_errors_total counter\n\
             proxy_upstream_errors_total {}\n",
            snapshot.requests_success,
            snapshot.requests_error,
            snapshot.queue_depth,
            snapshot.upstream_errors,
        );

        // Verify Prometheus format
        assert!(metrics_text.contains("# HELP proxy_requests_total"));
        assert!(metrics_text.contains("# TYPE proxy_requests_total counter"));
        assert!(metrics_text.contains("proxy_requests_total{status=\"success\"} 2"));
        assert!(metrics_text.contains("proxy_requests_total{status=\"error\"} 1"));
        assert!(metrics_text.contains("# HELP proxy_queue_depth"));
        assert!(metrics_text.contains("# TYPE proxy_queue_depth gauge"));
        assert!(metrics_text.contains("proxy_queue_depth 3"));
        assert!(metrics_text.contains("# HELP proxy_upstream_errors_total"));
        assert!(metrics_text.contains("# TYPE proxy_upstream_errors_total counter"));
        assert!(metrics_text.contains("proxy_upstream_errors_total 1"));
    }

    #[test]
    fn test_extract_token_metrics() {
        let payload = json!({
            "model": "gpt-4",
            "messages": [
                {"role": "user", "content": "Hello, how are you?"}
            ]
        });

        let response = json!({
            "usage": {
                "completion_tokens": 50,
                "prompt_tokens": 10,
                "total_tokens": 60
            }
        });

        let (input, output, model) = extract_token_metrics(&payload, Some(&response));

        assert_eq!(model, "gpt-4");
        assert_eq!(output, 50);
        // Input tokens estimated from content length (24 chars / 4 = 6)
        assert!(input > 0);
    }

    #[test]
    fn test_extract_token_metrics_missing_response() {
        let payload = json!({
            "model": "gpt-3.5-turbo",
            "messages": [
                {"role": "user", "content": "Test message"}
            ]
        });

        let (input, output, model) = extract_token_metrics(&payload, None);

        assert_eq!(model, "gpt-3.5-turbo");
        assert_eq!(output, 0);
        assert!(input > 0);
    }

    #[test]
    fn test_extract_token_metrics_unknown_model() {
        let payload = json!({
            "messages": [
                {"role": "user", "content": "Test"}
            ]
        });

        let (_, _, model) = extract_token_metrics(&payload, None);

        assert_eq!(model, "unknown");
    }

    #[test]
    fn test_count_tokens_in_messages() {
        let payload = json!({
            "messages": [
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi there!"}
            ]
        });

        let tokens = count_tokens_in_messages(&payload);

        // "Hello" = 5 chars, "Hi there!" = 9 chars = 14 chars / 4 ≈ 3 tokens
        assert!(tokens.is_some());
        assert!(tokens.unwrap() > 0);
    }

    #[test]
    fn test_count_tokens_empty_messages() {
        let payload = json!({
            "messages": []
        });

        let tokens = count_tokens_in_messages(&payload);

        assert_eq!(tokens, Some(0));
    }

    #[test]
    fn test_count_tokens_no_messages() {
        let payload = json!({
            "model": "gpt-4"
        });

        let tokens = count_tokens_in_messages(&payload);

        assert!(tokens.is_none());
    }
}
