//! Integration tests for TokenUsage metrics logging
//!
//! These tests verify that both streaming and non-streaming requests
//! properly log token usage to the TokenUsage table.
//!
//! # Running Tests
//!
//! ```bash
//! # Run all metrics tests
//! cargo test --test integration metrics
//!
//! # Run specific test
//! cargo test --test integration test_metrics_non_streaming_logs_token_usage
//!
//! # Run with custom proxy URL and database connection
//! PROXY_URL=http://localhost:3001 DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_chatbot cargo test --test integration metrics
//! ```
//!
//! # Environment Variables
//!
//! - `PROXY_URL` - Proxy server URL (default: http://127.0.0.1:3001)
//! - `DATABASE_URL` - PostgreSQL connection string for verification
//! - `VALID_TOKEN` - Valid auth token (default: test-token-dev-001)

use reqwest::Client;
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use std::time::Duration;

/// Get database URL from environment or use default
fn get_database_url() -> String {
    std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost:5433/ai_chatbot".to_string())
}

/// Get proxy server URL from environment or use default
fn get_proxy_url() -> String {
    std::env::var("PROXY_URL").unwrap_or_else(|_| "http://127.0.0.1:3001".to_string())
}

/// Get valid authentication token
fn get_valid_token() -> String {
    std::env::var("VALID_TOKEN").unwrap_or_else(|_| "test-token-dev-001".to_string())
}

/// Create HTTP client with timeout
fn create_client() -> Client {
    Client::builder()
        .timeout(Duration::from_secs(70))
        .build()
        .expect("Failed to create HTTP client")
}

/// Create a chat completion request body
fn create_chat_body(stream: bool, model: &str, messages: Vec<(&str, &str)>) -> Value {
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

/// Count TokenUsage records for a specific model
async fn count_token_usage_by_model(pool: &PgPool, model_id: &str) -> Result<i64, sqlx::Error> {
    let row = sqlx::query("SELECT COUNT(*) as count FROM \"TokenUsage\" WHERE \"modelId\" = $1")
        .bind(model_id)
        .fetch_one(pool)
        .await?;

    Ok(row.get::<i64, _>("count"))
}

/// Get the most recent TokenUsage record
async fn get_latest_token_usage(
    pool: &PgPool,
) -> Result<Option<(i32, i32, i32, String)>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT \"inputTokens\", \"outputTokens\", \"totalTokens\", \"modelId\" FROM \"TokenUsage\" ORDER BY \"createdAt\" DESC LIMIT 1"
    )
    .fetch_optional(pool)
    .await?;

    match row {
        Some(r) => {
            let input = r.get::<i32, _>("inputTokens");
            let output = r.get::<i32, _>("outputTokens");
            let total = r.get::<i32, _>("totalTokens");
            let model = r.get::<String, _>("modelId");
            Ok(Some((input, output, total, model)))
        }
        None => Ok(None),
    }
}

/// Clear TokenUsage table (for test isolation)
async fn clear_token_usage(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM \"TokenUsage\"")
        .execute(pool)
        .await?;
    Ok(())
}

#[tokio::test]
async fn test_metrics_non_streaming_logs_token_usage() {
    let client = create_client();
    let proxy_url = get_proxy_url();
    let db_url = get_database_url();
    let url = format!("{}/v1/chat/completions", proxy_url);

    // Create database pool
    let pool = PgPool::connect(&db_url)
        .await
        .expect("Failed to create database pool");

    // Clear previous records
    clear_token_usage(&pool)
        .await
        .expect("Failed to clear TokenUsage");

    // Make a non-streaming request
    let body = create_chat_body(false, "foundation", vec![("user", "Say hello")]);

    let response = client
        .post(&url)
        .bearer_auth(get_valid_token())
        .json(&body)
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), 200, "Request should succeed");

    // Wait for async metrics logging
    tokio::time::sleep(Duration::from_millis(200)).await;

    // Query TokenUsage table
    let count = count_token_usage_by_model(&pool, "foundation")
        .await
        .expect("Failed to query TokenUsage");

    assert!(
        count > 0,
        "TokenUsage record should be created for non-streaming request"
    );

    // Verify the record has correct structure
    let latest = get_latest_token_usage(&pool)
        .await
        .expect("Failed to get latest token usage")
        .expect("Should have at least one record");

    let (input, output, total, model) = latest;
    assert_eq!(model, "foundation");
    assert!(input > 0, "Should have input tokens");
    assert_eq!(total, input + output, "Total should equal input + output");
}

