//! Configuration management for the LLM proxy server.
//!
//! This module handles loading and validating configuration from environment variables.
//! Required variables cause the application to fail fast on startup if missing.

use serde::Deserialize;
use std::time::Duration;
use thiserror::Error;

/// Configuration errors
#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Missing required environment variable: {0}")]
    MissingVar(String),

    #[error("Invalid value for {var}: {message}")]
    InvalidValue { var: String, message: String },

    #[error("Failed to load environment: {0}")]
    EnvError(#[from] std::env::VarError),
}

/// Application configuration
///
/// All configuration is loaded from environment variables at startup.
/// Required variables: POSTGRES_URL, ENCRYPTION_KEY, UPSTREAM_BASE_URL
/// Optional variables have sensible defaults for staging/production.
#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    /// PostgreSQL connection string (required)
    pub postgres_url: String,

    /// Encryption key for sensitive data (required)
    /// Reuses existing key from McpSession (already in staging/prod)
    pub encryption_key: String,

    /// Upstream LLM provider base URL (required)
    /// Default: https://ai-api.egt-digital.com/gateway/v1/
    pub upstream_base_url: String,

    /// Server port (optional, default: 3002 for staging, 3003 for prod)
    #[serde(default = "default_port")]
    pub port: u16,

    /// Number of worker threads (optional, default: 4)
    #[serde(default = "default_worker_count")]
    pub worker_count: usize,

    /// Request queue size (optional, default: 100)
    #[serde(default = "default_queue_size")]
    pub queue_size: usize,

    /// Circuit breaker failure threshold (optional, default: 5)
    #[serde(default = "default_circuit_breaker_threshold")]
    pub circuit_breaker_threshold: usize,

    /// Client timeout in seconds (optional, default: 120)
    #[serde(default = "default_client_timeout_secs")]
    pub client_timeout_secs: u64,

    /// Upstream timeout in seconds (optional, default: 90)
    #[serde(default = "default_upstream_timeout_secs")]
    pub upstream_timeout_secs: u64,
}

// Default value functions for serde
fn default_port() -> u16 {
    // Default to staging port
    3002
}

fn default_worker_count() -> usize {
    4
}

fn default_queue_size() -> usize {
    100
}

fn default_circuit_breaker_threshold() -> usize {
    5
}

fn default_client_timeout_secs() -> u64 {
    120
}

fn default_upstream_timeout_secs() -> u64 {
    90
}

