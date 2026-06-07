//! Common test utilities and helpers for integration tests
//!
//! This module provides shared functionality for making HTTP requests
//! to the proxy server and asserting common patterns.

use reqwest::Client;
use serde_json::{json, Value};

/// Get proxy server URL from environment or use default
///
/// Environment variable: PROXY_URL
/// Default: http://127.0.0.1:3001
pub fn get_proxy_url() -> String {
    std::env::var("PROXY_URL").unwrap_or_else(|_| "http://127.0.0.1:3001".to_string())
}

/// Get valid authentication token from environment or use default
///
/// Environment variable: VALID_TOKEN
/// Default: test-token-dev-001
pub fn get_valid_token() -> String {
    std::env::var("VALID_TOKEN").unwrap_or_else(|_| "test-token-dev-001".to_string())
}

/// Get invalid authentication token for testing
///
/// Environment variable: INVALID_TOKEN
/// Default: invalid-token-xyz
pub fn get_invalid_token() -> String {
    std::env::var("INVALID_TOKEN").unwrap_or_else(|_| "invalid-token-xyz".to_string())
}

/// Create HTTP client with appropriate timeout for proxy tests
///
/// Timeout: 70 seconds (matches bash test MAX_TIME default)
pub fn create_client() -> Client {
    Client::builder()
        .timeout(std::time::Duration::from_secs(70))
        .build()
        .expect("Failed to create HTTP client")
}

/// Create HTTP client with custom timeout for streaming tests
///
/// # Arguments
/// * `timeout_secs` - Timeout in seconds
///
/// # Example
/// ```
/// let client = create_client_with_timeout(120);
/// ```
pub fn create_client_with_timeout(timeout_secs: u64) -> Client {
    Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .expect("Failed to create HTTP client")
}

/// Create a chat completion request body
///
/// # Arguments
/// * `stream` - Whether to enable streaming mode
/// * `model` - Model name (e.g., "foundation")
/// * `messages` - Vector of (role, content) tuples
///
/// # Example
/// ```
/// let body = create_chat_body(true, "foundation", vec![("user", "Say hello")]);
/// ```
pub fn create_chat_body(stream: bool, model: &str, messages: Vec<(&str, &str)>) -> Value {
    json!({
        "stream": stream,
        "model": model,
        "messages": messages.iter().map(|(role, content)| {
            json!({
                "role": role,
                "content": content
            })
        }).collect::<Vec<_>>()
    })
}

/// Create a minimal valid chat completion request body
pub fn create_minimal_chat_body() -> Value {
    json!({
        "model": "foundation",
        "messages": [
            {
                "role": "user",
                "content": "test"
            }
        ]
    })
}

/// Assert that response contains SSE format (lines starting with "data: ")
///
/// # Arguments
/// * `body` - Response body text
///
/// # Panics
/// Panics if no SSE lines found
pub fn assert_sse_format(body: &str) {
    let has_sse_lines = body.lines().any(|line| line.starts_with("data: "));
    assert!(
        has_sse_lines,
        "Response should contain SSE format (lines starting with 'data: ')"
    );
}

/// Assert that response ends with [DONE] marker
///
/// # Arguments
/// * `body` - Response body text
///
/// # Panics
/// Panics if [DONE] marker not found
pub fn assert_ends_with_done(body: &str) {
    assert!(
        body.contains("data: [DONE]") || body.contains("data:[DONE]"),
        "Response should end with [DONE] marker"
    );
}

/// Assert that all SSE chunks are valid JSON (excluding [DONE])
///
/// # Arguments
/// * `body` - Response body text
///
/// # Panics
/// Panics if any chunk is invalid JSON
pub fn assert_all_chunks_valid_json(body: &str) {
    let chunks: Vec<&str> = body.split("data: ").collect();

    for chunk in chunks {
        let chunk = chunk.trim();
        if chunk.is_empty() || chunk == "[DONE]" {
            continue;
        }

        let chunk = chunk.trim_end_matches(['\n', '\r']);

        if chunk.is_empty() {
            continue;
        }

        serde_json::from_str::<Value>(chunk)
            .unwrap_or_else(|e| panic!("Invalid JSON in SSE chunk: {}\nChunk: {}", e, chunk));
    }
}

/// Count the number of SSE chunks in response
///
/// # Arguments
/// * `body` - Response body text
///
/// # Returns
/// Number of lines starting with "data: "
pub fn count_sse_chunks(body: &str) -> usize {
    body.lines()
        .filter(|line| line.starts_with("data: "))
        .count()
}

/// Assert response has expected structure for chat completion
///
/// # Arguments
/// * `body` - Parsed JSON response
///
/// # Panics
/// Panics if required fields are missing
pub fn assert_chat_completion_structure(body: &Value) {
    assert!(body.get("id").is_some(), "Response missing 'id' field");
    assert!(
        body.get("choices").is_some(),
        "Response missing 'choices' field"
    );
    assert!(
        body.get("usage").is_some(),
        "Response missing 'usage' field"
    );
    assert!(
        body.get("model").is_some(),
        "Response missing 'model' field"
    );

    // Check choices array has at least one element with message
    if let Some(choices) = body.get("choices").and_then(|v| v.as_array()) {
        assert!(!choices.is_empty(), "Choices array should not be empty");
        if let Some(first_choice) = choices.first() {
            assert!(
                first_choice.get("message").is_some(),
                "Choice missing 'message' field"
            );
            if let Some(message) = first_choice.get("message") {
                assert!(
                    message.get("content").is_some(),
                    "Message missing 'content' field"
                );
            }
        }
    }
}

/// Assert response has error structure
///
/// # Arguments
/// * `body` - Parsed JSON response
///
/// # Panics
/// Panics if error structure is invalid
pub fn assert_error_structure(body: &Value) {
    assert!(
        body.get("error").is_some() || body.get("message").is_some(),
        "Error response should have 'error' or 'message' field"
    );
}

/// Build authorization header value
///
/// # Arguments
/// * `token` - Bearer token
///
/// # Returns
/// Formatted header value "Bearer {token}"
pub fn build_auth_header(token: &str) -> String {
    format!("Bearer {}", token)
}