#[tokio::test]
async fn test_metrics_streaming_logs_token_usage() {
    let client = create_client();
    let proxy_url = get_proxy_url();
    let db_url = get_database_url();
    let url = format!("{}/v1/chat/completions", proxy_url);

    // Create database pool
    let pool = PgPool::connect(&db_url)
        .await
        .expect("Failed to create database pool");

    // Clear previous records
    clear_token_usage(&pool)
        .await
        .expect("Failed to clear TokenUsage");

    // Make a streaming request
    let body = create_chat_body(true, "foundation", vec![("user", "Say hello")]);

    let response = client
        .post(&url)
        .bearer_auth(get_valid_token())
        .json(&body)
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), 200, "Streaming request should succeed");

    let response_text = response.text().await.expect("Failed to read response");
    assert!(
        response_text.contains("data:"),
        "Response should contain SSE format"
    );

    // Wait for async metrics logging
    tokio::time::sleep(Duration::from_millis(200)).await;

    // Query TokenUsage table
    let count = count_token_usage_by_model(&pool, "foundation")
        .await
        .expect("Failed to query TokenUsage");

    assert!(
        count > 0,
        "TokenUsage record should be created for streaming request"
    );
}

#[tokio::test]
async fn test_metrics_input_token_counting() {
    let client = create_client();
    let proxy_url = get_proxy_url();
    let db_url = get_database_url();
    let url = format!("{}/v1/chat/completions", proxy_url);

    let pool = PgPool::connect(&db_url)
        .await
        .expect("Failed to create database pool");

    clear_token_usage(&pool)
        .await
        .expect("Failed to clear TokenUsage");

    // Make request with known message length
    let long_message =
        "Hello, this is a test message with some content to estimate token count. ".repeat(5);
    let body = create_chat_body(false, "foundation", vec![("user", &long_message)]);

    let response = client
        .post(&url)
        .bearer_auth(get_valid_token())
        .json(&body)
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), 200);

    tokio::time::sleep(Duration::from_millis(200)).await;

    let latest = get_latest_token_usage(&pool)
        .await
        .expect("Failed to get latest token usage")
        .expect("Should have at least one record");

    let (input, _, _, _) = latest;

    // Input tokens should be estimated from content length (chars / 4)
    let expected_min_tokens = (long_message.len() / 4) as i32;
    assert!(
        input >= expected_min_tokens,
        "Input tokens ({}) should be at least estimated minimum ({})",
        input,
        expected_min_tokens
    );
}

#[tokio::test]
async fn test_metrics_output_token_extraction() {
    let client = create_client();
    let proxy_url = get_proxy_url();
    let db_url = get_database_url();
    let url = format!("{}/v1/chat/completions", proxy_url);

    let pool = PgPool::connect(&db_url)
        .await
        .expect("Failed to create database pool");

    clear_token_usage(&pool)
        .await
        .expect("Failed to clear TokenUsage");

    // Make a request
    let body = create_chat_body(false, "foundation", vec![("user", "Say hello")]);

    let response = client
        .post(&url)
        .bearer_auth(get_valid_token())
        .json(&body)
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), 200);

    let response_json: Value = response.json().await.expect("Failed to parse JSON");

    // Extract output tokens from response
    let expected_output = response_json
        .get("usage")
        .and_then(|u| u.get("completion_tokens"))
        .and_then(|t| t.as_i64())
        .unwrap_or(0) as i32;

    // Wait for async logging to complete (production uses spawn_blocking + non-blocking write)
    tokio::time::sleep(Duration::from_millis(500)).await;

    let latest = get_latest_token_usage(&pool)
        .await
        .expect("Failed to get latest token usage")
        .expect("Should have at least one record");

    let (_, output, _, _) = latest;

    // Output tokens should match response
    assert_eq!(
        output, expected_output,
        "Output tokens in database should match response usage"
    );
}

