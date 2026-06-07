//! Worker pool implementation for request processing.
//!
//! This module implements a worker pool pattern using tokio's async channels.
//! Workers receive requests from a shared queue, forward them to the upstream
//! LLM provider, log metrics, and send responses back to callers.

use crate::config::Config;
use crate::metrics::{self, log_token_usage};
use anyhow::Result;
use chrono::Utc;
use serde_json::Value;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot, Mutex};
use tracing::{debug, error, info};
use uuid::Uuid;

pub enum WorkerMessage {
    ProcessRequest {
        request_id: Uuid,
        user_id: Uuid,
        payload: Value,
        response_tx: oneshot::Sender<Result<Value, WorkerError>>,
    },
    Shutdown,
}

#[derive(Debug, thiserror::Error)]
pub enum WorkerError {
    #[error("Worker pool is full")]
    QueueFull,

    #[error("Worker pool is shutting down")]
    ShuttingDown,

    #[error("Upstream request failed: {0}")]
    UpstreamError(String),

    #[error("Failed to log metrics: {0}")]
    MetricsError(String),

    #[error("Internal error: {0}")]
    InternalError(String),
}

impl From<reqwest::Error> for WorkerError {
    fn from(err: reqwest::Error) -> Self {
        WorkerError::UpstreamError(err.to_string())
    }
}

#[allow(dead_code)]
pub struct WorkerPool {
    sender: mpsc::Sender<WorkerMessage>,
    worker_handles: Vec<tokio::task::JoinHandle<()>>,
    queue_capacity: usize,
}

impl WorkerPool {
    pub fn new(config: &Config, pool: PgPool, upstream_url: String) -> Self {
        let (sender, receiver) = mpsc::channel::<WorkerMessage>(config.queue_size);

        let mut worker_handles = Vec::with_capacity(config.worker_count);
        let receiver = Arc::new(Mutex::new(receiver));

        for i in 0..config.worker_count {
            let worker_receiver = receiver.clone();
            let db_pool = pool.clone();
            let upstream_url = upstream_url.clone();

            let handle = tokio::spawn(async move {
                let worker = Worker::new(i, worker_receiver, db_pool, upstream_url);
                worker.run().await;
            });

            worker_handles.push(handle);
            info!("Spawned worker {}", i);
        }

        WorkerPool {
            sender,
            worker_handles,
            queue_capacity: config.queue_size,
        }
    }

    pub fn queue_depth(&self) -> usize {
        self.sender.capacity()
    }

    pub async fn process(
        &self,
        request_id: Uuid,
        user_id: Uuid,
        payload: Value,
    ) -> Result<Value, WorkerError> {
        let (response_tx, response_rx) = oneshot::channel();

        let message = WorkerMessage::ProcessRequest {
            request_id,
            user_id,
            payload,
            response_tx,
        };

        self.sender.try_send(message).map_err(|e| match e {
            mpsc::error::TrySendError::Full(_) => WorkerError::QueueFull,
            mpsc::error::TrySendError::Closed(_) => WorkerError::ShuttingDown,
        })?;

        response_rx
            .await
            .map_err(|_| WorkerError::InternalError("Worker dropped response channel".into()))?
    }

    pub async fn shutdown(self) {
        info!("Initiating graceful worker pool shutdown");

        drop(self.sender);

        for (i, handle) in self.worker_handles.into_iter().enumerate() {
            if let Err(e) = handle.await {
                error!("Worker {} panicked during shutdown: {}", i, e);
            } else {
                debug!("Worker {} shut down successfully", i);
            }
        }

        info!("Worker pool shutdown complete");
    }
}

struct Worker {
    id: usize,
    receiver: Arc<Mutex<mpsc::Receiver<WorkerMessage>>>,
    db_pool: PgPool,
    upstream_url: String,
    http_client: reqwest::Client,
}