impl Config {
    /// Load configuration from environment variables.
    ///
    /// This function:
    /// 1. Loads .env file if present (development only)
    /// 2. Reads required environment variables
    /// 3. Validates all values
    /// 4. Returns error if any required variable is missing
    ///
    /// # Required Environment Variables
    /// - `POSTGRES_URL` - PostgreSQL connection string
    /// - `ENCRYPTION_KEY` - AES-256-GCM encryption key
    /// - `UPSTREAM_BASE_URL` - Base URL for upstream LLM provider
    ///
    /// # Optional Environment Variables (with defaults)
    /// - `PORT` - Server port (default: 3002)
    /// - `WORKER_COUNT` - Number of workers (default: 4)
    /// - `QUEUE_SIZE` - Request queue size (default: 100)
    /// - `CIRCUIT_BREAKER_THRESHOLD` - Failure threshold (default: 5)
    /// - `CLIENT_TIMEOUT_SECS` - Client timeout (default: 120)
    /// - `UPSTREAM_TIMEOUT_SECS` - Upstream timeout (default: 90)
    pub fn from_env() -> Result<Self, ConfigError> {
        // Load .env file if present (only in development)
        // In production, environment variables should be set by Docker/orchestrator
        let _ = dotenvy::dotenv();

        // Load required variables
        let postgres_url = std::env::var("POSTGRES_URL")
            .map_err(|_| ConfigError::MissingVar("POSTGRES_URL".to_string()))?;

        let encryption_key = std::env::var("ENCRYPTION_KEY")
            .map_err(|_| ConfigError::MissingVar("ENCRYPTION_KEY".to_string()))?;

        let upstream_base_url = std::env::var("UPSTREAM_BASE_URL")
            .map_err(|_| ConfigError::MissingVar("UPSTREAM_BASE_URL".to_string()))?;

        // Load optional variables with defaults
        let port = std::env::var("PORT")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or_else(default_port);

        let worker_count = std::env::var("WORKER_COUNT")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or_else(default_worker_count);

        let queue_size = std::env::var("QUEUE_SIZE")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or_else(default_queue_size);

        let circuit_breaker_threshold = std::env::var("CIRCUIT_BREAKER_THRESHOLD")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or_else(default_circuit_breaker_threshold);

        let client_timeout_secs = std::env::var("CLIENT_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or_else(default_client_timeout_secs);

        let upstream_timeout_secs = std::env::var("UPSTREAM_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or_else(default_upstream_timeout_secs);

        let config = Config {
            postgres_url,
            encryption_key,
            upstream_base_url,
            port,
            worker_count,
            queue_size,
            circuit_breaker_threshold,
            client_timeout_secs,
            upstream_timeout_secs,
        };

        // Validate configuration
        config.validate()?;

        Ok(config)
    }

    /// Validate configuration values.
    ///
    /// Checks:
    /// - Upstream timeout < client timeout (so we can timeout upstream before client)
    /// - Worker count > 0
    /// - Queue size > 0
    /// - Circuit breaker threshold > 0
    fn validate(&self) -> Result<(), ConfigError> {
        if self.upstream_timeout_secs >= self.client_timeout_secs {
            return Err(ConfigError::InvalidValue {
                var: "UPSTREAM_TIMEOUT_SECS".to_string(),
                message: format!(
                    "Upstream timeout ({}) must be less than client timeout ({})",
                    self.upstream_timeout_secs, self.client_timeout_secs
                ),
            });
        }

        if self.worker_count == 0 {
            return Err(ConfigError::InvalidValue {
                var: "WORKER_COUNT".to_string(),
                message: "Worker count must be greater than 0".to_string(),
            });
        }

        if self.queue_size == 0 {
            return Err(ConfigError::InvalidValue {
                var: "QUEUE_SIZE".to_string(),
                message: "Queue size must be greater than 0".to_string(),
            });
        }

        if self.circuit_breaker_threshold == 0 {
            return Err(ConfigError::InvalidValue {
                var: "CIRCUIT_BREAKER_THRESHOLD".to_string(),
                message: "Circuit breaker threshold must be greater than 0".to_string(),
            });
        }

        Ok(())
    }

    /// Get client timeout as Duration
    pub fn client_timeout(&self) -> Duration {
        Duration::from_secs(self.client_timeout_secs)
    }

    /// Get upstream timeout as Duration
    pub fn upstream_timeout(&self) -> Duration {
        Duration::from_secs(self.upstream_timeout_secs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_timeout_conversion() {
        let config = Config {
            postgres_url: "postgresql://test".to_string(),
            encryption_key: "test-key".to_string(),
            upstream_base_url: "https://test.com".to_string(),
            port: 3002,
            worker_count: 4,
            queue_size: 100,
            circuit_breaker_threshold: 5,
            client_timeout_secs: 120,
            upstream_timeout_secs: 90,
        };

        assert_eq!(config.client_timeout(), Duration::from_secs(120));
    }

    #[test]
    fn test_upstream_timeout_conversion() {
        let config = Config {
            postgres_url: "postgresql://test".to_string(),
            encryption_key: "test-key".to_string(),
            upstream_base_url: "https://test.com".to_string(),
            port: 3002,
            worker_count: 4,
            queue_size: 100,
            circuit_breaker_threshold: 5,
            client_timeout_secs: 120,
            upstream_timeout_secs: 90,
        };

        assert_eq!(config.upstream_timeout(), Duration::from_secs(90));
    }

    #[test]
    fn test_validation_upstream_timeout_exceeds_client() {
        let config = Config {
            postgres_url: "postgresql://test".to_string(),
            encryption_key: "test-key".to_string(),
            upstream_base_url: "https://test.com".to_string(),
            port: 3002,
            worker_count: 4,
            queue_size: 100,
            circuit_breaker_threshold: 5,
            client_timeout_secs: 60,
            upstream_timeout_secs: 90, // Invalid: >= client_timeout
        };

        let result = config.validate();
        assert!(result.is_err());
        assert!(
            matches!(result.unwrap_err(), ConfigError::InvalidValue { var, .. } if var == "UPSTREAM_TIMEOUT_SECS")
        );
    }

    #[test]
    fn test_validation_zero_worker_count() {
        let config = Config {
            postgres_url: "postgresql://test".to_string(),
            encryption_key: "test-key".to_string(),
            upstream_base_url: "https://test.com".to_string(),
            port: 3002,
            worker_count: 0, // Invalid
            queue_size: 100,
            circuit_breaker_threshold: 5,
            client_timeout_secs: 120,
            upstream_timeout_secs: 90,
        };

        let result = config.validate();
        assert!(result.is_err());
        assert!(
            matches!(result.unwrap_err(), ConfigError::InvalidValue { var, .. } if var == "WORKER_COUNT")
        );
    }

    #[test]
    fn test_validation_zero_queue_size() {
        let config = Config {
            postgres_url: "postgresql://test".to_string(),
            encryption_key: "test-key".to_string(),
            upstream_base_url: "https://test.com".to_string(),
            port: 3002,
            worker_count: 4,
            queue_size: 0, // Invalid
            circuit_breaker_threshold: 5,
            client_timeout_secs: 120,
            upstream_timeout_secs: 90,
        };

        let result = config.validate();
        assert!(result.is_err());
        assert!(
            matches!(result.unwrap_err(), ConfigError::InvalidValue { var, .. } if var == "QUEUE_SIZE")
        );
    }

    #[test]
    fn test_validation_zero_circuit_breaker_threshold() {
        let config = Config {
            postgres_url: "postgresql://test".to_string(),
            encryption_key: "test-key".to_string(),
            upstream_base_url: "https://test.com".to_string(),
            port: 3002,
            worker_count: 4,
            queue_size: 100,
            circuit_breaker_threshold: 0, // Invalid
            client_timeout_secs: 120,
            upstream_timeout_secs: 90,
        };

        let result = config.validate();
        assert!(result.is_err());
        assert!(
            matches!(result.unwrap_err(), ConfigError::InvalidValue { var, .. } if var == "CIRCUIT_BREAKER_THRESHOLD")
        );
    }
}
