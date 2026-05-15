use parking_lot::Mutex;
use tauri::State;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Holds the running LSP sidecar's child handle and discovered port.
/// Stored in Tauri app state so the child stays alive for the app's lifetime.
pub struct LspState {
    /// Keeps the CommandChild alive (its Drop kills the process).
    pub child: Mutex<Option<CommandChild>>,
    /// Port the WS server is listening on, once started.
    pub port: Mutex<Option<u16>>,
}

impl LspState {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            port: Mutex::new(None),
        }
    }
}

/// Spawn the TypeScript LSP sidecar and return the WebSocket port.
///
/// Idempotent: if the sidecar is already running, returns the cached port.
#[tauri::command]
pub async fn start_lsp_server(
    app: tauri::AppHandle,
    state: State<'_, LspState>,
) -> Result<u16, String> {
    // Return cached port if already running
    {
        let port_guard = state.port.lock();
        if let Some(port) = *port_guard {
            return Ok(port);
        }
    }

    let sidecar = app
        .shell()
        .sidecar("cast-lsp-ts")
        .map_err(|e| format!("Failed to create LSP sidecar command: {e}"))?;

    let (mut rx, child) = sidecar
        .spawn()
        .map_err(|e| format!("Failed to spawn LSP sidecar: {e}"))?;

    // Wait for the port announcement line: "CAST_LSP_PORT=<port>"
    let port = wait_for_port(&mut rx).await?;

    // Store the child handle so it isn't dropped (which would kill the process)
    {
        let mut child_guard = state.child.lock();
        *child_guard = Some(child);
    }
    {
        let mut port_guard = state.port.lock();
        *port_guard = Some(port);
    }

    Ok(port)
}

/// Stop the LSP sidecar and clear the cached port.
/// The next call to `start_lsp_server` will spawn a fresh instance.
#[tauri::command]
pub fn stop_lsp_server(state: State<'_, LspState>) -> Result<(), String> {
    let mut child_guard = state.child.lock();
    if let Some(child) = child_guard.take() {
        child.kill().map_err(|e| format!("Failed to kill LSP child: {e}"))?;
    }
    let mut port_guard = state.port.lock();
    *port_guard = None;
    Ok(())
}

// ── Port extraction helper ────────────────────────────────────────────────────

async fn wait_for_port(
    rx: &mut tauri::async_runtime::Receiver<CommandEvent>,
) -> Result<u16, String> {
    // Poll for up to 10 seconds (100 × 100ms) for the port announcement
    for _ in 0..100 {
        match tokio::time::timeout(
            std::time::Duration::from_millis(100),
            rx.recv(),
        )
        .await
        {
            Ok(Some(CommandEvent::Stdout(line))) => {
                let text = String::from_utf8_lossy(&line);
                let text = text.trim();
                if let Some(rest) = text.strip_prefix("CAST_LSP_PORT=") {
                    let port: u16 = rest
                        .parse()
                        .map_err(|_| format!("Invalid port value in LSP output: '{rest}'"))?;
                    return Ok(port);
                }
                // Other stdout lines — not the port announcement, continue waiting
            }
            Ok(Some(CommandEvent::Stderr(line))) => {
                // Stderr from sidecar — diagnostic only
                let text = String::from_utf8_lossy(&line);
                eprintln!("[cast-lsp-ts] stderr: {}", text.trim());
            }
            Ok(Some(CommandEvent::Error(e))) => {
                return Err(format!("LSP sidecar reported error: {e}"));
            }
            Ok(Some(CommandEvent::Terminated(status))) => {
                return Err(format!(
                    "LSP sidecar exited before announcing port (code: {:?})",
                    status.code
                ));
            }
            Ok(Some(_)) => {} // other CommandEvent variants — ignore
            Ok(None) => {
                return Err("LSP sidecar channel closed before port received".to_string());
            }
            Err(_timeout) => {
                // Timed out this iteration — loop and try again
                continue;
            }
        }
    }

    Err("Timed out (10s) waiting for LSP sidecar to announce its port".to_string())
}
