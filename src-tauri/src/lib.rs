mod cwd;
mod git;
mod lsp;
mod menu;
mod process;
mod pty;
mod session;

use lsp::LspState;
use parking_lot::Mutex;
use session::SessionStore;
use tauri::Manager;
#[cfg(not(debug_assertions))]
use tauri_plugin_shell::ShellExt;

/// Holds the running cast-server sidecar's child handle (production only).
/// Mirrors the LspState pattern so ownership is explicit and .take()→.kill()
/// in the exit handler is safe (owned value, not a borrow — avoids 1a5b68c).
struct ServerState {
    child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
}

impl ServerState {
    fn new() -> Self {
        Self {
            child: Mutex::new(None),
        }
    }
}

/// Kill any lingering cast-server / cast-lsp-ts processes left by a previous
/// run. Uses pkill(1) with -x (exact process name match). Exit code 1 from
/// pkill means "none found" — silently ignored. The 200ms sleep gives the OS
/// time to reap signalled processes before we spawn fresh replacements.
fn kill_stale_sidecars() {
    for name in &["cast-server", "cast-lsp-ts"] {
        let _ = std::process::Command::new("pkill")
            .args(["-x", name])
            .status();
    }
    std::thread::sleep(std::time::Duration::from_millis(200));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SessionStore::new())
        .manage(LspState::new())
        .manage(ServerState::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            kill_stale_sidecars();
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

            // Dev mode: visible:false in the config keeps the window hidden until
            // Tauri is fully initialised. Show it now so devUrl loads in the WebView.
            #[cfg(debug_assertions)]
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
            }

            // Production only: spawn the Express sidecar and navigate the WebView.
            // visible:false in config is the reliable hide gate; navigate()+show() below
            // reveal the window only after the sidecar is ready.
            #[cfg(not(debug_assertions))]
            {
                let resource_dir = app.path().resource_dir()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();

                // Ask the OS for a free port by binding to 0, then immediately releasing
                // it so the sidecar can claim the same port. The tiny TOCTOU window is
                // acceptable — a collision here falls back gracefully in the TCP probe.
                let port = std::net::TcpListener::bind("127.0.0.1:0")
                    .and_then(|l| l.local_addr())
                    .map(|a| a.port())
                    .unwrap_or(49301);

                let sidecar = app.shell()
                    .sidecar("cast-server")
                    .expect("failed to create sidecar")
                    .env("CAST_RESOURCE_DIR", &resource_dir)
                    .env("CAST_SERVER_PORT_OVERRIDE", port.to_string());
                let (_, child) = sidecar.spawn().expect("failed to spawn cast-server sidecar");
                app.state::<ServerState>().child.lock().replace(child);

                // TCP readiness probe: poll until the sidecar accepts connections, then
                // navigate and show. No stdout IPC — avoids pipe-buffering race.
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    for _ in 0..100 {
                        if std::net::TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok() {
                            let url = format!("http://127.0.0.1:{}/", port);
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.navigate(url.parse::<tauri::Url>().expect("valid url"));
                                let _ = window.show();
                            }
                            return;
                        }
                        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                    }
                    eprintln!("[cast-server] TCP probe timed out — server did not start within 10s");
                });
            }

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
            menu::toggle_devtools,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit = event {
                // Kill cast-lsp-ts in dev AND prod — it leaks in both modes.
                if let Some(child) = app_handle.state::<LspState>().child.lock().take() {
                    let _ = child.kill(); // suppress error — process may already be gone
                }

                // Kill cast-server in prod only — in dev the Express server is managed
                // by beforeDevCommand (npm run server:dev) not by this process.
                #[cfg(not(debug_assertions))]
                if let Some(child) = app_handle.state::<ServerState>().child.lock().take() {
                    let _ = child.kill();
                }
            }
        });
}