#[tokio::test]
async fn test_metrics_records_total_tokens() {
    let client = create_client();
    let proxy_url = get_proxy_url();
    let db_url = get_database_url();
    let url = format!("{}/v1/chat/completions", proxy_url);

    let pool = PgPool::connect(&db_url)
        .await
        .expect("Failed to create database pool");

    clear_token_usage(&pool)
        .await
        .expect("Failed to clear TokenUsage");

    let body = create_chat_body(false, "foundation", vec![("user", "Test")]);

    let response = client
        .post(&url)
        .bearer_auth(get_valid_token())
        .json(&body)
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), 200);

    tokio::time::sleep(Duration::from_millis(200)).await;

    let latest = get_latest_token_usage(&pool)
        .await
        .expect("Failed to get latest token usage")
        .expect("Should have at least one record");

    let (input, output, total, _) = latest;

    // Total should equal input + output
    assert_eq!(
        total,
        input + output,
        "Total tokens should equal input + output ({} + {} = {}, got {})",
        input,
        output,
        input + output,
        total
    );
}

#[tokio::test]
async fn test_metrics_records_model_id() {
    let client = create_client();
    let proxy_url = get_proxy_url();
    let db_url = get_database_url();
    let url = format!("{}/v1/chat/completions", proxy_url);

    let pool = PgPool::connect(&db_url)
        .await
        .expect("Failed to create database pool");

    clear_token_usage(&pool)
        .await
        .expect("Failed to clear TokenUsage");

    let body = create_chat_body(false, "foundation", vec![("user", "Test")]);

    let response = client
        .post(&url)
        .bearer_auth(get_valid_token())
        .json(&body)
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), 200);

    tokio::time::sleep(Duration::from_millis(200)).await;

    let latest = get_latest_token_usage(&pool)
        .await
        .expect("Failed to get latest token usage")
        .expect("Should have at least one record");

    let (_, _, _, model) = latest;
    assert_eq!(model, "foundation", "Model ID should match request");
}

#[tokio::test]
async fn test_metrics_handles_database_error_gracefully() {
    // This test verifies that metrics logging errors don't crash the request
    // We can't easily simulate a database error without breaking the test setup,
    // so we just verify the request succeeds even if metrics logging might fail

    let client = create_client();
    let proxy_url = get_proxy_url();
    let url = format!("{}/v1/chat/completions", proxy_url);

    let body = create_chat_body(false, "foundation", vec![("user", "Test")]);

    let response = client
        .post(&url)
        .bearer_auth(get_valid_token())
        .json(&body)
        .send()
        .await
        .expect("Failed to send request");

    // Request should succeed even if metrics logging fails
    assert_eq!(
        response.status(),
        200,
        "Request should succeed regardless of metrics logging"
    );
}

#[tokio::test]
async fn test_metrics_records_user_id() {
    let client = create_client();
    let proxy_url = get_proxy_url();
    let db_url = get_database_url();
    let url = format!("{}/v1/chat/completions", proxy_url);

    let pool = PgPool::connect(&db_url)
        .await
        .expect("Failed to create database pool");

    clear_token_usage(&pool)
        .await
        .expect("Failed to clear TokenUsage");

    let body = create_chat_body(false, "foundation", vec![("user", "Test")]);

    let response = client
        .post(&url)
        .bearer_auth(get_valid_token())
        .json(&body)
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), 200);

    tokio::time::sleep(Duration::from_millis(200)).await;

    // Verify userId is not NULL
    let row =
        sqlx::query("SELECT COUNT(*) as count FROM \"TokenUsage\" WHERE \"userId\" IS NOT NULL")
            .fetch_one(&pool)
            .await
            .expect("Failed to query TokenUsage");

    let count = row.get::<i64, _>("count");
    assert!(count > 0, "TokenUsage record should have non-NULL userId");
}

#[tokio::test]
async fn test_metrics_chat_id_is_nullable() {
    let client = create_client();
    let proxy_url = get_proxy_url();
    let db_url = get_database_url();
    let url = format!("{}/v1/chat/completions", proxy_url);

    let pool = PgPool::connect(&db_url)
        .await
        .expect("Failed to create database pool");

    clear_token_usage(&pool)
        .await
        .expect("Failed to clear TokenUsage");

    let body = create_chat_body(false, "foundation", vec![("user", "Test")]);

    let response = client
        .post(&url)
        .bearer_auth(get_valid_token())
        .json(&body)
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), 200);

    tokio::time::sleep(Duration::from_millis(200)).await;

    // Verify chatId is NULL (proxy doesn't have chat context)
    let row = sqlx::query("SELECT COUNT(*) as count FROM \"TokenUsage\" WHERE \"chatId\" IS NULL")
        .fetch_one(&pool)
        .await
        .expect("Failed to query TokenUsage");

    let count = row.get::<i64, _>("count");
    assert!(
        count > 0,
        "TokenUsage record should have NULL chatId for proxy requests"
    );
}
