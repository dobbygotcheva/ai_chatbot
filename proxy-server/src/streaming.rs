//! SSE Streaming - Production ready

use axum::{body::Body, http::header, response::Response};
use bytes::Bytes;
use futures_util::StreamExt;
use serde_json::{json, Map, Value};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tracing::{debug, error, warn};
use uuid::Uuid;

use crate::config::Config;
use crate::proxy::ProxyError;

/// Stream SSE from upstream
pub async fn handle_streaming(
    config: &Config,
    payload: Value,
    request_id: Uuid,
    user_id: Uuid,
    db_pool: Option<&sqlx::PgPool>,
) -> Result<Response, ProxyError> {
    debug!("SSE stream {}", request_id);

    // Clean payload - remove null values that upstream doesn't like
    let mut clean_payload = remove_nulls(payload);

    // Set stream=true and enable usage tracking
    if let Value::Object(ref mut map) = clean_payload {
        map.insert("stream".to_string(), json!(true));
        // Enable token usage in final chunk (OpenAI standard)
        map.insert(
            "stream_options".to_string(),
            json!({
                "include_usage": true
            }),
        );
    }

    let provider_key = std::env::var("PROVIDER_API_KEY").unwrap_or_default();
    let upstream_url = format!(
        "{}/chat/completions",
        config.upstream_base_url.trim_end_matches('/')
    );

    debug!("Upstream: {}", upstream_url);

    let client = reqwest::Client::new();

    let resp = client
        .post(&upstream_url)
        .header("Authorization", format!("Bearer {}", provider_key))
        .header("Content-Type", "application/json")
        .timeout(Duration::from_secs(config.upstream_timeout_secs))
        .json(&clean_payload)
        .send()
        .await;

    let resp = match resp {
        Ok(r) => r,
        Err(e) => {
            error!("Upstream error: {}", e);
            return Ok(sse_error(&format!("Request failed: {}", e)));
        }
    };

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        warn!("Upstream {}: {}", status, text.lines().next().unwrap_or(""));
        return Ok(sse_error(&format!(
            "Upstream {}: {}",
            status,
            text.lines().next().unwrap_or("")
        )));
    }

    debug!("Got upstream response");

    // Get byte stream from upstream
    let mut upstream_stream = resp.bytes_stream();

    // Create channel for forwarding chunks
    let (tx, rx) = mpsc::channel::<Result<Bytes, anyhow::Error>>(100);

    // Add channel for sending accumulated SSE text to metrics task
    let (metrics_tx, mut metrics_rx) = mpsc::channel::<String>(1);

    // Spawn task to forward chunks and accumulate raw SSE text
    tokio::spawn(async move {
        let mut sse_text = String::new();

        while let Some(chunk_result) = upstream_stream.next().await {
            match chunk_result {
                Ok(chunk) => {
                    // Accumulate raw SSE text for usage extraction
                    if let Ok(text) = std::str::from_utf8(&chunk) {
                        sse_text.push_str(text);
                    }

                    // Forward chunk immediately to client
                    if tx.send(Ok(chunk)).await.is_err() {
                        // Client disconnected - stop streaming
                        debug!("Client disconnected, stopping stream");
                        break;
                    }
                }
                Err(e) => {
                    // Upstream error - send error and stop
                    error!("Upstream error: {}", e);
                    let _ = tx.send(Err(anyhow::anyhow!(e))).await;
                    break;
                }
            }
        }

        // Send accumulated SSE text to metrics task
        let _ = metrics_tx.send(sse_text).await;
    });

    // Convert receiver to Body stream
    let body = Body::from_stream(ReceiverStream::new(rx));

    let mut response = Response::new(body);
    response
        .headers_mut()
        .insert(header::CONTENT_TYPE, "text/event-stream".parse().unwrap());
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, "no-cache".parse().unwrap());

    // Spawn async metrics logging (doesn't block stream)
    if let Some(pool) = db_pool {
        let pool = pool.clone();
        let model_id = clean_payload
            .get("model")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        tokio::spawn(async move {
            // Wait for accumulated SSE text from stream task
            let accumulated_sse = metrics_rx.recv().await.unwrap_or_default();

            // Use complete usage object from final chunk
            let (input_tokens, output_tokens, total_tokens) = if let Some(usage) =
                extract_usage_from_sse(&accumulated_sse)
            {
                // Extract ALL values from usage object
                let input_tokens = usage
                    .get("usage")
                    .and_then(|u| u.get("prompt_tokens"))
                    .and_then(|t| t.as_i64())
                    .unwrap_or(0) as i32;

                let output_tokens = usage
                    .get("usage")
                    .and_then(|u| u.get("completion_tokens"))
                    .and_then(|t| t.as_i64())
                    .unwrap_or(0) as i32;

                let total_tokens = usage
                    .get("usage")
                    .and_then(|u| u.get("total_tokens"))
                    .and_then(|t| t.as_i64())
                    .unwrap_or(0) as i32;

                (input_tokens, output_tokens, total_tokens)
            } else {
                // Fallback: estimate
                let input = crate::metrics::count_tokens_in_messages(&clean_payload).unwrap_or(0);
                let output = count_streaming_tokens(&accumulated_sse);
                let total = input + output;
                (input, output, total)
            };
            let latency_ms = 0; // Streaming - latency is per-chunk
            let success = true;

            let _ = crate::metrics::log_token_usage(
                &pool,
                request_id,
                user_id,
                &model_id,
                input_tokens,
                output_tokens,
                total_tokens,
                latency_ms,
                success,
            )
            .await;
        });
    }

    Ok(response)
}

