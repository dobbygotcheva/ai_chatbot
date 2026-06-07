//! Test binary to verify configuration loading.
//!
//! Usage:
//! ```bash
//! # Set required environment variables
//! export POSTGRES_URL="postgresql://postgres:postgres@localhost:5432/ai_chatbot"
//! export ENCRYPTION_KEY="test-encryption-key-for-testing-only"
//! export UPSTREAM_BASE_URL="https://ai-api.egt-digital.com/gateway/v1/"
//!
//! # Optional: override defaults
//! export PORT=3002
//! export WORKER_COUNT=4
//! export QUEUE_SIZE=100
//!
//! # Run the test
//! cargo run --example test_config
//! ```

use llm_proxy::config::Config;

fn main() {
    println!("Testing configuration loading...\n");

    match Config::from_env() {
        Ok(config) => {
            println!("✓ Configuration loaded successfully!\n");
            println!("Configuration:");
            println!(
                "  POSTGRES_URL:       {}",
                mask_sensitive(&config.postgres_url)
            );
            println!(
                "  ENCRYPTION_KEY:     {}",
                mask_sensitive(&config.encryption_key)
            );
            println!("  UPSTREAM_BASE_URL:  {}", config.upstream_base_url);
            println!("  PORT:               {}", config.port);
            println!("  WORKER_COUNT:       {}", config.worker_count);
            println!("  QUEUE_SIZE:         {}", config.queue_size);
            println!(
                "  CIRCUIT_BREAKER_THRESHOLD: {}",
                config.circuit_breaker_threshold
            );
            println!("  CLIENT_TIMEOUT_SECS:      {}", config.client_timeout_secs);
            println!(
                "  UPSTREAM_TIMEOUT_SECS:    {}",
                config.upstream_timeout_secs
            );
            println!("\n✓ All configuration values are valid!");
            println!("✓ Client timeout: {:?}", config.client_timeout());
            println!("✓ Upstream timeout: {:?}", config.upstream_timeout());
        }
        Err(e) => {
            eprintln!("✗ Configuration error: {}", e);
            std::process::exit(1);
        }
    }
}

/// Mask sensitive parts of connection strings for display
fn mask_sensitive(value: &str) -> String {
    if value.starts_with("postgresql://") {
        // Show protocol and host, mask credentials
        if let Some(after_protocol) = value.strip_prefix("postgresql://") {
            if let Some(at_pos) = after_protocol.find('@') {
                let host_part = &after_protocol[at_pos + 1..];
                return format!("postgresql://***@{}", host_part);
            }
        }
        value.to_string()
    } else if value.len() > 8 {
        // For encryption keys, show first and last 4 chars
        format!("{}***{}", &value[..4], &value[value.len() - 4..])
    } else {
        "***".to_string()
    }
}
