mod cwd;
mod git;
mod lsp;
mod menu;
mod process;
mod pty;
mod session;

use lsp::LspState;
use session::SessionStore;
use tauri::Manager;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SessionStore::new())
        .manage(LspState::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Build the native macOS menu. Cmd+W is intentionally absent from
            // all menu items — EditorTabs.tsx owns that binding via useHotkeys
            // for tab-close. Any accelerator placed here would be intercepted by
            // macOS before the WKWebView keydown event fires.
            let app_menu = menu::build_menu(app.handle())?;
            app.set_menu(app_menu)?;

            // Spawn the Express sidecar server with dynamic port selection
            let resource_dir = app.path().resource_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            let sidecar = app.shell()
                .sidecar("cast-server")
                .expect("failed to create sidecar")
                .env("CAST_RESOURCE_DIR", &resource_dir);
            let (mut rx, child) = sidecar.spawn().expect("failed to spawn cast-server sidecar");
            app.manage(child);

            // Discover the actual port and navigate the WebView once the server is ready
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match wait_for_server_port(&mut rx).await {
                    Ok(port) => {
                        let url = format!("http://127.0.0.1:{}/", port);
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.navigate(url.parse::<tauri::Url>().expect("valid server url"));
                        }
                    }
                    Err(e) => {
                        eprintln!("[cast-server] port discovery failed: {e}");
                    }
                }
            });
            Ok(())
        })
        .on_menu_event(menu::handle_menu_event)
        .invoke_handler(tauri::generate_handler![
            pty::pty_create,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            process::get_foreground_process,
            process::get_default_shell,
            cwd::get_cwd,
            git::get_git_status,
            lsp::start_lsp_server,
            lsp::stop_lsp_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ── Port extraction helper ────────────────────────────────────────────────────

async fn wait_for_server_port(
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
                if let Some(rest) = text.strip_prefix("CAST_SERVER_PORT=") {
                    let port: u16 = rest
                        .parse()
                        .map_err(|_| format!("Invalid port value in server output: '{rest}'"))?;
                    return Ok(port);
                }
            }
            Ok(Some(CommandEvent::Stderr(line))) => {
                let text = String::from_utf8_lossy(&line);
                eprintln!("[cast-server] stderr: {}", text.trim());
            }
            Ok(Some(CommandEvent::Error(e))) => {
                return Err(format!("cast-server sidecar reported error: {e}"));
            }
            Ok(Some(CommandEvent::Terminated(status))) => {
                return Err(format!(
                    "cast-server sidecar exited before announcing port (code: {:?})",
                    status.code
                ));
            }
            Ok(Some(_)) => {}
            Ok(None) => {
                return Err("cast-server sidecar channel closed before port received".to_string());
            }
            Err(_timeout) => {
                continue;
            }
        }
    }

    Err("Timed out (10s) waiting for cast-server sidecar to announce its port".to_string())
}