/// Extract usage info from SSE response
/// SSE format: "data: {json}\n\ndata: {json}\n..."
/// Final chunk contains: {"usage":{"prompt_tokens":N,"completion_tokens":M,"total_tokens":K}}
fn extract_usage_from_sse(sse_text: &str) -> Option<Value> {
    sse_text
        .lines()
        .rev()
        .filter_map(|line| line.strip_prefix("data: "))
        .filter_map(|json_str| serde_json::from_str::<Value>(json_str).ok())
        .find(|json| json.get("usage").is_some())
}

/// Count output tokens by extracting all content from streaming chunks
/// Each chunk contains: {"choices":[{"delta":{"content":"..."}}]}
fn count_streaming_tokens(sse_text: &str) -> i32 {
    let mut total_content = String::new();

    for line in sse_text.lines() {
        if line.trim() == "data: [DONE]" || line.trim().is_empty() {
            continue;
        }

        if let Some(json_str) = line.strip_prefix("data: ") {
            if let Ok(json) = serde_json::from_str::<Value>(json_str) {
                if let Some(content) = json
                    .get("choices")
                    .and_then(|c| c.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|choice| choice.get("delta"))
                    .and_then(|delta| delta.get("content"))
                    .and_then(|content| content.as_str())
                {
                    total_content.push_str(content);
                }
            }
        }
    }

    if total_content.is_empty() {
        0
    } else {
        (total_content.len() / 4) as i32
    }
}

/// Remove null values from JSON object
fn remove_nulls(value: Value) -> Value {
    match value {
        Value::Object(map) => {
            let clean: Map<String, Value> = map
                .into_iter()
                .filter_map(|(k, v)| {
                    let clean_v = remove_nulls(v);
                    if clean_v.is_null() {
                        None
                    } else {
                        Some((k, clean_v))
                    }
                })
                .collect();
            Value::Object(clean)
        }
        Value::Array(arr) => Value::Array(arr.into_iter().map(remove_nulls).collect()),
        _ => value,
    }
}

