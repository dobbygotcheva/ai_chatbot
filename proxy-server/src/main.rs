//! LLM Proxy Server - Binary Entry Point

use llm_proxy::{
    auth,
    config::Config,
    metrics::MetricsState,
    proxy::AppState,
    proxy::{CircuitBreakerWrapper, ProxyState},
    worker::WorkerPool,
};
use sqlx::postgres::PgPool;
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "llm_proxy=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env()?;
    tracing::info!("Starting LLM Proxy Server on port {}", config.port);
    tracing::info!(
        "Worker count: {}, Queue size: {}",
        config.worker_count,
        config.queue_size
    );

    let pool = PgPool::connect(&config.postgres_url).await?;
    tracing::info!("Database connection pool created");

    let config_arc = Arc::new(config.clone());
    let worker_pool = Arc::new(WorkerPool::new(
        &config_arc,
        pool.clone(),
        config_arc.upstream_base_url.clone(),
    ));
    tracing::info!(
        "Worker pool initialized with {} workers",
        config_arc.worker_count
    );

    let circuit_breaker = Arc::new(CircuitBreakerWrapper::new(
        config_arc.circuit_breaker_threshold,
        30,
    ));
    let metrics_state = Arc::new(MetricsState::new());

    let proxy_state = Arc::new(ProxyState {
        worker_pool: worker_pool.clone(),
        circuit_breaker: circuit_breaker.clone(),
        config: config_arc.clone(),
    });

    let app_state = AppState {
        proxy_state: proxy_state.clone(),
        metrics_state: metrics_state.clone(),
        pool: pool.clone(),
        config: config_arc.clone(),
    };

    // Build router with streaming support
    use axum::{
        middleware,
        routing::{get, post},
        Router,
    };

    let proxy_router = Router::new()
        .route(
            "/v1/chat/completions",
            post(llm_proxy::proxy::chat_completions),
        )
        .layer(middleware::from_fn_with_state(
            app_state.clone(),
            auth::validate_token,
        ));

    let app = Router::new()
        .route("/health", get(llm_proxy::metrics::get_health))
        .route("/metrics", get(llm_proxy::metrics::get_metrics))
        .merge(proxy_router)
        .with_state(app_state);

    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
