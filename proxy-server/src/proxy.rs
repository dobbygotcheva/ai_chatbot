//! Proxy handler with circuit breaker for LLM requests.
//!
//! This module implements the OpenAI-compatible `/v1/chat/completions` endpoint
//! with circuit breaker pattern, request ID propagation, and timeout handling.

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::auth;
use sqlx::postgres::PgPool;

use crate::config::Config;
use crate::metrics::MetricsState;
use crate::streaming;
use crate::worker::{WorkerError, WorkerPool};

#[derive(Clone)]
pub struct AppState {
    pub proxy_state: Arc<ProxyState>,
    pub metrics_state: Arc<MetricsState>,
    pub pool: PgPool,
    pub config: Arc<Config>,
}

/// Circuit breaker state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    /// Normal operation - requests flow through
    Closed,
    /// Circuit open - failing fast with 503
    Open,
    /// Testing if service recovered - allow one request
    HalfOpen,
}

/// Circuit breaker implementation
pub struct CircuitBreaker {
    /// Current state
    state: CircuitState,
    /// Consecutive failure count
    failure_count: usize,
    /// When circuit opened (for half-open transition)
    opened_at: Option<std::time::Instant>,
    /// Failure threshold to open circuit
    failure_threshold: usize,
    /// Time in seconds before transitioning to half-open
    recovery_timeout_secs: u64,
}

impl CircuitBreaker {
    pub fn new(failure_threshold: usize, recovery_timeout_secs: u64) -> Self {
        Self {
            state: CircuitState::Closed,
            failure_count: 0,
            opened_at: None,
            failure_threshold,
            recovery_timeout_secs,
        }
    }

    /// Check if request should be allowed
    pub fn allow_request(&mut self) -> bool {
        match self.state {
            CircuitState::Closed => true,
            CircuitState::Open => {
                // Check if recovery timeout has elapsed
                if let Some(opened_at) = self.opened_at {
                    if opened_at.elapsed() >= Duration::from_secs(self.recovery_timeout_secs) {
                        self.state = CircuitState::HalfOpen;
                        debug!("Circuit breaker transitioning to half-open");
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
            }
            CircuitState::HalfOpen => true,
        }
    }

    /// Record a successful request
    pub fn record_success(&mut self) {
        match self.state {
            CircuitState::HalfOpen => {
                info!("Circuit breaker closed after successful request in half-open state");
                self.state = CircuitState::Closed;
                self.failure_count = 0;
                self.opened_at = None;
            }
            CircuitState::Closed => {
                self.failure_count = 0;
            }
            CircuitState::Open => {
                // Shouldn't happen, but reset if it does
                self.state = CircuitState::Closed;
                self.failure_count = 0;
                self.opened_at = None;
            }
        }
    }

    /// Record a failed request
    pub fn record_failure(&mut self) {
        match self.state {
            CircuitState::Closed => {
                self.failure_count += 1;
                if self.failure_count >= self.failure_threshold {
                    warn!(
                        "Circuit breaker opening after {} consecutive failures",
                        self.failure_count
                    );
                    self.state = CircuitState::Open;
                    self.opened_at = Some(std::time::Instant::now());
                }
            }
            CircuitState::HalfOpen => {
                warn!("Circuit breaker re-opening after failure in half-open state");
                self.state = CircuitState::Open;
                self.opened_at = Some(std::time::Instant::now());
                self.failure_count = self.failure_threshold; // Keep at threshold
            }
            CircuitState::Open => {
                // Already open, extend the timeout
                self.opened_at = Some(std::time::Instant::now());
            }
        }
    }

    /// Get current state (for testing/metrics)
    pub fn state(&self) -> CircuitState {
        self.state
    }
}

/// Thread-safe circuit breaker wrapper
pub struct CircuitBreakerWrapper {
    inner: Mutex<CircuitBreaker>,
}

impl CircuitBreakerWrapper {
    pub fn new(failure_threshold: usize, recovery_timeout_secs: u64) -> Self {
        Self {
            inner: Mutex::new(CircuitBreaker::new(
                failure_threshold,
                recovery_timeout_secs,
            )),
        }
    }

    pub async fn allow_request(&self) -> bool {
        let mut cb = self.inner.lock().await;
        cb.allow_request()
    }

    pub async fn record_success(&self) {
        let mut cb = self.inner.lock().await;
        cb.record_success();
    }

    pub async fn record_failure(&self) {
        let mut cb = self.inner.lock().await;
        cb.record_failure();
    }

    pub async fn state(&self) -> CircuitState {
        let cb = self.inner.lock().await;
        cb.state()
    }
}

/// Chat completion request (OpenAI-compatible)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub max_tokens: Option<i32>,
    #[serde(default)]
    pub stream: Option<bool>,
    #[serde(default)]
    pub top_p: Option<f32>,
    #[serde(default)]
    pub frequency_penalty: Option<f32>,
    #[serde(default)]
    pub presence_penalty: Option<f32>,
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, Value>,
}

/// Chat message in request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

/// Chat completion response (OpenAI-compatible)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub id: String,
    pub object: String,
    pub created: i64,
    pub model: String,
    pub choices: Vec<ChatChoice>,
    pub usage: Option<ChatUsage>,
}