fn sse_error(msg: &str) -> Response {
    let error_json = json!({"error": {"message": msg, "type": "streaming_error"}});
    let sse = format!("data: {}\n\n", error_json);

    let mut resp = Response::new(Body::from(sse));
    resp.headers_mut()
        .insert(header::CONTENT_TYPE, "text/event-stream".parse().unwrap());
    resp
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_extract_usage_from_sse_with_usage() {
        let sse = r#"data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" World"}}]}
data: {"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}"#;

        let result = extract_usage_from_sse(sse);
        assert!(result.is_some());

        let usage = result.unwrap();
        assert_eq!(usage["usage"]["prompt_tokens"], 10);
        assert_eq!(usage["usage"]["completion_tokens"], 5);
        assert_eq!(usage["usage"]["total_tokens"], 15);
    }

    #[test]
    fn test_extract_usage_from_sse_without_usage() {
        let sse = r#"data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" World"}}]}
data: [DONE]"#;

        let result = extract_usage_from_sse(sse);
        assert!(result.is_none());
    }

    #[test]
    fn test_extract_usage_from_sse_empty() {
        let result = extract_usage_from_sse("");
        assert!(result.is_none());
    }

    #[test]
    fn test_count_streaming_tokens_basic() {
        let sse = r#"data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" World"}}]}"#;

        let tokens = count_streaming_tokens(sse);
        assert!(tokens > 0);
        assert_eq!(tokens, 2); // "Hello World" = 11 chars / 4 ≈ 2-3 tokens
    }

    #[test]
    fn test_count_streaming_tokens_with_done() {
        let sse = r#"data: {"choices":[{"delta":{"content":"Test"}}]}
data: [DONE]"#;

        let tokens = count_streaming_tokens(sse);
        assert!(tokens > 0);
        assert_eq!(tokens, 1); // "Test" = 4 chars / 4 = 1 token
    }

    #[test]
    fn test_count_streaming_tokens_empty() {
        let sse = r#"data: {"choices":[{"delta":{"content":null}}]}
data: [DONE]"#;

        let tokens = count_streaming_tokens(sse);
        assert_eq!(tokens, 0);
    }

    #[test]
    fn test_count_streaming_tokens_multiple_chunks() {
        let sse = r#"data: {"choices":[{"delta":{"content":"This is a longer message"}}]}
data: {"choices":[{"delta":{"content":" with multiple chunks"}}]}
data: {"choices":[{"delta":{"content":" for testing"}}]}"#;

        let tokens = count_streaming_tokens(sse);
        assert!(tokens > 0);
        // "This is a longer message with multiple chunks for testing" = 58 chars / 4 ≈ 14-15 tokens
        assert!(tokens >= 10 && tokens <= 20);
    }

    #[test]
    fn test_count_streaming_tokens_empty_lines() {
        let sse = r#"data: {"choices":[{"delta":{"content":"Test"}}]}

data: {"choices":[{"delta":{"content":" Again"}}]}
"#;

        let tokens = count_streaming_tokens(sse);
        assert!(tokens > 0);
    }

    #[test]
    fn test_remove_nulls_object() {
        let input = json!({
            "key": "value",
            "null_key": null,
            "nested": {
                "inner": "value",
                "inner_null": null
            }
        });

        let result = remove_nulls(input);
        assert_eq!(result["key"], "value");
        assert!(result.get("null_key").is_none());
        assert_eq!(result["nested"]["inner"], "value");
        assert!(result["nested"].get("inner_null").is_none());
    }

    #[test]
    fn test_remove_nulls_array() {
        let input = json!([
            {"key": "value1"},
            null,
            {"key": null}
        ]);

        let result = remove_nulls(input);
        assert!(result.is_array());
        let arr = result.as_array().unwrap();
        assert_eq!(arr.len(), 3); // null element kept in array
        assert_eq!(arr[0]["key"], "value1");
        assert!(arr[1].is_null());
        assert_eq!(arr[2].as_object().unwrap().len(), 0); // key removed from object
    }
}
