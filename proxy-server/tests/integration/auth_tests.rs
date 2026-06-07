//! Authentication integration tests
//!
//! Tests for proxy server authentication mechanisms

use crate::common::{
    build_auth_header, create_client, create_minimal_chat_body, get_invalid_token, get_proxy_url,
    get_valid_token,
};

#[tokio::test]
async fn test_auth_valid_token_returns_200() {
    let client = create_client();
    let url = format!("{}/v1/chat/completions", get_proxy_url());

    let response = client
        .post(&url)
        .header("Authorization", build_auth_header(&get_valid_token()))
        .header("Content-Type", "application/json")
        .json(&create_minimal_chat_body())
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), 200, "Valid token should return 200");
}

#[tokio::test]
async fn test_auth_invalid_token_returns_401() {
    let client = create_client();
    let url = format!("{}/v1/chat/completions", get_proxy_url());

    let response = client
        .post(&url)
        .header("Authorization", build_auth_header(&get_invalid_token()))
        .header("Content-Type", "application/json")
        .json(&create_minimal_chat_body())
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), 401, "Invalid token should return 401");
}

#[tokio::test]
async fn test_auth_missing_header_returns_401() {
    let client = create_client();
    let url = format!("{}/v1/chat/completions", get_proxy_url());

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&create_minimal_chat_body())
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(
        response.status(),
        401,
        "Missing Authorization header should return 401"
    );
}

#[tokio::test]
async fn test_auth_malformed_token_returns_401() {
    let client = create_client();
    let url = format!("{}/v1/chat/completions", get_proxy_url());

    let response = client
        .post(&url)
        .header("Authorization", format!("NotBearer {}", get_valid_token()))
        .header("Content-Type", "application/json")
        .json(&create_minimal_chat_body())
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(response.status(), 401, "Malformed token should return 401");
}

#[tokio::test]
async fn test_auth_empty_bearer_returns_401() {
    let client = create_client();
    let url = format!("{}/v1/chat/completions", get_proxy_url());

    let response = client
        .post(&url)
        .header("Authorization", "Bearer ")
        .header("Content-Type", "application/json")
        .json(&create_minimal_chat_body())
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(
        response.status(),
        401,
        "Empty Bearer token should return 401"
    );
}

#[tokio::test]
async fn test_auth_token_with_spaces() {
    let client = create_client();
    let url = format!("{}/v1/chat/completions", get_proxy_url());

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer  {}  ", get_valid_token()))
        .header("Content-Type", "application/json")
        .json(&create_minimal_chat_body())
        .send()
        .await
        .expect("Failed to send request");

    let status = response.status();
    assert!(
        status == 200 || status == 401,
        "Token with spaces should return 200 or 401, got {}",
        status
    );
}

#[tokio::test]
async fn test_auth_health_no_auth_required() {
    let client = create_client();
    let url = format!("{}/health", get_proxy_url());

    let response = client
        .get(&url)
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(
        response.status(),
        200,
        "Health endpoint should not require auth"
    );
}

#[tokio::test]
async fn test_auth_metrics_no_auth_required() {
    let client = create_client();
    let url = format!("{}/metrics", get_proxy_url());

    let response = client
        .get(&url)
        .send()
        .await
        .expect("Failed to send request");

    assert_eq!(
        response.status(),
        200,
        "Metrics endpoint should not require auth"
    );
}
