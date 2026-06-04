use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::extract::Query;
use axum::response::Html;
use axum::routing::get;
use axum::Router;
use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;

const PORT_START: u16 = 9110;
const PORT_END: u16 = 9119;
const CALLBACK_TIMEOUT_SECS: u64 = 300;

const CALLBACK_HTML: &str = r#"<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <title>Nuclear</title>
    <style>
      body {
        background: #000;
        color: #fff;
        font-family: system-ui, -apple-system, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div>
      <h1>Autorizzazione completata</h1>
      <p>Puoi chiudere questa scheda e tornare a Nuclear Player.</p>
    </div>
  </body>
</html>"#;

#[derive(Default)]
pub struct OAuthLoopbackState {
    receiver: Mutex<Option<oneshot::Receiver<Result<String, String>>>>,
}

async fn serve_once(
    listener: tokio::net::TcpListener,
    code_tx: oneshot::Sender<Result<String, String>>,
) {
    let shutdown = CancellationToken::new();
    let sender = Arc::new(Mutex::new(Some(code_tx)));

    let handler_sender = sender.clone();
    let handler_shutdown = shutdown.clone();
    let handler = move |Query(params): Query<HashMap<String, String>>| {
        let sender = handler_sender.clone();
        let shutdown = handler_shutdown.clone();
        async move {
            let result = if let Some(code) = params.get("code") {
                Ok(code.clone())
            } else if let Some(error) = params.get("error") {
                Err(error.clone())
            } else {
                Err("Missing authorization code in callback".to_string())
            };

            if let Some(sender) = sender.lock().unwrap().take() {
                let _ = sender.send(result);
            }
            shutdown.cancel();
            Html(CALLBACK_HTML)
        }
    };

    let router = Router::new().route("/", get(handler));

    let graceful_shutdown = shutdown.clone();
    let _ = axum::serve(listener, router)
        .with_graceful_shutdown(async move { graceful_shutdown.cancelled().await })
        .await;
}

#[tauri::command]
pub async fn oauth_loopback_start(
    state: tauri::State<'_, OAuthLoopbackState>,
) -> Result<u16, String> {
    let listener =
        crate::net::bind_first_available_port("127.0.0.1", PORT_START, PORT_END).await?;
    let port = listener
        .local_addr()
        .map_err(|err| format!("Failed to read loopback port: {err}"))?
        .port();

    let (code_tx, code_rx) = oneshot::channel::<Result<String, String>>();
    *state.receiver.lock().unwrap() = Some(code_rx);

    log::info!("OAuth loopback listening on http://127.0.0.1:{port}");
    tauri::async_runtime::spawn(serve_once(listener, code_tx));

    Ok(port)
}

#[tauri::command]
pub async fn oauth_loopback_wait(
    state: tauri::State<'_, OAuthLoopbackState>,
) -> Result<String, String> {
    let receiver = state
        .receiver
        .lock()
        .unwrap()
        .take()
        .ok_or_else(|| "No OAuth flow in progress".to_string())?;

    match tokio::time::timeout(Duration::from_secs(CALLBACK_TIMEOUT_SECS), receiver).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err("OAuth listener closed before responding".to_string()),
        Err(_) => Err("Timed out waiting for the OAuth callback".to_string()),
    }
}
