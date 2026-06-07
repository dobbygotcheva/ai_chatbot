//! Integration tests for LLM proxy server
//!
//! These tests make real HTTP calls to a running proxy server.
//! The proxy must be running at the configured URL (default: http://127.0.0.1:3001)
//!
//! # Running Tests
//!
//! ```bash
//! # Run all integration tests
//! cargo test --test integration
//!
//! # Run specific test module
//! cargo test --test integration streaming
//! cargo test --test integration auth
//! cargo test --test integration errors
//!
//! # Run with custom proxy URL
//! PROXY_URL=http://localhost:3001 cargo test --test integration
//!
//! # Run with verbose output
//! cargo test --test integration -- --nocapture
//! ```
//!
//! # Environment Variables
//!
//! - `PROXY_URL` - Proxy server URL (default: http://127.0.0.1:3001)
//! - `VALID_TOKEN` - Valid auth token (default: test-token-dev-001)
//! - `INVALID_TOKEN` - Invalid token for testing (default: invalid-token-xyz)

pub mod common;

mod integration {
    pub mod auth_tests;
    pub mod error_tests;
    pub mod metrics_tests;
    pub mod streaming_tests;
}
