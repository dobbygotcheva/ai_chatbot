//! API Token Validation Middleware for Axum
//!
//! This module implements middleware that validates API tokens from the Authorization header.
//! It queries the ApiToken table, validates expiry and revocation status, and adds user ID
//! to request extensions for downstream handlers.

use axum::http;
use axum::{
    extract::Request,
    extract::State,
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use uuid::Uuid;

/// User ID extension type for request extensions
#[derive(Clone, Debug)]
pub struct UserId(pub Uuid);

/// Token metadata extracted from valid token
#[derive(Clone, Debug)]
pub struct TokenMetadata {
    pub user_id: Uuid,
    pub token_id: Uuid,
}

/// Authentication error types
#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Missing Authorization header")]
    MissingHeader,

    #[error("Invalid Authorization header format")]
    InvalidFormat,

    #[error("Token not found")]
    TokenNotFound,

    #[error("Token expired")]
    TokenExpired,

    #[error("Token revoked")]
    TokenRevoked,

    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Decryption error: {0}")]
    DecryptionError(#[from] crate::encryption::EncryptionError),
}

/// Structured error response (matches upstream provider format)
#[derive(serde::Serialize, serde::Deserialize)]
pub struct ErrorResponse {
    pub error: ErrorDetail,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ErrorDetail {
    pub code: u16,
    pub message: String,
    #[serde(rename = "type")]
    pub error_type: String,
}

impl ErrorResponse {
    pub fn unauthorized(message: &str) -> Self {
        Self {
            error: ErrorDetail {
                code: 401,
                message: message.to_string(),
                error_type: "unauthorized".to_string(),
            },
        }
    }

    pub fn invalid_token() -> Self {
        Self::unauthorized("Invalid API token. Please check your token and try again.")
    }
}

/// Extract Bearer token from Authorization header
fn extract_bearer_token(auth_header: &str) -> Result<&str, AuthError> {
    auth_header
        .strip_prefix("Bearer ")
        .ok_or(AuthError::InvalidFormat)
}

/// Validate API token middleware
///
/// This middleware:
/// 1. Extracts Bearer token from Authorization header
/// 2. Queries ApiToken table by encrypted token value
/// 3. Validates token exists, not expired, not revoked
/// 4. Updates lastUsedAt timestamp (async, non-blocking)
/// 5. Adds user ID to request extensions
/// 6. Returns 401 if token invalid/expired/revoked
pub async fn validate_token(
    State(app_state): State<crate::proxy::AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, (StatusCode, axum::Json<ErrorResponse>)> {
    let config = &app_state.config;
    let pool = &app_state.pool;
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value: &http::HeaderValue| value.to_str().ok())
        .ok_or_else(|| {
            (
                StatusCode::UNAUTHORIZED,
                axum::Json(ErrorResponse::unauthorized("Missing Authorization header")),
            )
        })?;

    let plaintext_token = extract_bearer_token(auth_header)
        .map(|s| s.to_string())
        .map_err(|e| {
            (
                StatusCode::UNAUTHORIZED,
                axum::Json(ErrorResponse::unauthorized(match e {
                    AuthError::InvalidFormat => {
                        "Invalid Authorization header format. Expected: Bearer <token>"
                    }
                    _ => "Invalid Authorization header",
                })),
            )
        })?;

    // Use raw encryption key for HMAC (matches Next.js implementation)
    // Next.js: createHmac("sha256", getEncryptionKey())
    let encryption_key = config.encryption_key.clone();

    // Compute HMAC-SHA256 of the provided token for indexed lookup
    let token_hash = tokio::task::spawn_blocking(move || {
        let mut mac = Hmac::<Sha256>::new_from_slice(encryption_key.as_bytes()).unwrap();
        mac.update(plaintext_token.as_bytes());
        let result = mac.finalize();
        hex::encode(result.into_bytes())
    })
    .await
    .map_err(|e| {
        tracing::error!("HMAC computation failed: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(ErrorResponse::unauthorized("Internal server error")),
        )
    })?;

    let now = chrono::Local::now().naive_local();

    // Direct indexed lookup - O(1) instead of decrypt-all loop
    let found_token: Option<(Uuid, Uuid)> = sqlx::query_as(
        r#"
        SELECT id, "userId"
        FROM "ApiToken"
        WHERE "encryptedToken" = $1
          AND "revokedAt" IS NULL
          AND "expiresAt" > $2
        "#,
    )
    .bind(&token_hash)
    .bind(now)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error during token validation: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(ErrorResponse::unauthorized("Internal server error")),
        )
    })?;

    let (token_id, user_id) = found_token.ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            axum::Json(ErrorResponse::invalid_token()),
        )
    })?;

    let pool_clone = pool.clone();
    tokio::spawn(async move {
        let _ = sqlx::query(r#"UPDATE "ApiToken" SET "lastUsedAt" = $1 WHERE id = $2"#)
            .bind(chrono::Local::now().naive_local())
            .bind(token_id)
            .execute(&pool_clone)
            .await;
    });

    request.extensions_mut().insert(UserId(user_id));
    request
        .extensions_mut()
        .insert(TokenMetadata { user_id, token_id });

    Ok(next.run(request).await)
}

/// Helper function to get user ID from request extensions
pub fn get_user_id(request: &Request) -> Option<Uuid> {
    request.extensions().get::<UserId>().map(|u| u.0)
}

/// Helper function to get token metadata from request extensions
pub fn get_token_metadata(request: &Request) -> Option<&TokenMetadata> {
    request.extensions().get::<TokenMetadata>()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_bearer_token_valid() {
        let result = extract_bearer_token("Bearer sk-test-token-123");
        assert_eq!(result.unwrap(), "sk-test-token-123");
    }

    #[test]
    fn test_extract_bearer_token_invalid() {
        let result = extract_bearer_token("InvalidFormat");
        assert!(matches!(result, Err(AuthError::InvalidFormat)));
    }

    #[test]
    fn test_extract_bearer_token_empty() {
        let result = extract_bearer_token("");
        assert!(matches!(result, Err(AuthError::InvalidFormat)));
    }

    #[test]
    fn test_error_response_serialization() {
        let response = ErrorResponse::invalid_token();
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("Invalid API token"));
        assert!(json.contains("401"));
        assert!(json.contains("unauthorized"));
    }
}