/// Chat choice in response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatChoice {
    pub index: i32,
    pub message: ChatMessage,
    pub finish_reason: Option<String>,
}

/// Token usage information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatUsage {
    pub prompt_tokens: i32,
    pub completion_tokens: i32,
    pub total_tokens: i32,
}

/// Proxy error types
#[derive(Debug, thiserror::Error)]
pub enum ProxyError {
    #[error("Circuit breaker open - service temporarily unavailable")]
    CircuitOpen,

    #[error("Gateway timeout - upstream did not respond")]
    GatewayTimeout,

    #[error("Worker error: {0}")]
    WorkerError(#[from] WorkerError),

    #[error("Invalid request: {0}")]
    BadRequest(String),

    #[error("Authentication required")]
    Unauthorized,

    #[error("Internal server error: {0}")]
    InternalError(String),
}

impl axum::response::IntoResponse for ProxyError {
    fn into_response(self) -> axum::response::Response {
        let (status, error_message) = match &self {
            ProxyError::CircuitOpen => (
                StatusCode::SERVICE_UNAVAILABLE,
                "Service temporarily unavailable - circuit breaker open",
            ),
            ProxyError::GatewayTimeout => (
                StatusCode::GATEWAY_TIMEOUT,
                "Gateway timeout - upstream did not respond",
            ),
            ProxyError::WorkerError(e) => match e {
                WorkerError::QueueFull => (
                    StatusCode::TOO_MANY_REQUESTS,
                    "Service temporarily overloaded - please retry",
                ),
                _ => (
                    StatusCode::BAD_GATEWAY,
                    "Failed to process request - upstream error",
                ),
            },
            ProxyError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.as_str()),
            ProxyError::Unauthorized => (StatusCode::UNAUTHORIZED, "Authentication required"),
            ProxyError::InternalError(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
            }
        };

        let body = serde_json::json!({
            "error": {
                "message": error_message,
                "type": "proxy_error"
            }
        });

        (status, axum::Json(body)).into_response()
    }
}

/// Shared state for proxy handlers
pub struct ProxyState {
    pub worker_pool: Arc<WorkerPool>,
    pub circuit_breaker: Arc<CircuitBreakerWrapper>,
    pub config: Arc<Config>,
}

/// POST /v1/chat/completions handler
///
/// This handler:
/// 1. Validates API token via middleware
/// 2. Extracts user ID from request extensions
/// 3. Checks circuit breaker state
/// 4. Generates request ID (UUID v4)
/// 5. Sends request to worker pool
/// 6. Waits for response with timeout
/// 7. Returns upstream response or error
pub async fn chat_completions(
    State(state): State<AppState>,
    axum::extract::Extension(user_id): axum::extract::Extension<auth::UserId>,
    body: Json<ChatRequest>,
) -> Result<Response, ProxyError> {
    let request_id = Uuid::new_v4();
    let start_time = std::time::Instant::now();

    debug!(
        "Processing chat completion request {} for user {}",
        request_id, user_id.0
    );

    // Check circuit breaker
    if !state.proxy_state.circuit_breaker.allow_request().await {
        warn!("Request {} rejected - circuit breaker is open", request_id);
        return Err(ProxyError::CircuitOpen);
    }

    // Validate request
    if body.messages.is_empty() {
        return Err(ProxyError::BadRequest(
            "Messages array cannot be empty".to_string(),
        ));
    }

    let model = body.model.clone();

    // Handle streaming requests
    if body.stream.unwrap_or(false) {
        let payload = serde_json::to_value(body.0)
            .map_err(|e| ProxyError::BadRequest(format!("Invalid JSON: {}", e)))?;
        return streaming::handle_streaming(
            &state.proxy_state.config,
            payload,
            request_id,
            user_id.0,
            Some(&state.pool),
        )
        .await;
    }

    let payload = serde_json::to_value(body.0)
        .map_err(|e| ProxyError::BadRequest(format!("Invalid request JSON: {}", e)))?;

    let upstream_timeout = Duration::from_secs(state.proxy_state.config.upstream_timeout_secs);

    let result = tokio::time::timeout(
        upstream_timeout,
        state
            .proxy_state
            .worker_pool
            .process(request_id, user_id.0, payload),
    )
    .await;

    match result {
        Ok(Ok(response_value)) => {
            state.proxy_state.circuit_breaker.record_success().await;

            let response: ChatResponse =
                serde_json::from_value(response_value).unwrap_or_else(|_| ChatResponse {
                    id: format!("chatcmpl-{}", request_id),
                    object: "chat.completion".to_string(),
                    created: Utc::now().timestamp(),
                    model,
                    choices: vec![],
                    usage: None,
                });

            let elapsed = start_time.elapsed();
            debug!(
                "Request {} completed successfully in {:?}ms",
                request_id,
                elapsed.as_millis()
            );

            Ok(Json(response).into_response())
        }
        Ok(Err(worker_err)) => {
            // Record failure for circuit breaker
            state.proxy_state.circuit_breaker.record_failure().await;

            error!("Worker error for request {}: {}", request_id, worker_err);
            Err(worker_err.into())
        }
        Err(_timeout) => {
            // Timeout - record failure
            state.proxy_state.circuit_breaker.record_failure().await;

            error!(
                "Request {} timed out after {:?}s",
                request_id,
                upstream_timeout.as_secs()
            );
            Err(ProxyError::GatewayTimeout)
        }
    }
}

