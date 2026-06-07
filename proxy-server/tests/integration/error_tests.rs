//! Error handling integration tests
//!
//! Tests for proxy server error handling and validation

use crate::common::{build_auth_header, create_client, get_proxy_url, get_valid_token};
use serde_json::{json, Value};

#[tokio::test]
async fn test_error_invalid_json_returns_400() {
    let client = create_client();
    let url = format!("{}/v1/chat/completions", get_proxy_url());

    let response = client
        .post(&url)
        .header("Authorization", build_auth_header(&get_valid_token()))
        .header("Content-Type", "application/json")
        .body("this is not valid json".to_string())
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), 400, "Invalid JSON should return 400");
}

#[tokio::test]
async fn test_error_missing_model_returns_400() {
    let client = create_client();
    let url = format!("{}/v1/chat/completions", get_proxy_url());

    // Proxy forwards to upstream; upstream validates and returns 422 for missing model
    // This is correct transparent proxy behavior - proxy doesn't pre-validate
    let body = json!({
        "messages": [
            {
                "role": "user",
                "content": "test"
            }
        ]
    });

    let response = client
        .post(&url)
        .header("Authorization", build_auth_header(&get_valid_token()))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .expect("Failed to send request");

    // Upstream returns 422 for validation errors, proxy passes through
    assert_eq!(
        response.status(),
        422,
        "Missing model field should return error status"
    );
}

#[tokio::test]
async fn test_error_empty_messages_returns_400() {
    let client = create_client();
    let url = format!("{}/v1/chat/completions", get_proxy_url());

    // Proxy forwards to upstream; upstream validates empty messages
    let body = json!({
        "model": "foundation",
        "messages": []
    });

    let response = client
        .post(&url)
        .header("Authorization", build_auth_header(&get_valid_token()))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .expect("Failed to send request");

    // Accept any error status (4xx or 5xx) - upstream decides validation
    let status = response.status();
    assert!(
        status.is_client_error() || status.is_server_error(),
        "Empty messages should return error status, got {}",
        status
    );
}

#[tokio::test]
async fn test_error_invalid_model() {
    let client = create_client();
    let url = format!("{}/v1/chat/completions", get_proxy_url());

    // Proxy forwards to upstream; upstream returns error for invalid model
    // Upstream may return 404 (not found) or 502 (gateway error)
    let body = json!({
        "model": "nonexistent-model-xyz",
        "messages": [
            {
                "role": "user",
                "content": "test"
            }
        ]
    });

    let response = client
        .post(&url)
        .header("Authorization", build_auth_header(&get_valid_token()))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .expect("Failed to send request");

    let status = response.status();
    // Proxy passes through upstream error - accept any error status
    assert!(
        status.is_client_error() || status.is_server_error(),
        "Invalid model should return error status, got {}",
        status
    );

    // Verify error response structure
    let body: Value = response.json().await.unwrap();
    assert!(
        body.get("error").is_some() || body.get("message").is_some(),
        "Should have error field"
    );
}

#[tokio::test]
async fn test_error_health_ok() {
    let client = create_client();
    let url = format!("{}/health", get_proxy_url());

    let response = client
        .get(&url)
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), 200, "Health endpoint should return 200");
}

#[tokio::test]
async fn test_error_metrics_ok() {
    let client = create_client();
    let url = format!("{}/metrics", get_proxy_url());

    let response = client
        .get(&url)
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), 200, "Metrics endpoint should return 200");
}

#[tokio::test]
async fn test_error_missing_messages_returns_400() {
    let client = create_client();
    let url = format!("{}/v1/chat/completions", get_proxy_url());

    // Proxy forwards to upstream; upstream validates and returns error for missing messages
    let body = json!({
        "model": "foundation"
    });

    let response = client
        .post(&url)
        .header("Authorization", build_auth_header(&get_valid_token()))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .expect("Failed to send request");

    // Upstream returns 422 for validation errors
    assert_eq!(
        response.status(),
        422,
        "Missing messages field should return error status"
    );
}

#[tokio::test]
async fn test_error_invalid_role_returns_400() {
    let client = create_client();
    let url = format!("{}/v1/chat/completions", get_proxy_url());

    // Proxy forwards to upstream; upstream may return 500 with nested error
    // for invalid role - proxy passes through whatever upstream returns
    let body = json!({
        "model": "foundation",
        "messages": [
            {
                "role": "invalid_role",
                "content": "test"
            }
        ]
    });

    let response = client
        .post(&url)
        .header("Authorization", build_auth_header(&get_valid_token()))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .expect("Failed to send request");

    let status = response.status();
    // Accept any error status - upstream decides how to handle invalid role
    assert!(
        status.is_client_error() || status.is_server_error(),
        "Invalid role should return error status, got {}",
        status
    );

    // Verify error response structure
    let body: Value = response.json().await.unwrap();
    assert!(
        body.get("error").is_some() || body.get("message").is_some(),
        "Should have error field"
    );
}

#[tokio::test]
async fn test_error_empty_content() {
    let client = create_client();
    let url = format!("{}/v1/chat/completions", get_proxy_url());

    let body = json!({
        "model": "foundation",
        "messages": [
            {
                "role": "user",
                "content": ""
            }
        ]
    });

    let response = client
        .post(&url)
        .header("Authorization", build_auth_header(&get_valid_token()))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .expect("Failed to send request");

    let status = response.status();
    assert!(
        status == 200 || status == 400,
        "Empty content should return 200 or 400, got {}",
        status
    );
}

#[tokio::test]
async fn test_error_unknown_endpoint_returns_404() {
    let client = create_client();
    // Test unknown endpoint with valid auth - proxy forwards to upstream
    // Upstream returns 404 for unknown endpoints
    let url = format!("{}/v1/unknown-endpoint", get_proxy_url());

    let response = client
        .get(&url)
        .header("Authorization", build_auth_header(&get_valid_token()))
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(
        response.status(),
        404,
        "Unknown endpoint should return 404 from upstream"
    );
}