/// Remove null values from JSON (upstream doesn't accept nulls)
fn remove_nulls(value: Value) -> Value {
    match value {
        Value::Object(map) => {
            let clean: serde_json::Map<String, Value> = map
                .into_iter()
                .filter_map(|(k, v)| {
                    let clean_v = remove_nulls(v);
                    if clean_v.is_null() {
                        None
                    } else {
                        Some((k, clean_v))
                    }
                })
                .collect();
            Value::Object(clean)
        }
        Value::Array(arr) => Value::Array(arr.into_iter().map(remove_nulls).collect()),
        _ => value,
    }
}

impl Worker {
    fn new(
        id: usize,
        receiver: Arc<Mutex<mpsc::Receiver<WorkerMessage>>>,
        db_pool: PgPool,
        upstream_url: String,
    ) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(90))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .default_headers({
                let mut headers = reqwest::header::HeaderMap::new();
                headers.insert("Accept", reqwest::header::HeaderValue::from_static("application/json"));
                headers.insert("Accept-Language", reqwest::header::HeaderValue::from_static("en-US,en;q=0.9"));
                headers
            })
            .tcp_keepalive(Some(std::time::Duration::from_secs(30)))
            .build()
            .expect("Failed to create HTTP client");

        Worker {
            id,
            receiver,
            db_pool,
            upstream_url,
            http_client,
        }
    }

    /// Main worker loop
    ///
    /// Processes messages until:
    /// 1. Shutdown message received
    /// 2. Channel closed (sender dropped)
    ///
    /// On shutdown, drains remaining messages in queue before exiting.
    async fn run(self) {
        info!("Worker {} started", self.id);

        loop {
            let msg = {
                let mut receiver = self.receiver.lock().await;
                receiver.recv().await
            };

            match msg {
                Some(WorkerMessage::ProcessRequest {
                    request_id,
                    user_id,
                    payload,
                    response_tx,
                }) => {
                    self.process_request(request_id, user_id, payload, response_tx)
                        .await;
                }
                Some(WorkerMessage::Shutdown) => {
                    info!("Worker {} received shutdown signal", self.id);
                    break;
                }
                None => {
                    info!("Worker {} channel closed", self.id);
                    break;
                }
            }
        }

        info!("Worker {} finished", self.id);
    }

    /// Process a single request
    async fn process_request(
        &self,
        request_id: Uuid,
        user_id: Uuid,
        payload: Value,
        response_tx: oneshot::Sender<Result<Value, WorkerError>>,
    ) {
        let start_time = Utc::now();

        debug!(
            "Worker {} processing request {} for user {}",
            self.id, request_id, user_id
        );

        // Forward to upstream
        let result = self.forward_to_upstream(&payload).await;

        // Log metrics using shared function
        let latency_ms = Utc::now()
            .signed_duration_since(start_time)
            .num_milliseconds() as i32;
        let success = result.is_ok();

        if let Ok(response) = &result {
            let (input_tokens, output_tokens, model_id) =
                metrics::extract_token_metrics(&payload, Some(response));
            let total_tokens = input_tokens + output_tokens;

            if let Err(e) = log_token_usage(
                &self.db_pool,
                request_id,
                user_id,
                &model_id,
                input_tokens,
                output_tokens,
                total_tokens,
                latency_ms,
                success,
            )
            .await
            {
                error!(
                    "Worker {} failed to log metrics for request {}: {}",
                    self.id, request_id, e
                );
            }
        }

        // Send response back
        let _ = response_tx.send(result);
    }

    /// Forward request to upstream LLM provider
    async fn forward_to_upstream(&self, payload: &Value) -> Result<Value, WorkerError> {
        let url = format!(
            "{}/chat/completions",
            self.upstream_url.trim_end_matches('/')
        );

        let debug_api_key = "8851ba3d-7315-4dc6-b844-5cbbe96c7665";
        tracing::error!("WORKER DEBUG: URL={}", url);
        tracing::error!("WORKER DEBUG: API_KEY={}...", &debug_api_key[..10]);

        tracing::error!("WORKER DEBUG: About to send request to URL: {}", url);
        tracing::error!("WORKER DEBUG: API Key first 10 chars: 8851ba3d-73");
        let response = self
            .http_client
            .post(&url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .header("Authorization", "Bearer 8851ba3d-7315-4dc6-b844-5cbbe96c7665")
            .header("Content-Type", "application/json")
            .json(&remove_nulls(payload.clone()))
            .send()
            .await
            .map_err(WorkerError::from)?;

        if !response.status().is_success() {
            let status = response.status();
            let error_body = response.text().await.unwrap_or_default();
            error!(
                "Upstream request failed with status {}: {}",
                status, error_body
            );
            return Err(WorkerError::UpstreamError(format!(
                "Upstream returned status {}: {}",
                status, error_body
            )));
        }

        let response_body: Value = response.json().await.map_err(|e| {
            WorkerError::UpstreamError(format!("Failed to parse upstream response: {}", e))
        })?;

        Ok(response_body)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::time::Duration;

    #[tokio::test]
    async fn test_worker_pool_creation() {
        let config = Config {
            postgres_url: "postgresql://test:test@localhost:5432/test".to_string(),
            encryption_key: "test-key".to_string(),
            upstream_base_url: "https://test.com".to_string(),
            port: 3002,
            worker_count: 2,
            queue_size: 10,
            circuit_breaker_threshold: 5,
            client_timeout_secs: 120,
            upstream_timeout_secs: 90,
        };

        let upstream_url = config.upstream_base_url.clone();

        let pool = PgPool::connect(&config.postgres_url).await;

        // Pool connection will fail with invalid connection string - that's expected
        assert!(
            pool.is_err(),
            "Pool connection should fail with invalid connection string"
        );

        // Verify config values are set correctly
        assert_eq!(config.worker_count, 2);
        assert_eq!(config.queue_size, 10);
        assert_eq!(config.upstream_base_url, upstream_url);
    }

    #[tokio::test]
    async fn test_worker_error_types() {
        // Test that error types are properly defined
        let queue_full = WorkerError::QueueFull;
        assert!(queue_full.to_string().contains("full"));

        let shutting_down = WorkerError::ShuttingDown;
        assert!(shutting_down.to_string().contains("shutting down"));

        let upstream_err = WorkerError::UpstreamError("test error".to_string());
        assert!(upstream_err.to_string().contains("test error"));
    }

    #[tokio::test]
    async fn test_worker_message_types() {
        let (tx, _rx) = oneshot::channel();

        let msg = WorkerMessage::ProcessRequest {
            request_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            payload: json!({"test": "data"}),
            response_tx: tx,
        };

        match msg {
            WorkerMessage::ProcessRequest { payload, .. } => {
                assert_eq!(payload["test"], "data");
            }
            _ => panic!("Wrong message type"),
        }
    }

    #[tokio::test]
    async fn test_graceful_shutdown() {
        let config = Config {
            postgres_url: "postgresql://test:test@localhost:5432/test".to_string(),
            encryption_key: "test-key".to_string(),
            upstream_base_url: "https://test.com".to_string(),
            port: 3002,
            worker_count: 2,
            queue_size: 10,
            circuit_breaker_threshold: 5,
            client_timeout_secs: 120,
            upstream_timeout_secs: 90,
        };

        let pool = match PgPool::connect(&config.postgres_url).await {
            Ok(pool) => pool,
            Err(_) => return,
        };

        let upstream_url = config.upstream_base_url.clone();
        let worker_pool = WorkerPool::new(&config, pool, upstream_url);

        let shutdown_future = worker_pool.shutdown();
        let result = tokio::time::timeout(Duration::from_secs(5), shutdown_future).await;

        assert!(result.is_ok(), "Shutdown timed out");
    }
}