/// Health check endpoint
pub async fn health_check() -> &'static str {
    "OK"
}

/// Metrics endpoint (basic circuit breaker state)
pub async fn get_metrics(State(state): State<Arc<ProxyState>>) -> Result<String, StatusCode> {
    let cb_state = state.circuit_breaker.state().await;

    let metrics = format!(
        "# HELP proxy_circuit_breaker_state Circuit breaker state (0=closed, 1=open, 2=half_open)\n\
         # TYPE proxy_circuit_breaker_state gauge\n\
         proxy_circuit_breaker_state {}\n",
        match cb_state {
            CircuitState::Closed => 0,
            CircuitState::Open => 1,
            CircuitState::HalfOpen => 2,
        }
    );

    Ok(metrics)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_circuit_breaker_initial_state() {
        let mut cb = CircuitBreaker::new(5, 30);
        assert_eq!(cb.state(), CircuitState::Closed);
        assert!(cb.allow_request());
    }

    #[test]
    fn test_circuit_breaker_opens_after_threshold() {
        let mut cb = CircuitBreaker::new(5, 30);

        for _ in 0..4 {
            cb.record_failure();
            assert_eq!(cb.state(), CircuitState::Closed);
            assert!(cb.allow_request());
        }

        // 5th failure - should open
        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Open);
        assert!(!cb.allow_request());
    }

    #[test]
    fn test_circuit_breaker_half_open_after_timeout() {
        let mut cb = CircuitBreaker::new(5, 1); // 1 second timeout for testing

        // Open the circuit
        for _ in 0..5 {
            cb.record_failure();
        }
        assert_eq!(cb.state(), CircuitState::Open);

        // Wait for timeout
        std::thread::sleep(Duration::from_secs(1));

        // Should transition to half-open
        assert!(cb.allow_request());
        assert_eq!(cb.state(), CircuitState::HalfOpen);
    }

    #[test]
    fn test_circuit_breaker_closes_on_success() {
        let mut cb = CircuitBreaker::new(5, 30);

        // Open the circuit
        for _ in 0..5 {
            cb.record_failure();
        }

        // Wait for half-open
        std::thread::sleep(Duration::from_secs(31));
        cb.allow_request();
        assert_eq!(cb.state(), CircuitState::HalfOpen);

        // Success should close it
        cb.record_success();
        assert_eq!(cb.state(), CircuitState::Closed);
        assert_eq!(cb.failure_count, 0);
    }

    #[test]
    fn test_circuit_breaker_reopens_on_half_open_failure() {
        let mut cb = CircuitBreaker::new(5, 1);

        // Open the circuit
        for _ in 0..5 {
            cb.record_failure();
        }

        // Wait for half-open
        std::thread::sleep(Duration::from_secs(1));
        cb.allow_request();

        // Failure in half-open should reopen
        cb.record_failure();
        assert_eq!(cb.state(), CircuitState::Open);
    }

    #[test]
    fn test_chat_request_serialization() {
        let request = ChatRequest {
            model: "foundation".to_string(),
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: "Hello".to_string(),
                name: None,
            }],
            temperature: Some(0.7),
            max_tokens: Some(100),
            stream: Some(false),
            top_p: None,
            frequency_penalty: None,
            presence_penalty: None,
            extra: std::collections::HashMap::new(),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("foundation"));
        assert!(json.contains("Hello"));
    }

    #[test]
    fn test_chat_response_deserialization() {
        let json = r#"{
            "id": "chatcmpl-123",
            "object": "chat.completion",
            "created": 1234567890,
            "model": "foundation",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Hello!"
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 5,
                "total_tokens": 15
            }
        }"#;

        let response: ChatResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.id, "chatcmpl-123");
        assert_eq!(response.choices.len(), 1);
        assert_eq!(response.usage.unwrap().total_tokens, 15);
    }

    #[tokio::test]
    async fn test_circuit_breaker_wrapper_thread_safety() {
        let wrapper = Arc::new(CircuitBreakerWrapper::new(5, 30));

        // Simulate concurrent requests
        let mut handles = vec![];
        for _ in 0..10 {
            let cb = wrapper.clone();
            let handle = tokio::spawn(async move {
                cb.allow_request().await;
                cb.record_failure().await;
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.await.unwrap();
        }

        // Should have recorded failures
        let state = wrapper.state().await;
        assert!(state == CircuitState::Closed || state == CircuitState::Open);
    }
}
